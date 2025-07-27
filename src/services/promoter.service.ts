import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PromoterDashboardRequest,
  PromoterDashboardData,
  PromoterStats,
  PromoterActiveCampaign,
  PromoterSuggestedCampaign,
  PromoterTransaction,
  PromoterMessage,
  PromoterWallet,
  PromoterWalletViewEarnings,
  PromoterWalletDirectEarnings,
} from '../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
  CampaignUnion,
  Advertiser,
  BaseCampaignDetails,
  VisibilityCampaign,
  ConsultantCampaign,
  SellerCampaign,
  SalesmanCampaign,
} from '../interfaces/explore-campaign';
import {
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
  CampaignPromoter,
  CampaignDetailsUnion,
  Earnings,
  CampaignWork,
} from '../interfaces/promoter-campaigns';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from '../interfaces/campaign-actions';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../database/entities/campaign-applications.entity';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { UserType } from 'src/enums/user-type';
import { CampaignWorkEntity } from 'src/database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from 'src/database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from 'src/database/entities/campaign-deliverable.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';

@Injectable()
export class PromoterService {
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
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
    @InjectRepository(CampaignWorkEntity)
    private readonly workRepository: Repository<CampaignWorkEntity>,

    @InjectRepository(CampaignWorkCommentEntity)
    private readonly commentRepository: Repository<CampaignWorkCommentEntity>,

