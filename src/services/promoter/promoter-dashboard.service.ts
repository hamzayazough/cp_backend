import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { UniqueViewEntity } from '../../database/entities/unique-view.entity';
import { PromoterCampaignStatus } from '../../database/entities/promoter-campaign.entity';
import { PromoterStats } from '../../interfaces/promoter-dashboard';

@Injectable()
export class PromoterDashboardService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Get comprehensive promoter stats summary
   */
  async getPromoterStatsSummary(promoterId: string): Promise<PromoterStats> {
    const dateRanges = this.generateDateRanges();
    const { weekAgo, twoWeeksAgo, startOfToday, startOfYesterday } = dateRanges;

    const userWithData = await this.getUserWithRelatedData(promoterId);
    if (!userWithData) {
      throw new Error('Promoter not found');
    }

    const transactions = userWithData.transactions || [];
    const uniqueViews = userWithData.uniqueViews || [];

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
      userWithData,
      PromoterCampaignStatus.ONGOING,
    );
    const pendingReviewCampaigns = this.countCampaignsByStatus(
      userWithData,
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
   * Get user with all related data for stats calculation
   */
  async getUserWithRelatedData(promoterId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { id: promoterId },
      relations: [
        'transactions',
        'uniqueViews',
        'promoterCampaigns',
        'promoterCampaigns.campaign',
      ],
    });
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
      .reduce((sum, tx) => sum + tx.amount, 0);
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
}
