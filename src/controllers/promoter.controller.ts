import { Controller, Post, Body, Request } from '@nestjs/common';
import { PromoterService } from '../services/promoter.service';
import {
  PromoterDashboardRequest,
  PromoterDashboardResponse,
} from '../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
} from '../interfaces/explore-campaign';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Controller('promoter')
export class PromoterController {
  constructor(private readonly promoterService: PromoterService) {}

  @Post('dashboard')
  async getDashboardData(
    @Body() request: PromoterDashboardRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<PromoterDashboardResponse> {
    try {
      const firebaseUid = req.user.uid;

      const data = await this.promoterService.getDashboardData(
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
        data: {},
        message: errorMessage,
      };
    }
  }

  @Post('campaigns/explore')
  async getExploreCampaigns(
    @Body() request: ExploreCampaignRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    data: ExploreCampaignResponse;
    message?: string;
  }> {
    try {
      const firebaseUid = req.user.uid;

      const data = await this.promoterService.getExploreCampaigns(
        firebaseUid,
        request,
      );

      return {
        success: true,
        data,
        message: 'Explore campaigns data retrieved successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve explore campaigns data';
      return {
        success: false,
        data: {
          campaigns: [],
          page: request.page || 1,
          totalPages: 0,
          totalCount: 0,
          sortBy: request.sortBy || 'newest',
          searchTerm: request.searchTerm || '',
          typeFilter: request.typeFilter || [],
          advertiserTypes: request.advertiserTypes || [],
        },
        message: errorMessage,
      };
    }
  }
}
