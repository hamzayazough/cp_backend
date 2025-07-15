import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import {
  GetAdvertiserDashboardRequest,
  AdvertiserDashboardData,
  AdvertiserStats,
  AdvertiserActiveCampaign,
  AdvertiserTransaction,
  AdvertiserMessage,
  AdvertiserWallet,
} from '../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  AdvertiserDashboardSummary,
  CampaignAdvertiser,
  AdvertiserCampaignDetailsUnion,
  AdvertiserVisibilityCampaignDetails,
  AdvertiserConsultantCampaignDetails,
  AdvertiserSellerCampaignDetails,
  AdvertiserSalesmanCampaignDetails,
  AdvertiserCampaignSortField,
  PromoterApplicationInfo,
} from '../interfaces/advertiser-campaign';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { Promoter } from '../interfaces/user';
import { PromoterCampaignStatus } from '../interfaces/promoter-campaign';

// Type definitions for query results
interface QueryResult {
  total?: string;
  avg?: string;
}

interface BudgetQueryResult {
  allocated?: string;
  spent?: string;
}

interface TopCampaignQueryResult {
  id: string;
  title: string;
  views: string;
  sales: string;
  activePromoters: string;
}

@Injectable()
export class AdvertiserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(MessageThread)
    private messageThreadRepository: Repository<MessageThread>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: GetAdvertiserDashboardRequest,
  ): Promise<AdvertiserDashboardData> {
    const data: AdvertiserDashboardData = {
      stats: {
        spendingThisWeek: 0,
        spendingLastWeek: 0,
        spendingPercentageChange: 0,
        viewsToday: 0,
        viewsYesterday: 0,
        viewsPercentageChange: 0,
        conversionsThisWeek: 0,
        conversionsLastWeek: 0,
        conversionsPercentageChange: 0,
        activeCampaigns: 0,
        pendingApprovalCampaigns: 0,
      },
      activeCampaigns: [],
      recentTransactions: [],
      recentMessages: [],
      wallet: {
        balance: {
          currentBalance: 0,
          pendingCharges: 0,
          totalSpent: 0,
          totalDeposited: 0,
          minimumBalance: 0,
        },
        campaignBudgets: {
          totalAllocated: 0,
          totalUsed: 0,
          pendingPayments: 0,
        },
        totalLifetimeSpent: 0,
        totalAvailableBalance: 0,
      },
    };

    // Find advertiser by Firebase UID
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    const advertiserId = advertiser.id;

    // Get actual data from database
    if (request.includeStats) {
      data.stats = await this.getAdvertiserStats(advertiserId);
    }

    if (request.includeCampaigns) {
      data.activeCampaigns = await this.getActiveCampaigns(
        advertiserId,
        request.activeCampaignLimit || 10,
      );
    }

    if (request.includeTransactions) {
      data.recentTransactions = await this.getRecentTransactions(
        advertiserId,
        request.transactionLimit || 10,
      );
    }

    if (request.includeMessages) {
      data.recentMessages = await this.getRecentMessages(
        advertiserId,
        request.messageLimit || 10,
      );
    }

    if (request.includeWallet) {
      data.wallet = await this.getWalletInfo(advertiserId);
    }

    return data;
  }

  private async getAdvertiserStats(
    advertiserId: string,
  ): Promise<AdvertiserStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
    );

    // Get spending data from campaigns/transactions
    const spendingThisWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as QueryResult;

    const spendingLastWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as QueryResult;

    // Get views data from promoter campaigns
    const viewsToday = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.updatedAt >= :startOfToday', { startOfToday })
      .getRawOne()) as QueryResult;

    const viewsYesterday = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.updatedAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('pc.updatedAt < :startOfToday', { startOfToday })
      .getRawOne()) as QueryResult;

    // Get conversions (sales) data
    const conversionsThisWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as QueryResult;

    const conversionsLastWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as QueryResult;

    // Get campaign counts
    const activeCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'ACTIVE' })
      .getCount();

    const pendingApprovalCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'PENDING_APPROVAL' })
      .getCount();

    const spendingThisWeekNum = parseFloat(spendingThisWeek?.total || '0');
    const spendingLastWeekNum = parseFloat(spendingLastWeek?.total || '0');
    const viewsTodayNum = parseInt(viewsToday?.total || '0');
    const viewsYesterdayNum = parseInt(viewsYesterday?.total || '0');
    const conversionsThisWeekNum = parseInt(conversionsThisWeek?.total || '0');
    const conversionsLastWeekNum = parseInt(conversionsLastWeek?.total || '0');

    return {
      spendingThisWeek: spendingThisWeekNum,
      spendingLastWeek: spendingLastWeekNum,
      spendingPercentageChange:
        spendingLastWeekNum > 0
          ? ((spendingThisWeekNum - spendingLastWeekNum) /
              spendingLastWeekNum) *
            100
          : 0,
      viewsToday: viewsTodayNum,
      viewsYesterday: viewsYesterdayNum,
      viewsPercentageChange:
        viewsYesterdayNum > 0
          ? ((viewsTodayNum - viewsYesterdayNum) / viewsYesterdayNum) * 100
          : 0,
      conversionsThisWeek: conversionsThisWeekNum,
      conversionsLastWeek: conversionsLastWeekNum,
      conversionsPercentageChange:
        conversionsLastWeekNum > 0
          ? ((conversionsThisWeekNum - conversionsLastWeekNum) /
              conversionsLastWeekNum) *
            100
          : 0,
      activeCampaigns,
      pendingApprovalCampaigns,
    };
  }

  private async getActiveCampaigns(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserActiveCampaign[]> {
    const campaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'ONGOING', 'AWAITING_PROMOTER'],
      })
      .orderBy('campaign.updatedAt', 'DESC')
      .limit(limit)
      .getMany();

    const campaignData = await Promise.all(
      campaigns.map(async (campaign) => {
        // Get aggregated data for this campaign
        const promoterCampaigns = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
          .getMany();

        const totalViews = promoterCampaigns.reduce(
          (sum, pc) => sum + pc.viewsGenerated,
          0,
        );
        const totalSpent = promoterCampaigns.reduce(
          (sum, pc) => sum + Number(pc.earnings),
          0,
        );
        const applications = promoterCampaigns.length;

        // Get conversions for this campaign
        const conversions = await this.transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.campaignId = :campaignId', {
            campaignId: campaign.id,
          })
          .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
          .andWhere('transaction.status = :status', { status: 'COMPLETED' })
          .getCount();

        return {
          id: campaign.id,
          title: campaign.title,
          type: campaign.type as 'VISIBILITY' | 'SALESMAN' | 'CONSULTANT',
          status: campaign.status as
            | 'ONGOING'
            | 'AWAITING_PROMOTER'
            | 'COMPLETED'
            | 'PAUSED',
          views: totalViews,
          spent: totalSpent,
          applications,
          conversions,
          deadline: campaign.deadline
            ? new Date(campaign.deadline).toISOString()
            : '',
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        };
      }),
    );
    return campaignData;
  }

  async getCampaignsList(
    firebaseUid: string,
    request: AdvertiserCampaignListRequest = {},
  ): Promise<AdvertiserCampaignListResponse> {
    // Find advertiser by Firebase UID
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('campaign.advertiserId = :advertiserId', {
        advertiserId: advertiser.id,
      });

    // Apply filters
    if (request.status && request.status.length > 0) {
      query = query.andWhere('campaign.status IN (:...statuses)', {
        statuses: request.status,
      });
    }

    if (request.type && request.type.length > 0) {
      query = query.andWhere('campaign.type IN (:...types)', {
        types: request.type,
      });
    }

    if (request.dateRange) {
      if (request.dateRange.startDate) {
        query = query.andWhere('campaign.createdAt >= :startDate', {
          startDate: request.dateRange.startDate,
        });
      }
      if (request.dateRange.endDate) {
        query = query.andWhere('campaign.createdAt <= :endDate', {
          endDate: request.dateRange.endDate,
        });
      }
    }

    if (request.budgetRange) {
      if (request.budgetRange.minBudget) {
        query = query.andWhere(
          '(campaign.minBudget >= :minBudget OR campaign.cpv >= :minCpv)',
          {
            minBudget: request.budgetRange.minBudget,
            minCpv: request.budgetRange.minBudget,
          },
        );
      }
      if (request.budgetRange.maxBudget) {
        query = query.andWhere(
          '(campaign.maxBudget <= :maxBudget OR campaign.cpv <= :maxCpv)',
          {
            maxBudget: request.budgetRange.maxBudget,
            maxCpv: request.budgetRange.maxBudget,
          },
        );
      }
    }

    if (request.searchQuery) {
      query = query.andWhere(
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)',
        { search: `%${request.searchQuery}%` },
      );
    }

    if (request.isPublic !== undefined) {
      query = query.andWhere('campaign.isPublic = :isPublic', {
        isPublic: request.isPublic,
      });
    }

    // Apply sorting
    const sortBy = request.sortBy || AdvertiserCampaignSortField.CREATED_AT;
    const sortOrder = request.sortOrder || 'desc';

    switch (sortBy) {
      case AdvertiserCampaignSortField.TITLE:
        query = query.orderBy(
          'campaign.title',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case AdvertiserCampaignSortField.STATUS:
        query = query.orderBy(
          'campaign.status',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case AdvertiserCampaignSortField.DEADLINE:
        query = query.orderBy(
          'campaign.deadline',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case AdvertiserCampaignSortField.UPDATED_AT:
        query = query.orderBy(
          'campaign.updatedAt',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      default:
        query = query.orderBy(
          'campaign.createdAt',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
    }

    // Get total count for pagination
    const totalCount = await query.getCount();
    const totalPages = Math.ceil(totalCount / limit);

    // Get campaigns with pagination
    const campaigns = await query.skip(skip).take(limit).getMany();

    // Transform campaigns to CampaignAdvertiser format
    const campaignAdvertisers = await Promise.all(
      campaigns.map(async (campaign) =>
        this.transformToCampaignAdvertiser(campaign),
      ),
    );

    // Calculate summary
    const summary = await this.calculateCampaignSummary(advertiser.id);

    return {
      campaigns: campaignAdvertisers,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      summary,
    };
  }

  async getDashboardSummary(
    firebaseUid: string,
  ): Promise<AdvertiserDashboardSummary> {
    // Find advertiser by Firebase UID
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    const advertiserId = advertiser.id;

    // Get campaign counts
    const totalCampaigns = await this.campaignRepository.count({
      where: { advertiserId },
    });

    const activeCampaigns = await this.campaignRepository.count({
      where: { advertiserId, status: CampaignStatus.ACTIVE },
    });

    const completedCampaigns = await this.campaignRepository.count({
      where: { advertiserId, status: CampaignStatus.ENDED },
    });

    const draftCampaigns = await this.campaignRepository.count({
      where: { advertiserId, status: CampaignStatus.PAUSED },
    }); // Get financial summary
    const financialData = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select([
        'SUM(CASE WHEN transaction.type IN (:...spentTypes) THEN transaction.amount ELSE 0 END) as totalSpent',
        'SUM(CASE WHEN transaction.type IN (:...allocatedTypes) THEN transaction.amount ELSE 0 END) as totalAllocated',
      ])
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .setParameters({
        spentTypes: [
          'CONSULTANT_PAYMENT',
          'SALESMAN_COMMISSION',
          'VIEW_EARNING',
        ],
        allocatedTypes: ['DIRECT_PAYMENT'], // Using available transaction types
      })
      .getRawOne()) as
      | { totalSpent: string; totalAllocated: string }
      | undefined;

    const totalSpent = parseFloat(financialData?.totalSpent || '0');
    const totalAllocated = parseFloat(financialData?.totalAllocated || '0');
    const remainingBudget = totalAllocated - totalSpent;

    // Get monthly spend (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySpend = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :startOfMonth', { startOfMonth })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as { total: string } | undefined;

    // Get performance metrics
    const performanceData = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select([
        'SUM(pc.viewsGenerated) as totalViews',
        'COUNT(CASE WHEN campaign.type = :salesmanType THEN 1 END) as totalSales',
      ])
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .setParameter('salesmanType', CampaignType.SALESMAN)
      .getRawOne()) as { totalViews: string; totalSales: string } | undefined;

    const totalViews = parseInt(performanceData?.totalViews || '0');
    const totalSales = parseInt(performanceData?.totalSales || '0');

    // Get recent applications (last 10)
    const recentApplications = await this.getRecentApplications(
      advertiserId,
      5,
    );

    // Get recent completions (last 5)
    const recentCompletions = await this.getRecentCompletions(advertiserId, 5);

    // Get top performing campaigns (top 3)
    const topPerformingCampaigns = await this.getTopPerformingCampaigns(
      advertiserId,
      3,
    );

    return {
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      draftCampaigns,
      totalSpent,
      totalAllocated,
      remainingBudget,
      monthlySpend: parseFloat(monthlySpend?.total || '0'),
      totalViews,
      totalSales,
      totalRevenue: totalSpent, // For now, revenue = spent amount
      recentApplications,
      recentCompletions,
      topPerformingCampaigns,
    };
  }
  getCampaignFilters(): { statuses: CampaignStatus[]; types: CampaignType[] } {
    return {
      statuses: Object.values(CampaignStatus),
      types: Object.values(CampaignType),
    };
  }

  // Helper methods
  private async transformToCampaignAdvertiser(
    campaign: CampaignEntity,
  ): Promise<CampaignAdvertiser> {
    // Get promoter applications for this campaign
    const promoterCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.promoter', 'promoter')
      .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
      .getMany();

    // Calculate performance metrics
    const totalViews = promoterCampaigns.reduce(
      (sum, pc) => sum + pc.viewsGenerated,
      0,
    );
    const totalSales = promoterCampaigns.filter(
      (pc) => pc.campaign?.type === CampaignType.SALESMAN,
    ).length;

    // Transform promoter campaigns to PromoterApplicationInfo
    const promoters: PromoterApplicationInfo[] = promoterCampaigns.map(
      (pc) => ({
        promoter: this.transformUserToPromoter(pc.promoter),
        status: pc.status,
        viewsGenerated: pc.viewsGenerated,
        joinedAt: pc.joinedAt,
        earnings: pc.earnings,
      }),
    );

    // Build campaign details based on type
    const campaignDetails = this.buildCampaignDetails(campaign);

    return {
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      mediaUrl: campaign.mediaUrl,
      status: campaign.status,
      description: campaign.description,
      campaign: campaignDetails,
      performance: {
        totalViewsGained: totalViews,
        totalSalesMade: totalSales,
      },
      tags: campaign.advertiserTypes || [],
      promoters,
    };
  }

  private buildCampaignDetails(
    campaign: CampaignEntity,
  ): AdvertiserCampaignDetailsUnion {
    const baseDetails = {
      budgetHeld: 0, // Will be calculated from budget allocations
      spentBudget: 0, // Will be calculated from transactions
      targetAudience: campaign.targetAudience,
      preferredPlatforms: campaign.preferredPlatforms,
      requirements: campaign.requirements,
      createdAt: campaign.createdAt,
      deadline: campaign.deadline
        ? new Date(campaign.deadline).toISOString()
        : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      startDate: campaign.startDate
        ? new Date(campaign.startDate).toISOString()
        : new Date().toISOString(),
      isPublic: campaign.isPublic,
      discordInviteLink: campaign.discordInviteLink || '',
    };

    switch (campaign.type) {
      case CampaignType.VISIBILITY:
        return {
          ...baseDetails,
          type: CampaignType.VISIBILITY,
          maxViews: campaign.maxViews || 0,
          currentViews: campaign.currentViews || 0,
          cpv: campaign.cpv || 0,
          minFollowers: campaign.minFollowers,
          trackingLink: campaign.trackingLink || '',
        } as AdvertiserVisibilityCampaignDetails;

      case CampaignType.CONSULTANT:
        return {
          ...baseDetails,
          type: CampaignType.CONSULTANT,
          meetingPlan: campaign.meetingPlan!,
          expectedDeliverables: campaign.expectedDeliverables,
          expertiseRequired: campaign.expertiseRequired,
          meetingCount: campaign.meetingCount || 0,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
        } as AdvertiserConsultantCampaignDetails;

      case CampaignType.SELLER:
        return {
          ...baseDetails,
          type: CampaignType.SELLER,
          sellerRequirements: campaign.sellerRequirements,
          deliverables: campaign.deliverables,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
          minFollowers: campaign.minFollowers,
          needMeeting: false, // Default value
          meetingPlan: campaign.meetingPlan!,
          meetingCount: campaign.meetingCount || 0,
        } as AdvertiserSellerCampaignDetails;

      case CampaignType.SALESMAN:
        return {
          ...baseDetails,
          type: CampaignType.SALESMAN,
          commissionPerSale: campaign.commissionPerSale || 0,
          trackSalesVia: campaign.trackSalesVia!,
          codePrefix: campaign.codePrefix,
          minFollowers: campaign.minFollowers,
        } as AdvertiserSalesmanCampaignDetails;
      default:
        // This should never happen due to TypeScript exhaustiveness checking
        throw new Error(`Unsupported campaign type`);
    }
  }

  private transformUserToPromoter(user: UserEntity): Promoter {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl,
      backgroundUrl: user.backgroundUrl,
      bio: user.bio,
      rating: user.rating,
      tiktokUrl: user.tiktokUrl,
      instagramUrl: user.instagramUrl,
      snapchatUrl: user.snapchatUrl,
      youtubeUrl: user.youtubeUrl,
      twitterUrl: user.twitterUrl,
      websiteUrl: user.websiteUrl,
      works: [], // Would need to fetch from promoter works
      location: user.promoterDetails?.location,
      languagesSpoken: [], // Would need to fetch from promoter languages
      followersEstimate: [], // Would need to fetch from follower estimates
      skills: [], // Would need to fetch from promoter skills
      verified: user.promoterDetails?.verified,
      totalSales: user.promoterDetails?.totalSales,
      numberOfCampaignDone: user.promoterDetails?.numberOfCampaignDone,
      numberOfVisibilityCampaignDone: user.numberOfVisibilityCampaignDone,
      numberOfSellerCampaignDone: user.numberOfSellerCampaignDone,
      numberOfSalesmanCampaignDone: user.numberOfSalesmanCampaignDone,
      numberOfConsultantCampaignDone: user.numberOfConsultantCampaignDone,
      totalViewsGenerated: user.totalViewsGenerated,
    };
  }

  private async calculateCampaignSummary(advertiserId: string) {
    const activeCampaigns = await this.campaignRepository.count({
      where: { advertiserId, status: CampaignStatus.ACTIVE },
    });

    const completedCampaigns = await this.campaignRepository.count({
      where: { advertiserId, status: CampaignStatus.ENDED },
    });

    // Get current month's spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlySpent = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :startOfMonth', { startOfMonth })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as QueryResult | undefined;

    // Get budget information (simplified)
    const budgetData = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select([
        'SUM(CASE WHEN transaction.type IN (:...allocatedTypes) THEN transaction.amount ELSE 0 END) as allocated',
        'SUM(CASE WHEN transaction.type IN (:...spentTypes) THEN transaction.amount ELSE 0 END) as spent',
      ])
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .setParameters({
        allocatedTypes: ['DIRECT_PAYMENT'], // Using available transaction types
        spentTypes: [
          'CONSULTANT_PAYMENT',
          'SALESMAN_COMMISSION',
          'VIEW_EARNING',
        ],
      })
      .getRawOne()) as BudgetQueryResult | undefined;

    const totalAllocated = parseFloat(budgetData?.allocated || '0');
    const totalSpent = parseFloat(budgetData?.spent || '0');

    return {
      totalActiveCampaigns: activeCampaigns,
      totalCompletedCampaigns: completedCampaigns,
      totalSpentThisMonth: parseFloat(monthlySpent?.total || '0'),
      totalAllocatedBudget: totalAllocated,
      totalRemainingBudget: totalAllocated - totalSpent,
    };
  }

  private async getRecentApplications(
    advertiserId: string,
    limit: number,
  ): Promise<PromoterApplicationInfo[]> {
    const recentApplications = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.promoter', 'promoter')
      .leftJoin('pc.campaign', 'campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.status = :status', {
        status: PromoterCampaignStatus.AWAITING_REVIEW,
      })
      .orderBy('pc.joinedAt', 'DESC')
      .limit(limit)
      .getMany();

    return recentApplications.map((pc) => ({
      promoter: this.transformUserToPromoter(pc.promoter),
      status: pc.status,
      viewsGenerated: pc.viewsGenerated,
      joinedAt: pc.joinedAt,
      earnings: pc.earnings,
    }));
  }

  private async getRecentCompletions(advertiserId: string, limit: number) {
    const recentCompletions = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.promoter', 'promoter')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.status = :status', {
        status: PromoterCampaignStatus.COMPLETED,
      })
      .orderBy('pc.completedAt', 'DESC')
      .limit(limit)
      .getMany();

    return recentCompletions.map((pc) => ({
      campaignId: pc.campaignId,
      campaignTitle: pc.campaign.title,
      promoterName: pc.promoter.name,
      completedAt: pc.completedAt!,
      earnings: pc.earnings,
    }));
  }

  private async getTopPerformingCampaigns(advertiserId: string, limit: number) {
    const topCampaigns = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select([
        'campaign.id as id',
        'campaign.title as title',
        'SUM(pc.viewsGenerated) as views',
        'COUNT(CASE WHEN campaign.type = :salesmanType THEN 1 END) as sales',
        'COUNT(pc.id) as activePromoters',
      ])
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .groupBy('campaign.id, campaign.title')
      .orderBy('views', 'DESC')
      .addOrderBy('sales', 'DESC')
      .setParameter('salesmanType', CampaignType.SALESMAN)
      .limit(limit)
      .getRawMany()) as TopCampaignQueryResult[];

    return topCampaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      views: parseInt(campaign.views) || 0,
      sales: parseInt(campaign.sales) || 0,
      activePromoters: parseInt(campaign.activePromoters) || 0,
    }));
  }

  private async getRecentTransactions(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserTransaction[]> {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.campaign', 'campaign')
      .leftJoinAndSelect('transaction.promoter', 'promoter')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .orderBy('transaction.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      status: transaction.status as
        | 'COMPLETED'
        | 'PENDING'
        | 'FAILED'
        | 'CANCELLED',
      date: transaction.createdAt.toISOString(),
      campaign: transaction.campaign?.title || 'N/A',
      campaignId: transaction.campaignId || '',
      promoter: transaction.promoter?.name,
      promoterId: transaction.promoterId,
      type: this.mapTransactionType(transaction.type),
      paymentMethod: transaction.paymentMethod as
        | 'WALLET'
        | 'CREDIT_CARD'
        | 'BANK_TRANSFER',
      description: transaction.description,
      estimatedDeliveryDate: transaction.estimatedPaymentDate?.toISOString(),
    }));
  }

  private async getRecentMessages(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserMessage[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('thread.advertiserId = :advertiserId', { advertiserId })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return messages.map((message) => ({
      id: message.id,
      name: message.sender?.name || 'Unknown',
      message: message.content,
      time: message.createdAt.toISOString(),
      avatar: message.sender?.avatarUrl,
      isRead: message.isRead,
      threadId: message.threadId,
      senderType: message.senderType as 'PROMOTER' | 'ADMIN' | 'SYSTEM',
      campaignId: message.thread?.campaignId,
    }));
  }

  private async getWalletInfo(advertiserId: string): Promise<AdvertiserWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { promoterId: advertiserId }, // Using promoterId field as that's what exists in entity
    });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = this.walletRepository.create({
        promoterId: advertiserId,
        currentBalance: 0,
        pendingBalance: 0,
      });
      await this.walletRepository.save(wallet);
    }

    // Calculate spending totals
    const totalSpent = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as QueryResult;

    const totalDeposited = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type = :type', { type: 'DIRECT_PAYMENT' })
      .getRawOne()) as QueryResult;

    const pendingPayments = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'PENDING' })
      .getRawOne()) as QueryResult;

    const totalSpentNum = parseFloat(totalSpent?.total || '0');
    const totalDepositedNum = parseFloat(totalDeposited?.total || '0');
    const pendingPaymentsNum = parseFloat(pendingPayments?.total || '0');

    return {
      balance: {
        currentBalance: wallet.currentBalance,
        pendingCharges: wallet.pendingBalance || 0,
        totalSpent: totalSpentNum,
        totalDeposited: totalDepositedNum,
        lastDepositDate: wallet.updatedAt?.toISOString(),
        minimumBalance: 100, // Set a minimum balance threshold
      },
      campaignBudgets: {
        totalAllocated: totalDepositedNum,
        totalUsed: totalSpentNum,
        pendingPayments: pendingPaymentsNum,
        lastPaymentDate: wallet.updatedAt?.toISOString(),
      },
      totalLifetimeSpent: totalSpentNum,
      totalAvailableBalance: wallet.currentBalance - pendingPaymentsNum,
    };
  }

  private mapTransactionType(
    type: string,
  ):
    | 'CAMPAIGN_PAYMENT'
    | 'PROMOTER_PAYMENT'
    | 'CONSULTANT_FEE'
    | 'COMMISSION_PAYMENT'
    | 'REFUND'
    | 'WALLET_DEPOSIT' {
    const typeMapping: Record<
      string,
      | 'CAMPAIGN_PAYMENT'
      | 'PROMOTER_PAYMENT'
      | 'CONSULTANT_FEE'
      | 'COMMISSION_PAYMENT'
      | 'REFUND'
      | 'WALLET_DEPOSIT'
    > = {
      VIEW_EARNING: 'PROMOTER_PAYMENT',
      CONSULTANT_PAYMENT: 'CONSULTANT_FEE',
      SALESMAN_COMMISSION: 'COMMISSION_PAYMENT',
      MONTHLY_PAYOUT: 'PROMOTER_PAYMENT',
      DIRECT_PAYMENT: 'CAMPAIGN_PAYMENT',
    };

    return typeMapping[type] || 'CAMPAIGN_PAYMENT';
  }
}
