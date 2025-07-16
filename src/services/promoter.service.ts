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
} from '../interfaces/promoter-campaigns';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { PromoterCampaignStatus } from '../interfaces/promoter-campaign';

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
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const earningsLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const viewsToday = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.updatedAt >= :startOfToday', { startOfToday })
      .getRawOne();

    const viewsYesterday = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.updatedAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('pc.updatedAt < :startOfToday', { startOfToday })
      .getRawOne();

    const salesThisWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const salesLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
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

    const earningsThisWeekNum = parseFloat(earningsThisWeek?.total || '0');
    const earningsLastWeekNum = parseFloat(earningsLastWeek?.total || '0');
    const viewsTodayNum = parseInt(viewsToday?.total || '0');
    const viewsYesterdayNum = parseInt(viewsYesterday?.total || '0');
    const salesThisWeekNum = parseInt(salesThisWeek?.total || '0');
    const salesLastWeekNum = parseInt(salesLastWeek?.total || '0');

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
      .where('campaign.status = :status', { status: 'ACTIVE' })
      .andWhere('campaign.isPublic = :isPublic', { isPublic: true });

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
      .where('transaction.promoterId = :promoterId', { promoterId })
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
      paymentMethod: transaction.paymentMethod,
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
      where: { promoterId },
    });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = this.walletRepository.create({
        promoterId,
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
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      lastPayoutDate: wallet.lastPayoutDate?.toISOString(),
      nextPayoutDate: wallet.nextPayoutDate?.toISOString(),
      minimumThreshold: wallet.minimumThreshold,
    };

    const directEarnings: PromoterWalletDirectEarnings = {
      totalEarned: wallet.directTotalEarned,
      totalPaid: wallet.directTotalPaid,
      pendingPayments: wallet.directPendingPayments,
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
      where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
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
      .select('pc.campaignId')
      .where('pc.promoterId = :promoterId', { promoterId: promoter.id })
      .getRawMany();

    const joinedIds = joinedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );

    // Build query for campaigns the promoter hasn't joined
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('campaign.isPublic = :isPublic', { isPublic: true });

    // Exclude campaigns the promoter has already joined
    if (joinedIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...joinedIds)', {
        joinedIds,
      });
    }

    // Apply search filter
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
    }

    // Apply sorting
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
    const campaigns = await query.skip(skip).take(limit).getMany();

    // Transform campaigns to the required format
    const transformedCampaigns: CampaignUnion[] = campaigns.map((campaign) =>
      this.transformCampaignToUnion(campaign),
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
  private transformCampaignToUnion(campaign: CampaignEntity): CampaignUnion {
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
      status: 'ONGOING' as PromoterCampaignStatus,
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
          expectedDeliverables: campaign.expectedDeliverables,
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
          deliverables: campaign.deliverables,
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
      where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
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

    // Build query for promoter campaigns
    let query = this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .where('pc.promoterId = :promoterId', { promoterId: promoter.id });

    // Apply status filter
    if (request.status && request.status.length > 0) {
      query = query.andWhere('pc.status IN (:...statuses)', {
        statuses: request.status,
      });
    }

    // Apply campaign type filter
    if (request.type && request.type.length > 0) {
      query = query.andWhere('campaign.type IN (:...types)', {
        types: request.type,
      });
    }

    // Apply search filter
    if (searchTerm) {
      query = query.andWhere(
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        query = query.orderBy(
          'pc.joinedAt',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case 'deadline':
        query = query.orderBy(
          'campaign.deadline',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case 'earnings':
        query = query.orderBy(
          'pc.earnings',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      case 'title':
        query = query.orderBy(
          'campaign.title',
          sortOrder.toUpperCase() as 'ASC' | 'DESC',
        );
        break;
      default:
        query = query.orderBy('pc.joinedAt', 'DESC');
    }

    const totalCount = await query.getCount();
    const totalPages = Math.ceil(totalCount / limit);
    const promoterCampaigns = await query.skip(skip).take(limit).getMany();

    // Transform promoter campaigns to the required format
    const transformedCampaigns: CampaignPromoter[] = promoterCampaigns.map(
      (pc) => this.transformPromoterCampaignToInterface(pc),
    );

    // Calculate summary
    const summary = await this.calculatePromoterCampaignsSummary(promoter.id);

    return {
      campaigns: transformedCampaigns,
      page,
      totalPages,
      totalCount,
      summary,
    };
  }

  private transformPromoterCampaignToInterface(
    pc: PromoterCampaign,
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
      budgetHeld: Number(pc.budgetHeld),
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
          trackingLink: pc.campaign.trackingLink || '',
        };
        break;

      case CampaignType.CONSULTANT:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: pc.campaign.meetingPlan!,
          expectedDeliverables: pc.campaign.expectedDeliverables,
          expertiseRequired: pc.campaign.expertiseRequired,
          meetingCount: pc.campaign.meetingCount || 0,
          maxBudget: pc.campaign.maxBudget || 0,
          minBudget: pc.campaign.minBudget || 0,
          promoterLinks: [], // You may want to add this field to PromoterCampaign entity
        };
        break;

      case CampaignType.SELLER:
        campaignDetails = {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: pc.campaign.sellerRequirements,
          deliverables: pc.campaign.deliverables,
          fixedPrice: undefined, // Not in current schema
          maxBudget: pc.campaign.maxBudget || 0,
          minBudget: pc.campaign.minBudget || 0,
          promoterLinks: [], // You may want to add this field to PromoterCampaign entity
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
}
