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
  AdvertiserRecommendedPromoter,
  AdvertiserTransaction,
  AdvertiserMessage,
  AdvertiserWallet,
} from '../interfaces/advertiser-dashboard';

// Type definitions for query results
interface QueryResult {
  total?: string;
  avg?: string;
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
      recommendedPromoters: [],
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

    if (request.includeRecommendations) {
      data.recommendedPromoters = await this.getRecommendedPromoters(
        advertiserId,
        request.recommendedPromoterLimit || 10,
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
        types: ['CAMPAIGN_PAYMENT', 'PROMOTER_PAYMENT', 'CONSULTANT_FEE'],
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
        types: ['CAMPAIGN_PAYMENT', 'PROMOTER_PAYMENT', 'CONSULTANT_FEE'],
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
          deadline: campaign.deadline?.toISOString() || '',
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        };
      }),
    );

    return campaignData;
  }

  private async getRecommendedPromoters(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserRecommendedPromoter[]> {
    // Get top performing promoters
    const promoters = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.promoterDetails', 'details')
      .where('user.role = :role', { role: 'PROMOTER' })
      .orderBy('user.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    const promoterData = await Promise.all(
      promoters.map(async (promoter) => {
        // Get promoter performance metrics
        const completedCampaigns = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .where('pc.promoterId = :promoterId', { promoterId: promoter.id })
          .andWhere('pc.status = :status', { status: 'COMPLETED' })
          .getCount();

        const avgViews = (await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .select('AVG(pc.viewsGenerated)', 'avg')
          .where('pc.promoterId = :promoterId', { promoterId: promoter.id })
          .getRawOne()) as QueryResult;

        const totalViews = parseInt(avgViews?.avg || '0');

        return {
          id: promoter.id,
          name: promoter.name,
          avatar: promoter.avatarUrl,
          rating: 4.5, // Default rating, you might want to implement a rating system
          followers: 10000, // This should come from social media data
          specialties: ['Marketing', 'Social Media'], // This should come from promoter details
          location: 'Location', // This should come from promoter details
          successRate: completedCampaigns > 0 ? 85 : 0, // Calculate based on actual data
          averageViews: totalViews,
          completedCampaigns,
          priceRange: {
            min: 50,
            max: 200,
          },
          isVerified: true, // This should come from verification status
          languages: ['English'], // This should come from promoter language preferences
        };
      }),
    );

    return promoterData;
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
        types: ['CAMPAIGN_PAYMENT', 'PROMOTER_PAYMENT', 'CONSULTANT_FEE'],
      })
      .getRawOne()) as QueryResult;

    const totalDeposited = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type = :type', { type: 'WALLET_DEPOSIT' })
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
