import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import {
  GetAdvertiserDashboardRequest,
  AdvertiserDashboardData,
  AdvertiserMessage,
  AdvertiserWallet,
} from '../interfaces/advertiser-dashboard';
import { AdvertiserDashboardSummary } from '../interfaces/advertiser-campaign';
import { AdvertiserStatsService } from './advertiser-stats.service';
import { AdvertiserCampaignService } from './advertiser-campaign.service';
import { AdvertiserTransactionService } from './advertiser-transaction.service';
import { AdvertiserWalletService } from './advertiser-wallet.service';
import { AdvertiserMessageService } from './advertiser-message.service';

@Injectable()
export class AdvertiserDashboardService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly advertiserStatsService: AdvertiserStatsService,
    private readonly advertiserCampaignService: AdvertiserCampaignService,
    private readonly advertiserTransactionService: AdvertiserTransactionService,
    private readonly advertiserWalletService: AdvertiserWalletService,
    private readonly advertiserMessageService: AdvertiserMessageService,
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: GetAdvertiserDashboardRequest,
  ): Promise<AdvertiserDashboardData> {
    const advertiserId = await this.getAdvertiserId(firebaseUid);
    const [stats, activeCampaigns, recentTransactions, recentMessages, wallet] =
      await Promise.all([
        request.includeStats
          ? this.advertiserStatsService.getAdvertiserStats(advertiserId)
          : Promise.resolve(undefined),
        request.includeCampaigns
          ? this.advertiserCampaignService.getActiveCampaigns(
              advertiserId,
              request.activeCampaignLimit || 10,
            )
          : Promise.resolve([]),
        request.includeTransactions
          ? this.advertiserTransactionService.getRecentTransactions(
              advertiserId,
              request.transactionLimit || 10,
            )
          : Promise.resolve([]),
        request.includeMessages
          ? this.getRecentMessages(advertiserId, request.messageLimit || 10)
          : Promise.resolve([]),
        request.includeWallet
          ? this.advertiserWalletService.getWalletInfo(advertiserId)
          : Promise.resolve(undefined),
      ]);

    const data: AdvertiserDashboardData = {
      stats: stats || {
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
      activeCampaigns: activeCampaigns || [],
      recentTransactions: recentTransactions || [],
      recentMessages: recentMessages || [],
      wallet: wallet || {
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

    return data;
  }

  private async getAdvertiserId(firebaseUid: string): Promise<string> {
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    return advertiser.id;
  }

  private async getRecentMessages(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserMessage[]> {
    return this.advertiserMessageService.getRecentMessages(advertiserId, limit);
  }

  async getDashboardSummary(
    advertiserId: string,
  ): Promise<AdvertiserDashboardSummary> {
    // TODO: Implement proper dashboard summary calculation with actual data
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      completedCampaigns: 0,
      draftCampaigns: 0,
      totalSpent: 0,
      totalAllocated: 0,
      remainingBudget: 0,
      monthlySpend: 0,
      totalViews: 0,
      totalSales: 0,
      totalRevenue: 0,
      recentApplications: [],
      recentCompletions: [],
      topPerformingCampaigns: [],
    };
  }
}
