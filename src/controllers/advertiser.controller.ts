import { Controller, Post, Body, Request } from '@nestjs/common';
import { AdvertiserService } from '../services/advertiser.service';
import {
  GetAdvertiserDashboardRequest,
  GetAdvertiserDashboardResponse,
} from '../interfaces/advertiser-dashboard';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Controller('advertiser')
export class AdvertiserController {
  constructor(private readonly advertiserService: AdvertiserService) {}

  @Post('dashboard')
  async getDashboardData(
    @Body() request: GetAdvertiserDashboardRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<GetAdvertiserDashboardResponse> {
    try {
      const firebaseUid = req.user.uid;

      const data = await this.advertiserService.getDashboardData(
        firebaseUid,
        request,
      );

      return {
        success: true,
        data,
        message: 'Dashboard data retrieved successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve dashboard data';
      return {
        success: false,
        data: {
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
        },
        message: errorMessage,
      };
    }
  }
}
