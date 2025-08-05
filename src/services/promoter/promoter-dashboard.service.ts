import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { Message } from '../../database/entities/message.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { UniqueViewEntity } from '../../database/entities/unique-view.entity';
import { PromoterCampaignStatus } from '../../database/entities/promoter-campaign.entity';
import {
  PromoterStats,
  PromoterActiveCampaign,
  PromoterSuggestedCampaign,
  PromoterTransaction,
  PromoterMessage,
  PromoterWallet,
  PromoterWalletViewEarnings,
  PromoterWalletDirectEarnings,
} from '../../interfaces/promoter-dashboard';
import { CampaignStatus } from '../../enums/campaign-status';
import { UserType } from '../../enums/user-type';
import { PromoterCampaignService } from './promoter-campaign.service';
import { UserEntity } from 'src/database/entities';

@Injectable()
export class PromoterDashboardService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private readonly promoterCampaignService: PromoterCampaignService,
  ) {}

  /**
   * Get comprehensive promoter stats summary
   */
  getPromoterStatsSummary(promoter: UserEntity): PromoterStats {
    const dateRanges = this.generateDateRanges();
    const { weekAgo, twoWeeksAgo, startOfToday, startOfYesterday } = dateRanges;

    const transactions = promoter.transactions || [];
    const uniqueViews = promoter.uniqueViews || [];

    // Calculate earnings
    const earningsThisWeek = this.calculateEarningsForPeriod(
      transactions,
      weekAgo,
    );
    const earningsLastWeek = this.calculateEarningsForPeriod(
      transactions,
      twoWeeksAgo,
      weekAgo,
    );

    // Calculate views
    const viewsToday = this.countViewsForPeriod(uniqueViews, startOfToday);
    const viewsYesterday = this.countViewsForPeriod(
      uniqueViews,
      startOfYesterday,
      startOfToday,
    );

    // Calculate sales
    const salesThisWeek = this.countSalesForPeriod(transactions, weekAgo);
    const salesLastWeek = this.countSalesForPeriod(
      transactions,
      twoWeeksAgo,
      weekAgo,
    );

    // Count campaigns
    const activeCampaigns = this.countCampaignsByStatus(
      promoter,
      PromoterCampaignStatus.ONGOING,
    );
    const pendingReviewCampaigns = this.countCampaignsByStatus(
      promoter,
      PromoterCampaignStatus.AWAITING_REVIEW,
    );

    return {
      earningsThisWeek,
      earningsLastWeek,
      earningsPercentageChange: this.calculatePercentageChange(
        earningsThisWeek,
        earningsLastWeek,
      ),
      viewsToday,
      viewsYesterday,
      viewsPercentageChange: this.calculatePercentageChange(
        viewsToday,
        viewsYesterday,
      ),
      salesThisWeek,
      salesLastWeek,
      salesPercentageChange: this.calculatePercentageChange(
        salesThisWeek,
        salesLastWeek,
      ),
      activeCampaigns,
      pendingReviewCampaigns,
    };
  }

  /**
   * Calculate earnings for a specific time period with transaction type filtering
   */
  calculateEarningsForPeriod(
    transactions: Transaction[],
    startDate: Date,
    endDate?: Date,
  ): number {
    return transactions
      .filter((tx) => {
        const inTimeRange = endDate
          ? tx.createdAt >= startDate && tx.createdAt < endDate
          : tx.createdAt >= startDate;

        const isCompleted = tx.status === TransactionStatus.COMPLETED;

        const isEarningType =
          tx.type === TransactionType.DIRECT_PAYMENT ||
          tx.type === TransactionType.VIEW_EARNING ||
          tx.type === TransactionType.SALESMAN_COMMISSION;

        return inTimeRange && isCompleted && isEarningType;
      })
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }

  /**
   * Count views for a specific time period
   */
  countViewsForPeriod(
    views: UniqueViewEntity[],
    startDate: Date,
    endDate?: Date,
  ): number {
    return views.filter((view) => {
      return endDate
        ? view.createdAt >= startDate && view.createdAt < endDate
        : view.createdAt >= startDate;
    }).length;
  }

  /**
   * Count sales (commission transactions) for a specific time period
   */
  countSalesForPeriod(
    transactions: Transaction[],
    startDate: Date,
    endDate?: Date,
  ): number {
    return transactions.filter((tx) => {
      const inTimeRange = endDate
        ? tx.createdAt >= startDate && tx.createdAt < endDate
        : tx.createdAt >= startDate;

      const isCommission = tx.type === TransactionType.SALESMAN_COMMISSION;
      const isCompleted = tx.status === TransactionStatus.COMPLETED;

      return inTimeRange && isCommission && isCompleted;
    }).length;
  }

  /**
   * Count campaigns by status
   */
  countCampaignsByStatus(
    user: UserEntity,
    status: PromoterCampaignStatus,
  ): number {
    return (user.promoterCampaigns || []).filter((pc) => pc.status === status)
      .length;
  }

  /**
   * Calculate percentage change between two numbers
   */
  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Generate common date ranges for stats calculation
   */
  generateDateRanges() {
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

    return {
      now,
      weekAgo,
      twoWeeksAgo,
      startOfToday,
      startOfYesterday,
    };
  }

  /**
   * Get active campaigns for a promoter
   */
  getActiveCampaigns(
    promoter: UserEntity,
    limit: number,
  ): PromoterActiveCampaign[] {
    const activeCampaigns = (promoter.promoterCampaigns || [])
      .filter((pc) => pc.status === PromoterCampaignStatus.ONGOING)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    return this.promoterCampaignService.convertToPromoterActiveCampaignDto(
      promoter.usedCurrency,
      activeCampaigns,
    );
  }

  /**
   * Get suggested campaigns for a promoter
   */
  async getSuggestedCampaigns(
    promoter: UserEntity,
    limit: number,
  ): Promise<PromoterSuggestedCampaign[]> {
    const relatedCampaignIds =
      promoter.promoterCampaigns?.map((pc) => pc.campaignId) || [];

    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.media', 'media')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE });

    if (relatedCampaignIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...relatedCampaignIds)', {
        relatedCampaignIds,
      });
    }

    const suggestedCampaigns = await query
      .orderBy('campaign.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return this.promoterCampaignService.convertToPromoterSuggestedCampaignDto(
      promoter.usedCurrency,
      suggestedCampaigns,
    );
  }

  /**
   * Get recent transactions for a promoter
   */
  getRecentTransactions(
    promoter: UserEntity,
    limit: number,
  ): PromoterTransaction[] {
    // Sort transactions by creation date (newest first) and take the limit
    const recentTransactions = (promoter.transactions || [])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return recentTransactions.map((transaction) => ({
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

  /**
   * Get recent messages for a promoter
   */
  async getRecentMessages(
    promoter: UserEntity,
    limit: number,
  ): Promise<PromoterMessage[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('thread.promoterId = :promoterId', { promoterId: promoter.id })
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

  /**
   * Get wallet information for a promoter
   */
  async getWalletInfo(promoter: UserEntity): Promise<PromoterWallet> {
    let wallet = promoter.wallet;

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId: promoter.id,
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
}