    @InjectRepository(CampaignDeliverableEntity)
    private readonly deliverableRepository: Repository<CampaignDeliverableEntity>,
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepository: Repository<UniqueViewEntity>,
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: PromoterDashboardRequest,
  ): Promise<PromoterDashboardData> {
    const data: PromoterDashboardData = {};

    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    const promoterId = promoter.id;

    // Get actual data from database
    if (request.includeStats) {
      data.stats = await this.getPromoterStats(promoterId);
    }

    if (request.includeCampaigns) {
      data.activeCampaigns = await this.getActiveCampaigns(
        promoterId,
        request.activeCampaignLimit || 10,
      );
    }

    if (request.includeSuggestions) {
      data.suggestedCampaigns = await this.getSuggestedCampaigns(
        promoterId,
        request.suggestedCampaignLimit || 5,
      );
    }

    if (request.includeTransactions) {
      data.recentTransactions = await this.getRecentTransactions(
        promoterId,
        request.transactionLimit || 5,
      );
    }

    if (request.includeMessages) {
      data.recentMessages = await this.getRecentMessages(
        promoterId,
        request.messageLimit || 5,
      );
    }

    if (request.includeWallet) {
      data.wallet = await this.getWalletInfo(promoterId);
    }

    return data;
  }

  private async getPromoterStats(promoterId: string): Promise<PromoterStats> {
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

    const earningsThisWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const earningsLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const viewsToday = await this.uniqueViewRepository
      .createQueryBuilder('uv')
      .select('COUNT(*)', 'total')
      .where('uv.promoterId = :promoterId', { promoterId })
      .andWhere('uv.createdAt >= :startOfToday', { startOfToday })
      .getRawOne();

    const viewsYesterday = await this.uniqueViewRepository
      .createQueryBuilder('uv')
      .select('COUNT(*)', 'total')
      .where('uv.promoterId = :promoterId', { promoterId })
      .andWhere('uv.createdAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('uv.createdAt < :startOfToday', { startOfToday })
      .getRawOne();

    const salesThisWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const salesLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const activeCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'ONGOING' })
      .getCount();

    const pendingReviewCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
      .getCount();

    const earningsThisWeekNum = parseFloat(
      (earningsThisWeek as { total?: string })?.total || '0',
    );
    const earningsLastWeekNum = parseFloat(
      (earningsLastWeek as { total?: string })?.total || '0',
    );
    const viewsTodayNum = parseInt(
      (viewsToday as { total?: string })?.total || '0',
    );
    const viewsYesterdayNum = parseInt(
      (viewsYesterday as { total?: string })?.total || '0',
    );
    const salesThisWeekNum = parseInt(
      (salesThisWeek as { total?: string })?.total || '0',
    );
    const salesLastWeekNum = parseInt(
      (salesLastWeek as { total?: string })?.total || '0',
    );

    return {
      earningsThisWeek: earningsThisWeekNum,
      earningsLastWeek: earningsLastWeekNum,
      earningsPercentageChange:
        earningsLastWeekNum > 0
          ? ((earningsThisWeekNum - earningsLastWeekNum) /
              earningsLastWeekNum) *
            100
          : 0,
      viewsToday: viewsTodayNum,
      viewsYesterday: viewsYesterdayNum,
      viewsPercentageChange:
        viewsYesterdayNum > 0
          ? ((viewsTodayNum - viewsYesterdayNum) / viewsYesterdayNum) * 100
          : 0,
      salesThisWeek: salesThisWeekNum,
      salesLastWeek: salesLastWeekNum,
      salesPercentageChange:
        salesLastWeekNum > 0
          ? ((salesThisWeekNum - salesLastWeekNum) / salesLastWeekNum) * 100
          : 0,
      activeCampaigns,
      pendingReviewCampaigns,
    };
  }

  private async getActiveCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<PromoterActiveCampaign[]> {
    const promoterCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'ONGOING' })
      .orderBy('pc.updatedAt', 'DESC')
      .limit(limit)
      .getMany();
    return promoterCampaigns.map((pc) => ({
      id: pc.campaign.id,
      title: pc.campaign.title,
      type: pc.campaign.type,
      status: pc.status,
      views: pc.viewsGenerated,
      earnings: pc.earnings,
      advertiser: pc.campaign.advertiser?.name || 'Unknown',
      deadline: pc.campaign.deadline
        ? new Date(pc.campaign.deadline).toISOString()
        : undefined,
      createdAt: pc.campaign.createdAt
        ? new Date(pc.campaign.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: pc.updatedAt
        ? new Date(pc.updatedAt).toISOString()
        : new Date().toISOString(),
    }));
  }

  private async getSuggestedCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<PromoterSuggestedCampaign[]> {
    // First, get campaign IDs that the promoter has already joined
    const joinedCampaignIds = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('pc.campaignId')
      .where('pc.promoterId = :promoterId', { promoterId })
      .getRawMany();

    const joinedIds = joinedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );

    // Get campaigns that are active and public, not already joined by the promoter
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('campaign.status = :status', { status: 'ACTIVE' });

    // Exclude campaigns the promoter has already joined
    if (joinedIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...joinedIds)', {
        joinedIds,
      });
    }

    const campaigns = await query
      .orderBy('campaign.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      cpv: campaign.cpv,
      budget: this.getCampaignBudget(campaign),
      advertiser: campaign.advertiser?.name || 'Unknown',
      tags: this.getCampaignTags(campaign),
      description: campaign.description,
      requirements: this.getCampaignRequirements(campaign),
      estimatedEarnings: this.calculateEstimatedEarnings(campaign),
      applicationDeadline: campaign.deadline
        ? new Date(campaign.deadline).toISOString()
        : undefined,
    }));
  }

  private async getRecentTransactions(
    promoterId: string,
    limit: number,
  ): Promise<PromoterTransaction[]> {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.campaign', 'campaign')
      .where('transaction.userId = :promoterId', { promoterId })
      .orderBy('transaction.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      status: transaction.status,
      date: transaction.createdAt.toISOString(),
      campaign: transaction.campaign?.title || 'N/A',
      campaignId: transaction.campaignId,
      type: transaction.type,
      paymentMethod: transaction.paymentMethod?.toString() || 'N/A',
      description: transaction.description,
      estimatedPaymentDate: transaction.estimatedPaymentDate?.toISOString(),
    }));
  }

  private async getRecentMessages(
    promoterId: string,
    limit: number,
  ): Promise<PromoterMessage[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('thread.promoterId = :promoterId', { promoterId })
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
      senderType: message.senderType,
      campaignId: message.thread?.campaignId || '',
    }));
  }

  private async getWalletInfo(promoterId: string): Promise<PromoterWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId: promoterId, userType: UserType.PROMOTER },
    });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = this.walletRepository.create({
        userId: promoterId,
        userType: UserType.PROMOTER,
        currentBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        minimumThreshold: 20,
        directTotalEarned: 0,
        directTotalPaid: 0,
        directPendingPayments: 0,
      });
      await this.walletRepository.save(wallet);
    }

    const viewEarnings: PromoterWalletViewEarnings = {
      currentBalance: wallet.currentBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn,
      lastPayoutDate: wallet.lastPayoutDate?.toISOString(),
      nextPayoutDate: wallet.nextPayoutDate?.toISOString(),
      minimumThreshold: wallet.minimumThreshold || 20,
    };

    const directEarnings: PromoterWalletDirectEarnings = {
      totalEarned: wallet.directTotalEarned || 0,
      totalPaid: wallet.directTotalPaid || 0,
      pendingPayments: wallet.directPendingPayments || 0,
      lastPaymentDate: wallet.directLastPaymentDate?.toISOString(),
    };

    return {
      viewEarnings,
      directEarnings,
      totalLifetimeEarnings:
        Number(wallet.totalEarned) + Number(wallet.directTotalEarned),
      totalAvailableBalance: wallet.currentBalance,
    };
  }

  private getCampaignTags(campaign: CampaignEntity): string[] {
    const tags: string[] = [];

    if (campaign.type === CampaignType.VISIBILITY) {
      tags.push('Views', 'Promotion');
    } else if (campaign.type === CampaignType.CONSULTANT) {
      tags.push('Consulting', 'Expert');
    } else if (campaign.type === CampaignType.SALESMAN) {
      tags.push('Sales', 'Commission');
    }

    return tags;
  }

  private getCampaignRequirements(campaign: CampaignEntity): string[] {
    const requirements: string[] = [];

    if (campaign.type === CampaignType.VISIBILITY) {
      requirements.push('Active social media presence');
    } else if (campaign.type === CampaignType.CONSULTANT) {
      requirements.push('Relevant expertise');
    } else if (campaign.type === CampaignType.SALESMAN) {
      requirements.push('Sales experience');
    }

    return requirements;
  }

  private calculateEstimatedEarnings(campaign: CampaignEntity): number {
    if (campaign.type === CampaignType.VISIBILITY && campaign.cpv) {
      return campaign.cpv * 100; // Assuming 100 views as baseline
    }
    return 0;
  }
  private getCampaignBudget(campaign: CampaignEntity): number | undefined {
    if (
      campaign.type === CampaignType.CONSULTANT ||
      campaign.type === CampaignType.SELLER
    ) {
      return campaign.maxBudget;
    }
    // For VISIBILITY and SALESMAN campaigns, calculate budget based on their specific fields
    if (
      campaign.type === CampaignType.VISIBILITY &&
      campaign.cpv &&
      campaign.maxViews
    ) {
      return (campaign.cpv * campaign.maxViews) / 100; // Convert per 100 views to total budget
    }
    return undefined;
  }

  async getExploreCampaigns(
    firebaseUid: string,
    request: ExploreCampaignRequest,
  ): Promise<ExploreCampaignResponse> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;
    const searchTerm = request.searchTerm || '';
    const sortBy = request.sortBy || 'newest';

    // Get campaign IDs that the promoter has already joined
    const joinedCampaignIds = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('pc.campaignId', 'campaignId')
      .where('pc.promoterId = :promoterId', { promoterId: promoter.id })
      .getRawMany();

    // Get campaign IDs that the promoter has already applied for
    const appliedCampaignIds = await this.campaignApplicationRepository
      .createQueryBuilder('ca')
      .select('ca.campaignId', 'campaignId')
      .where('ca.promoterId = :promoterId', { promoterId: promoter.id })
      .getRawMany();

    const joinedIds = joinedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );
    const appliedIds = appliedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    ); // Combine both arrays to exclude campaigns that the promoter has joined OR applied for
    const excludedCampaignIds = [...new Set([...joinedIds, ...appliedIds])]; // Get private campaigns that are already taken by other promoters
    // Private campaigns (isPublic = false) can only have one promoter, so exclude them if taken
    // Public campaigns (isPublic = true) can have multiple promoters, so don't exclude them
    const takenPrivateCampaignIds = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .innerJoin('pc.campaign', 'campaign')
      .select('pc.campaignId', 'campaignId')
      .where('campaign.isPublic = :isPublic', { isPublic: false })
      .andWhere('pc.promoterId != :promoterId', { promoterId: promoter.id })
      .getRawMany();

    const takenPrivateIds = takenPrivateCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );

    // Combine all exclusions: already interacted with + taken private campaigns
    const allExcludedCampaignIds = [
      ...new Set([...excludedCampaignIds, ...takenPrivateIds]),
    ];

    // Build query for campaigns the promoter hasn't joined or applied for
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('campaign.promoterCampaigns', 'promoterCampaigns')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE });

    // Exclude campaigns the promoter has already joined, applied for, or private campaigns taken by others
    if (allExcludedCampaignIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...excludedCampaignIds)', {
        excludedCampaignIds: allExcludedCampaignIds,
      });
    } // Apply search filter
    if (searchTerm) {
      query = query.andWhere(
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Apply type filter
    if (request.typeFilter && request.typeFilter.length > 0) {
      query = query.andWhere('campaign.type IN (:...types)', {
        types: request.typeFilter,
      });
    }

    // Apply advertiser type filter
    if (request.advertiserTypes && request.advertiserTypes.length > 0) {
      query = query.andWhere('campaign.advertiserTypes && :advertiserTypes', {
        advertiserTypes: request.advertiserTypes,
      });
    } // Apply sorting
    switch (sortBy) {
      case 'newest':
        query = query.orderBy('campaign.createdAt', 'DESC');
        break;
      case 'deadline':
        query = query.orderBy('campaign.deadline', 'ASC');
        break;
      case 'budget':
        query = query.orderBy('campaign.budgetAllocated', 'DESC');
        break;
      case 'applicants':
        // This would require a subquery to count applications
        query = query.orderBy('campaign.createdAt', 'DESC');
        break;
      default:
        query = query.orderBy('campaign.createdAt', 'DESC');
    }

    const totalCount = await query.getCount();
    const totalPages = Math.ceil(totalCount / limit);
    const campaigns = await query.skip(skip).take(limit).getMany(); // Transform campaigns to the required format
    const transformedCampaigns: CampaignUnion[] = campaigns.map((campaign) =>
      this.transformCampaignToUnion(campaign, promoter.id),
    );

    return {
      campaigns: transformedCampaigns,
      page,
      totalPages,
      totalCount,
      sortBy,
      searchTerm,
      typeFilter: request.typeFilter || [],
      advertiserTypes: request.advertiserTypes || [],
    };
  }
  private transformCampaignToUnion(
    campaign: CampaignEntity,
    promoterId: string,
  ): CampaignUnion {
    const advertiser: Advertiser = {
      id: campaign.advertiser.id,
      companyName: campaign.advertiser.name || 'Unknown Company',
      profileUrl: campaign.advertiser.avatarUrl,
      rating: campaign.advertiser.rating || 0,
      verified: true, // You may want to add a verified field to UserEntity
      description: campaign.advertiser.bio || '',
      website: campaign.advertiser.websiteUrl || '',
      advertiserTypes: campaign.advertiserTypes || [],
    };

    const baseCampaign: BaseCampaignDetails = {
      id: campaign.id,
      advertiser,
      title: campaign.title,
      type: campaign.type,
      mediaUrl: campaign.mediaUrl,
      status:
        campaign.promoterCampaigns?.find((pm) => pm.promoterId === promoterId)
          ?.status || PromoterCampaignStatus.ONGOING,
      description: campaign.description,
      targetAudience: campaign.targetAudience,
      preferredPlatforms: campaign.preferredPlatforms,
      requirements: campaign.requirements,
      createdAt: campaign.createdAt,
      deadline: campaign.deadline
        ? new Date(campaign.deadline).toISOString()
        : '',
      startDate: campaign.startDate
        ? new Date(campaign.startDate).toISOString()
        : '',
      isPublic: campaign.isPublic,
      tags: campaign.advertiserTypes || [],
      campaignStatus: campaign.status,
    };

    switch (campaign.type) {
      case CampaignType.VISIBILITY:
        return {
          ...baseCampaign,
          type: CampaignType.VISIBILITY,
          maxViews: campaign.maxViews || 0,
          currentViews: campaign.currentViews || 0,
          cpv: campaign.cpv || 0,
          minFollowers: campaign.minFollowers,
        } as VisibilityCampaign;

      case CampaignType.CONSULTANT:
        return {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: campaign.meetingPlan!,
          expectedDeliverables: campaign.expectedDeliverables.map(
            (cd) => cd.deliverable,
          ),
          expertiseRequired: campaign.expertiseRequired,
          meetingCount: campaign.meetingCount || 0,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
        } as ConsultantCampaign;

      case CampaignType.SELLER:
        return {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: campaign.sellerRequirements,
          deliverables: campaign.deliverables.map((cd) => cd.deliverable),
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
          minFollowers: campaign.minFollowers,
          needMeeting: campaign.needMeeting || false,
          meetingPlan: campaign.meetingPlan!,
          meetingCount: campaign.meetingCount || 0,
        } as SellerCampaign;

      case CampaignType.SALESMAN:
        return {
          ...baseCampaign,
          type: CampaignType.SALESMAN,
          commissionPerSale: campaign.commissionPerSale || 0,
          trackSalesVia: campaign.trackSalesVia!,
          codePrefix: campaign.codePrefix,
          refLink: campaign.trackingLink,
          minFollowers: campaign.minFollowers,
        } as SalesmanCampaign;
      default: {
        // This should never happen with proper TypeScript typing
        const exhaustiveCheck: never = campaign.type;
        throw new Error(
          `Unsupported campaign type: ${String(exhaustiveCheck)}`,
        );
      }
    }
  }
  async getPromoterCampaigns(
    firebaseUid: string,
    request: GetPromoterCampaignsRequest,
  ): Promise<PromoterCampaignsListResponse> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;
    const searchTerm = request.searchTerm || '';
    const sortBy = request.sortBy || 'newest';
    const sortOrder = request.sortOrder || 'desc';

    // Get joined campaigns (from PromoterCampaign entity)
    let joinedQuery = this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('deliverables.promoterWork', 'promoterWork')
      .leftJoinAndSelect('promoterWork.comments', 'comments')
      .where('pc.promoterId = :promoterId', { promoterId: promoter.id });

    // Get applied campaigns (from CampaignApplicationEntity)
    let appliedQuery = this.campaignApplicationRepository
      .createQueryBuilder('ca')
      .leftJoinAndSelect('ca.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('deliverables.promoterWork', 'promoterWork')
      .leftJoinAndSelect('promoterWork.comments', 'comments')
      .where('ca.promoterId = :promoterId', { promoterId: promoter.id });

    // Apply status filter
    if (request.status && request.status.length > 0) {
      // For joined campaigns, filter by PromoterCampaign status
      joinedQuery = joinedQuery.andWhere('pc.status IN (:...statuses)', {
        statuses: request.status,
      });

      // For applied campaigns, only include PENDING applications when AWAITING_REVIEW is requested
      // ACCEPTED applications should not be included as they will appear as joined campaigns
      if (request.status.includes(PromoterCampaignStatus.AWAITING_REVIEW)) {
        appliedQuery = appliedQuery.andWhere('ca.status = :appStatus', {
          appStatus: ApplicationStatus.PENDING,
        });
      } else {
        // If specific statuses are requested that don't apply to applications, exclude them
        appliedQuery = appliedQuery.andWhere('1 = 0'); // This will exclude all applications
      }
    } else {
      // When no status filter is applied, still exclude ACCEPTED applications to avoid duplicates
      appliedQuery = appliedQuery.andWhere('ca.status != :acceptedStatus', {
        acceptedStatus: ApplicationStatus.ACCEPTED,
      });
    }

    // Apply campaign type filter to both queries
    if (request.type && request.type.length > 0) {
      joinedQuery = joinedQuery.andWhere('campaign.type IN (:...types)', {
        types: request.type,
      });
      appliedQuery = appliedQuery.andWhere('campaign.type IN (:...types)', {
        types: request.type,
      });
    }

    // Apply search filter to both queries
    if (searchTerm) {
      const searchCondition =
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)';
      const searchParams = { search: `%${searchTerm}%` };

      joinedQuery = joinedQuery.andWhere(searchCondition, searchParams);
      appliedQuery = appliedQuery.andWhere(searchCondition, searchParams);
    }

    // Execute both queries
    const [joinedCampaigns, appliedCampaigns] = await Promise.all([
      joinedQuery.getMany(),
      appliedQuery.getMany(),
    ]);

    // Create typed objects for combined results
    type CombinedCampaign =
      | {
          source: 'joined';
          data: PromoterCampaign;
          sortDate: Date;
        }
      | {
          source: 'applied';
          data: CampaignApplicationEntity & { campaign: CampaignEntity };
          sortDate: Date;
        };

    const allCampaigns: CombinedCampaign[] = [
      ...joinedCampaigns.map((pc) => ({
        source: 'joined' as const,
        data: pc,
        sortDate: pc.joinedAt,
      })),
      ...appliedCampaigns.map((ca) => ({
        source: 'applied' as const,
        data: ca as CampaignApplicationEntity & { campaign: CampaignEntity },
        sortDate: ca.appliedAt,
      })),
    ];

    // Apply sorting to combined results
    allCampaigns.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'newest':
          aValue = a.sortDate;
          bValue = b.sortDate;
          break;
        case 'deadline':
          aValue = a.data.campaign.deadline;
          bValue = b.data.campaign.deadline;
          break;
        case 'earnings':
          aValue = a.source === 'joined' ? a.data.earnings : 0;
          bValue = b.source === 'joined' ? b.data.earnings : 0;
          break;
        case 'title':
          aValue = a.data.campaign.title;
          bValue = b.data.campaign.title;
          break;
        default:
          aValue = a.sortDate;
          bValue = b.sortDate;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const totalCount = allCampaigns.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedCampaigns = allCampaigns.slice(skip, skip + limit);

    // Transform campaigns to the required format
    const transformedCampaigns: CampaignPromoter[] = paginatedCampaigns.map(
      (item) => {
        if (item.source === 'joined') {
          return this.transformPromoterCampaignToInterface(
            item.data,
            promoter.id,
          );
        } else {
          return this.transformCampaignApplicationToInterface(
            item.data,
            promoter.id,
          );
        }
      },
    );

    // Calculate summary (including both joined and applied campaigns)
    const summary =
      await this.calculatePromoterCampaignsSummaryWithApplications(promoter.id);

    return {
      campaigns: transformedCampaigns,
      page,
      totalPages,
      totalCount,
      summary,
    };
  }

  private async mapPromoterLinks(
    campaign: CampaignEntity,
  ): Promise<CampaignWork[]> {
    // Since campaigns no longer have direct promoterWork relationships,
    // we need to get work through deliverables
    const deliverables = await this.deliverableRepository.find({
      where: { campaignId: campaign.id },
      relations: ['promoterWork', 'promoterWork.comments'],
    });

    const allWork: CampaignWork[] = [];

    for (const deliverable of deliverables) {
      for (const work of deliverable.promoterWork) {
        allWork.push({
          id: work.id,
          campaignId: campaign.id, // Use the campaign ID from the parameter
          promoterLink: work.promoterLink,
          description: work.description,
          createdAt: work.createdAt,
          updatedAt: work.updatedAt,
          comments:
            work.comments?.map((c: CampaignWorkCommentEntity) => ({
              id: c.id,
              workId: c.workId,
              commentMessage: c.commentMessage,
              commentatorId: c.commentatorId,
              commentatorName: c.commentatorName,
              createdAt: c.createdAt,
            })) ?? [],
        });
      }
    }

    return allWork;
  }

  // private async getDeliverablesForCampaign(
  //   campaign: CampaignEntity,
  // ): Promise<import('../enums/deliverable').Deliverable[]> {
  //   const deliverables = await this.deliverableRepository.find({
  //     where: { campaignId: campaign.id },
  //     select: ['deliverable'],
  //   });

  //   return deliverables.map((d) => d.deliverable);
  // }

  private transformPromoterCampaignToInterface(
    pc: PromoterCampaign,
    promoterId: string,
  ): CampaignPromoter {
    const advertiser: Advertiser = {
      id: pc.campaign.advertiser.id,
      companyName: pc.campaign.advertiser.name || 'Unknown Company',
      profileUrl: pc.campaign.advertiser.avatarUrl,
      rating: pc.campaign.advertiser.rating || 0,
      verified: true, // You may want to add a verified field to UserEntity
      description: pc.campaign.advertiser.bio || '',
      website: pc.campaign.advertiser.websiteUrl || '',
      advertiserTypes: pc.campaign.advertiserTypes || [],
    };

    const earnings: Earnings = {
      totalEarned: Number(pc.earnings),
      viewsGenerated: pc.viewsGenerated,
      projectedTotal: this.calculateProjectedEarnings(pc),
    };

    const baseCampaign = {
      budgetHeld: Number(pc.campaign.budgetAllocated),
      spentBudget: Number(pc.spentBudget),
      targetAudience: pc.campaign.targetAudience,
      preferredPlatforms: pc.campaign.preferredPlatforms,
      requirements: pc.campaign.requirements,
      createdAt: pc.campaign.createdAt,
      deadline: pc.campaign.deadline
        ? new Date(pc.campaign.deadline).toISOString()
        : '',
      startDate: pc.campaign.startDate
        ? new Date(pc.campaign.startDate).toISOString()
        : '',
      isPublic: pc.campaign.isPublic,
      discordInviteLink: pc.campaign.discordInviteLink || '',
    };

    let campaignDetails: CampaignDetailsUnion;

    switch (pc.campaign.type) {
      case CampaignType.VISIBILITY:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.VISIBILITY,
          maxViews: pc.campaign.maxViews || 0,
          currentViews: pc.viewsGenerated, // Use promoter's generated views
          cpv: pc.campaign.cpv || 0,
          minFollowers: pc.campaign.minFollowers,
          trackingLink: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/visit/${pc.campaign.id}/${promoterId}`,
        };
        break;

      case CampaignType.CONSULTANT:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: pc.campaign.meetingPlan!,
          expectedDeliverables: pc.campaign.expectedDeliverables.map((cd) => ({
            id: cd.id,
            campaignId: cd.campaignId,
            deliverable: cd.deliverable,
            isSubmitted: cd.isSubmitted,
            isFinished: cd.isFinished,
            createdAt: cd.createdAt,
            updatedAt: cd.updatedAt,
            promoterWork:
              cd.promoterWork?.map((work) => ({
                id: work.id,
                deliverableId: work.deliverableId,
                promoterLink: work.promoterLink,
                description: work.description,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
                comments:
                  work.comments?.map((comment) => ({
                    id: comment.id,
                    workId: comment.workId,
                    commentMessage: comment.commentMessage,
                    commentatorId: comment.commentatorId,
                    commentatorName: comment.commentatorName,
                    createdAt: comment.createdAt,
                  })) || [],
              })) || [],
          })),
          expertiseRequired: pc.campaign.expertiseRequired,
          meetingCount: pc.campaign.meetingCount || 0,
          maxBudget: pc.campaign.maxBudget || 0,
          minBudget: pc.campaign.minBudget || 0,
        };
        break;

      case CampaignType.SELLER:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: pc.campaign.sellerRequirements,
          deliverables: pc.campaign.deliverables.map((cd) => ({
            id: cd.id,
            campaignId: cd.campaignId,
            deliverable: cd.deliverable,
            isSubmitted: cd.isSubmitted,
            isFinished: cd.isFinished,
            createdAt: cd.createdAt,
            updatedAt: cd.updatedAt,
            promoterWork:
              cd.promoterWork?.map((work) => ({
                id: work.id,
                deliverableId: work.deliverableId,
                promoterLink: work.promoterLink,
                description: work.description,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
                comments:
                  work.comments?.map((comment) => ({
                    id: comment.id,
                    workId: comment.workId,
                    commentMessage: comment.commentMessage,
                    commentatorId: comment.commentatorId,
                    commentatorName: comment.commentatorName,
                    createdAt: comment.createdAt,
                  })) || [],
              })) || [],
          })),
          fixedPrice: undefined, // Not in current schema
          maxBudget: pc.campaign.maxBudget || 0,
          minBudget: pc.campaign.minBudget || 0,
          minFollowers: pc.campaign.minFollowers,
          needMeeting: pc.campaign.needMeeting || false,
          meetingPlan: pc.campaign.meetingPlan!,
          meetingCount: pc.campaign.meetingCount || 0,
        };
        break;

      case CampaignType.SALESMAN:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.SALESMAN,
          commissionPerSale: pc.campaign.commissionPerSale || 0,
          trackSalesVia: pc.campaign.trackSalesVia!,
          codePrefix: pc.campaign.codePrefix,
          refLink: pc.campaign.trackingLink,
          minFollowers: pc.campaign.minFollowers,
        };
        break;
      default:
        throw new Error(
          `Unsupported campaign type: ${String(pc.campaign.type)}`,
        );
    }
    return {
      id: pc.campaign.id,
      title: pc.campaign.title,
      type: pc.campaign.type,
      mediaUrl: pc.campaign.mediaUrl,
      status: pc.status,
      description: pc.campaign.description,
      advertiser,
      campaign: campaignDetails,
      earnings,
      tags: pc.campaign.advertiserTypes || [],
      meetingDone: false, // You may want to add this logic based on meeting requirements
    };
  }

  private calculateProjectedEarnings(pc: PromoterCampaign): number {
    // Simple projection based on current earnings and campaign progress
    if (
      pc.campaign.type === CampaignType.VISIBILITY &&
      pc.campaign.maxViews &&
      pc.campaign.cpv
    ) {
      const maxPossibleEarnings =
        (pc.campaign.maxViews / 100) * pc.campaign.cpv;
      return maxPossibleEarnings;
    }

    if (
      pc.campaign.type === CampaignType.CONSULTANT ||
      pc.campaign.type === CampaignType.SELLER
    ) {
      return pc.campaign.maxBudget || Number(pc.earnings);
    }

    return Number(pc.earnings);
  }

  private async calculatePromoterCampaignsSummary(promoterId: string) {
    const summaryQuery = this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .where('pc.promoterId = :promoterId', { promoterId });

    const [totalActive, totalPending, totalCompleted] = await Promise.all([
      summaryQuery
        .clone()
        .andWhere('pc.status = :status', { status: 'ONGOING' })
        .getCount(),
      summaryQuery
        .clone()
        .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
        .getCount(),
      summaryQuery
        .clone()
        .andWhere('pc.status = :status', { status: 'COMPLETED' })
        .getCount(),
    ]);
    const earningsAndViews:
      | { totalEarnings: string; totalViews: string }
      | undefined = await summaryQuery
      .clone()
      .select('SUM(pc.earnings)', 'totalEarnings')
      .addSelect('SUM(pc.viewsGenerated)', 'totalViews')
      .getRawOne();
    return {
      totalActive,
      totalPending,
      totalCompleted,
      totalEarnings: parseFloat(earningsAndViews?.totalEarnings || '0'),
      totalViews: parseInt(earningsAndViews?.totalViews || '0'),
    };
  }

  private async calculatePromoterCampaignsSummaryWithApplications(
    promoterId: string,
  ) {
    // Get counts from promoter campaigns (joined campaigns)
    const joinedSummaryQuery = this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .where('pc.promoterId = :promoterId', { promoterId });

    const [totalActive, totalCompleted] = await Promise.all([
      joinedSummaryQuery
        .clone()
        .andWhere('pc.status = :status', { status: 'ONGOING' })
        .getCount(),
      joinedSummaryQuery
        .clone()
        .andWhere('pc.status = :status', { status: 'COMPLETED' })
        .getCount(),
    ]);

    // Get pending count from both promoter campaigns (AWAITING_REVIEW) and applications (PENDING/ACCEPTED)
    const promoterPending = await joinedSummaryQuery
      .clone()
      .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
      .getCount();

    const applicationPending = await this.campaignApplicationRepository
      .createQueryBuilder('ca')
      .where('ca.promoterId = :promoterId', { promoterId })
      .andWhere('ca.status = :status', {
        status: ApplicationStatus.PENDING,
      })
      .getCount();

    const totalPending = promoterPending + applicationPending;

    // Get earnings and views only from joined campaigns (applications don't have earnings/views yet)
    const earningsAndViews:
      | { totalEarnings: string; totalViews: string }
      | undefined = await joinedSummaryQuery
      .clone()
      .select('SUM(pc.earnings)', 'totalEarnings')
      .addSelect('SUM(pc.viewsGenerated)', 'totalViews')
      .getRawOne();

    return {
      totalActive,
      totalPending,
      totalCompleted,
      totalEarnings: parseFloat(earningsAndViews?.totalEarnings || '0'),
      totalViews: parseInt(earningsAndViews?.totalViews || '0'),
    };
  }

  async sendCampaignApplication(
    firebaseUid: string,
    request: SendApplicationRequest,
  ): Promise<SendApplicationResponse> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Check if campaign exists and is active
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId, status: CampaignStatus.ACTIVE },
      relations: ['advertiser'],
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found or not active');
    } // Check if promoter has already applied to this campaign
    const existingApplication =
      await this.campaignApplicationRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: request.campaignId,
        },
      });

    if (existingApplication) {
      throw new Error('You have already applied to this campaign');
    }

    // Create campaign application record with PENDING status
    const campaignApplication = this.campaignApplicationRepository.create({
      promoterId: promoter.id,
      campaignId: request.campaignId,
      applicationMessage: request.applicationMessage,
      status: ApplicationStatus.PENDING,
    });

    const savedApplication =
      await this.campaignApplicationRepository.save(campaignApplication);

    return {
      success: true,
      message: 'Application sent successfully',
      data: {
        applicationId: savedApplication.id,
        status: savedApplication.status,
      },
    };
  }

  async acceptContract(
    firebaseUid: string,
    request: AcceptContractRequest,
  ): Promise<AcceptContractResponse> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Check if campaign exists and is active
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId, status: CampaignStatus.ACTIVE },
      relations: ['advertiser'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or not active');
    }

    // Check if campaign is public (only public campaigns can be accepted directly)
    if (!campaign.isPublic) {
      throw new Error('This campaign is private and requires approval process');
    }

    // Check if promoter has already joined this campaign
    const existingContract = await this.promoterCampaignRepository.findOne({
      where: {
        promoterId: promoter.id,
        campaignId: request.campaignId,
      },
    });
    if (existingContract) {
      if (existingContract.status === PromoterCampaignStatus.ONGOING) {
        throw new Error('You have already joined this campaign');
      } else if (
        existingContract.status === PromoterCampaignStatus.AWAITING_REVIEW
      ) {
        throw new Error('Your application is pending review');
      } else if (existingContract.status === PromoterCampaignStatus.COMPLETED) {
        throw new Error('You have already completed this campaign');
      } else if (existingContract.status === PromoterCampaignStatus.REFUSED) {
        throw new Error('Your application was refused for this campaign');
      }
    }

    // Create promoter campaign record with ONGOING status for direct acceptance
    const promoterCampaign = this.promoterCampaignRepository.create({
      promoterId: promoter.id,
      campaignId: request.campaignId,
      status: PromoterCampaignStatus.ONGOING,
      viewsGenerated: 0,
      earnings: 0,
      budgetHeld: 0,
      spentBudget: 0,
      payoutExecuted: false,
    });
    const savedContract =
      await this.promoterCampaignRepository.save(promoterCampaign);

    return {
      success: true,
      message: 'Contract accepted successfully',
      data: {
        contractId: savedContract.id,
        campaignId: savedContract.campaignId,
        status: savedContract.status,
        acceptedAt: savedContract.joinedAt.toISOString(),
      },
    };
  }

  private transformCampaignApplicationToInterface(
    ca: CampaignApplicationEntity & { campaign: CampaignEntity },
    promoterId: string,
  ): CampaignPromoter {
    const advertiser: Advertiser = {
      id: ca.campaign.advertiser.id,
      companyName: ca.campaign.advertiser.name || 'Unknown Company',
      profileUrl: ca.campaign.advertiser.avatarUrl,
      rating: ca.campaign.advertiser.rating || 0,
      verified: true, // You may want to add a verified field to UserEntity
      description: ca.campaign.advertiser.bio || '',
      website: ca.campaign.advertiser.websiteUrl || '',
      advertiserTypes: ca.campaign.advertiserTypes || [],
    };

    // For applications, earnings are zero since no work has been done yet
    const earnings: Earnings = {
      totalEarned: 0,
      viewsGenerated: 0,
      projectedTotal: this.calculateProjectedEarningsFromCampaign(ca.campaign),
    };

    const baseCampaign = {
      budgetHeld: Number(ca.campaign.budgetAllocated) || 0,
      spentBudget: 0, // No spending for applications
      targetAudience: ca.campaign.targetAudience,
      preferredPlatforms: ca.campaign.preferredPlatforms,
      requirements: ca.campaign.requirements,
      createdAt: ca.campaign.createdAt,
      deadline: ca.campaign.deadline
        ? new Date(ca.campaign.deadline).toISOString()
        : '',
      startDate: ca.campaign.startDate
        ? new Date(ca.campaign.startDate).toISOString()
        : '',
      isPublic: ca.campaign.isPublic,
      discordInviteLink: ca.campaign.discordInviteLink || '',
    };

    let campaignDetails: CampaignDetailsUnion;

    switch (ca.campaign.type) {
      case CampaignType.VISIBILITY:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.VISIBILITY,
          maxViews: ca.campaign.maxViews || 0,
          currentViews: 0, // Application stage, no views generated yet
          cpv: ca.campaign.cpv || 0,
          minFollowers: ca.campaign.minFollowers,
          trackingLink: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/visit/${ca.campaign.id}/${promoterId}`,
        };
        break;

      case CampaignType.CONSULTANT:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: ca.campaign.meetingPlan!,
          expectedDeliverables: ca.campaign.expectedDeliverables.map((cd) => ({
            id: cd.id,
            campaignId: cd.campaignId,
            deliverable: cd.deliverable,
            isSubmitted: cd.isSubmitted,
            isFinished: cd.isFinished,
            createdAt: cd.createdAt,
            updatedAt: cd.updatedAt,
            promoterWork:
              cd.promoterWork?.map((work) => ({
                id: work.id,
                campaignId: cd.campaignId,
                promoterLink: work.promoterLink,
                description: work.description,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
                comments:
                  work.comments?.map((comment) => ({
                    id: comment.id,
                    workId: comment.workId,
                    commentMessage: comment.commentMessage,
                    commentatorId: comment.commentatorId,
                    commentatorName: comment.commentatorName,
                    createdAt: comment.createdAt,
                  })) || [],
              })) || [],
          })),
          expertiseRequired: ca.campaign.expertiseRequired,
          meetingCount: ca.campaign.meetingCount || 0,
          maxBudget: ca.campaign.maxBudget || 0,
          minBudget: ca.campaign.minBudget || 0,
        };
        break;

      case CampaignType.SELLER:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: ca.campaign.sellerRequirements,
          deliverables: ca.campaign.deliverables.map((cd) => ({
            id: cd.id,
            campaignId: cd.campaignId,
            deliverable: cd.deliverable,
            isSubmitted: cd.isSubmitted,
            isFinished: cd.isFinished,
            createdAt: cd.createdAt,
            updatedAt: cd.updatedAt,
            promoterWork:
              cd.promoterWork?.map((work) => ({
                id: work.id,
                campaignId: cd.campaignId,
                promoterLink: work.promoterLink,
                description: work.description,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
                comments:
                  work.comments?.map((comment) => ({
                    id: comment.id,
                    workId: comment.workId,
                    commentMessage: comment.commentMessage,
                    commentatorId: comment.commentatorId,
                    commentatorName: comment.commentatorName,
                    createdAt: comment.createdAt,
                  })) || [],
              })) || [],
          })),
          fixedPrice: undefined, // Not in current schema
          maxBudget: ca.campaign.maxBudget || 0,
          minBudget: ca.campaign.minBudget || 0,
          minFollowers: ca.campaign.minFollowers,
          needMeeting: ca.campaign.needMeeting || false,
          meetingPlan: ca.campaign.meetingPlan!,
          meetingCount: ca.campaign.meetingCount || 0,
        };
        break;

      case CampaignType.SALESMAN:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.SALESMAN,
          commissionPerSale: ca.campaign.commissionPerSale || 0,
          trackSalesVia: ca.campaign.trackSalesVia!,
          codePrefix: ca.campaign.codePrefix,
          refLink: ca.campaign.trackingLink,
          minFollowers: ca.campaign.minFollowers,
        };
        break;
      default:
        throw new Error(
          `Unsupported campaign type: ${String(ca.campaign.type)}`,
        );
    }

    // Map application status to promoter campaign status
    let status: PromoterCampaignStatus;
    switch (ca.status) {
      case ApplicationStatus.PENDING:
        status = PromoterCampaignStatus.AWAITING_REVIEW;
        break;
      case ApplicationStatus.ACCEPTED:
        status = PromoterCampaignStatus.AWAITING_REVIEW; // Accepted but not yet started
        break;
      case ApplicationStatus.REJECTED:
        status = PromoterCampaignStatus.REFUSED;
        break;
      default:
        status = PromoterCampaignStatus.AWAITING_REVIEW;
    }

    return {
      id: ca.campaign.id,
      title: ca.campaign.title,
      type: ca.campaign.type,
      mediaUrl: ca.campaign.mediaUrl,
      status: status,
      description: ca.campaign.description,
      advertiser,
      campaign: campaignDetails,
      earnings,
      tags: ca.campaign.advertiserTypes || [],
      meetingDone: false, // No meetings done for applications
    };
  }

  private calculateProjectedEarningsFromCampaign(
    campaign: CampaignEntity,
  ): number {
    // Simple projection based on campaign type and parameters
    if (
      campaign.type === CampaignType.VISIBILITY &&
      campaign.maxViews &&
      campaign.cpv
    ) {
      const maxPossibleEarnings = (campaign.maxViews / 100) * campaign.cpv;
      return maxPossibleEarnings;
    }

    if (
      campaign.type === CampaignType.CONSULTANT ||
      campaign.type === CampaignType.SELLER
    ) {
      return campaign.maxBudget || 0;
    }

    return 0;
  }

  /**
   * Add a new work item to a specific deliverable
   */
  async addCampaignWorkToDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    promoterLink: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found for this campaign',
        };
      }

      // Create the new work item
      const newWork = this.workRepository.create({
        deliverableId,
        promoterLink,
        description,
      });

      await this.workRepository.save(newWork);

      // Mark the deliverable as submitted since work has been added
      deliverable.isSubmitted = true;
      await this.deliverableRepository.save(deliverable);

      // Return all work items for this deliverable
      const allWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = allWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work added successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add work',
      };
    }
  }

  /**
   * Update an existing work item in a specific deliverable
   */
  async updateCampaignWorkInDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    promoterLink: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the work item exists and belongs to the correct deliverable
      const existingWork = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
        relations: ['deliverable'],
      });

      if (!existingWork) {
        return {
          success: false,
          message: 'Work item not found',
        };
      }

      // Verify the deliverable belongs to this campaign
      if (existingWork.deliverable.campaignId !== campaignId) {
        return {
          success: false,
          message: 'Work item does not belong to this campaign',
        };
      }

      // Update the work item
      existingWork.promoterLink = promoterLink;
      if (description !== undefined) {
        existingWork.description = description;
      }

      await this.workRepository.save(existingWork);

      // Return all work items for this deliverable
      const allWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = allWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work updated successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update work',
      };
    }
  }

  /**
   * Delete a work item from a specific deliverable
   */
  async deleteCampaignWorkFromDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the work item exists and belongs to the correct deliverable
      const existingWork = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
        relations: ['deliverable'],
      });

      if (!existingWork) {
        return {
          success: false,
          message: 'Work item not found',
        };
      }

      // Verify the deliverable belongs to this campaign
      if (existingWork.deliverable.campaignId !== campaignId) {
        return {
          success: false,
          message: 'Work item does not belong to this campaign',
        };
      }

      // Delete the work item (this will also cascade delete comments if configured)
      await this.workRepository.remove(existingWork);

      // Return remaining work items for this deliverable
      const remainingWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = remainingWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work deleted successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete work',
      };
    }
  }

  /**
   * Add a comment to a work item in a specific deliverable
   */
  async addCommentToWork(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Verify the work exists and belongs to this deliverable
      const work = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
      });

      if (!work) {
        return {
          success: false,
          message: 'Work not found',
        };
      }

      // Create the comment
      const comment = this.commentRepository.create({
        workId: workId,
        commentMessage: commentMessage,
        commentatorId: promoter.id,
        commentatorName: promoter.name || promoter.email,
      });

      await this.commentRepository.save(comment);

      // Return all works for this deliverable with updated comments
      const allWorks = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'ASC' },
      });

      const workDtos = allWorks.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Comment added successfully',
        data: workDtos,
      };
    } catch (error) {
      console.error('Error adding comment to work:', error);
      return {
        success: false,
        message: 'Failed to add comment to work',
      };
    }
  }

  /**
   * Add a comment to a work item in a specific deliverable (for advertisers)
   */
  async addCommentToWorkAsAdvertiser(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      // Find advertiser
      const advertiser = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
      });

      if (!advertiser) {
        return {
          success: false,
          message: 'Advertiser not found',
        };
      }

      // Verify the campaign belongs to this advertiser
      const campaign = await this.campaignRepository.findOne({
        where: {
          id: campaignId,
          advertiserId: advertiser.id,
        },
      });

      if (!campaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Verify the work exists and belongs to this deliverable
      const work = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
      });

      if (!work) {
        return {
          success: false,
          message: 'Work not found',
        };
      }

      // Create the comment
      const comment = this.commentRepository.create({
        workId: workId,
        commentMessage: commentMessage,
        commentatorId: advertiser.id,
        commentatorName: advertiser.name || advertiser.email,
      });

      await this.commentRepository.save(comment);

      // Return all works for this deliverable with updated comments
      const allWorks = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'ASC' },
      });

      const workDtos = allWorks.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Comment added successfully',
        data: workDtos,
      };
    } catch (error) {
      console.error('Error adding comment to work:', error);
      return {
        success: false,
        message: 'Failed to add comment to work',
      };
    }
  }

  /**
   * Mark a campaign deliverable as finished (for advertisers)
   */
  async markDeliverableAsFinished(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Find advertiser
      const advertiser = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
      });

      if (!advertiser) {
        return {
          success: false,
          message: 'Advertiser not found',
        };
      }

      // Verify the campaign belongs to this advertiser
      const campaign = await this.campaignRepository.findOne({
        where: {
          id: campaignId,
          advertiserId: advertiser.id,
        },
      });

      if (!campaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Check if deliverable is already finished
      if (deliverable.isFinished) {
        return {
          success: false,
          message: 'Deliverable is already marked as finished',
        };
      }

      // Mark the deliverable as finished
      deliverable.isFinished = true;
      await this.deliverableRepository.save(deliverable);

      // Return the updated deliverable
      return {
        success: true,
        message: 'Deliverable marked as finished successfully',
        data: {
          id: deliverable.id,
          campaignId: deliverable.campaignId,
          deliverable: deliverable.deliverable,
          isSubmitted: deliverable.isSubmitted,
          isFinished: deliverable.isFinished,
          createdAt: deliverable.createdAt,
          updatedAt: deliverable.updatedAt,
        },
      };
    } catch (error) {
      console.error('Error marking deliverable as finished:', error);
      return {
        success: false,
        message: 'Failed to mark deliverable as finished',
      };
    }
  }

  /** Convert entity → plain JSON shape matching your CampaignWork interface */
  private campaignWorkToDto(
    w: CampaignWorkEntity,
    campaignId: string,
  ): CampaignWork {
    return {
      id: w.id,
      campaignId: campaignId,
      promoterLink: w.promoterLink,
      description: w.description,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      comments:
        w.comments?.map((comment) => ({
          id: comment.id,
          workId: comment.workId,
          commentMessage: comment.commentMessage,
          commentatorId: comment.commentatorId,
          commentatorName: comment.commentatorName,
          createdAt: comment.createdAt,
        })) || [],
    };
  }

  async getCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignUnion> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Get the campaign by ID
    const campaign = await this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('campaign.promoterCampaigns', 'promoterCampaigns')
      .where('campaign.id = :campaignId', { campaignId })
      .getOne();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Transform campaign to the required format
    const transformedCampaign = this.transformCampaignToUnion(
      campaign,
      promoter.id,
    );

    return transformedCampaign;
  }

  async getPromoterCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignPromoter> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // First, try to find the campaign in PromoterCampaign (joined campaigns)
    const promoterCampaign = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('deliverables.promoterWork', 'promoterWork')
      .leftJoinAndSelect('promoterWork.comments', 'comments')
      .where('pc.promoterId = :promoterId', { promoterId: promoter.id })
      .andWhere('pc.campaignId = :campaignId', { campaignId })
      .getOne();

    if (promoterCampaign) {
      return this.transformPromoterCampaignToInterface(
        promoterCampaign,
        promoter.id,
      );
    }

    // If not found in joined campaigns, try to find in applications
    const applicationCampaign = await this.campaignApplicationRepository
      .createQueryBuilder('ca')
      .leftJoinAndSelect('ca.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('deliverables.promoterWork', 'promoterWork')
      .leftJoinAndSelect('promoterWork.comments', 'comments')
      .where('ca.promoterId = :promoterId', { promoterId: promoter.id })
      .andWhere('ca.campaignId = :campaignId', { campaignId })
      .getOne();

    if (applicationCampaign) {
      return this.transformCampaignApplicationToInterface(
        applicationCampaign as CampaignApplicationEntity & {
          campaign: CampaignEntity;
        },
        promoter.id,
      );
    }

    throw new NotFoundException('Campaign not found for this promoter');
  }
}
