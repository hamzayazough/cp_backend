import {
  Controller,
  Post,
  Body,
  Request,
  Param,
  Put,
  Get,
} from '@nestjs/common';
import { PromoterService } from '../services/promoter.service';
import {
  PromoterDashboardRequest,
  PromoterDashboardResponse,
} from '../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
} from '../interfaces/explore-campaign';
import {
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
} from '../interfaces/promoter-campaigns';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from '../interfaces/campaign-actions';
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

  @Post('campaigns/list')
  async getPromoterCampaigns(
    @Body() request: GetPromoterCampaignsRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    data: PromoterCampaignsListResponse;
    message?: string;
  }> {
    try {
      const firebaseUid = req.user.uid;

      const data = await this.promoterService.getPromoterCampaigns(
        firebaseUid,
        request,
      );

      return {
        success: true,
        data,
        message: 'Promoter campaigns data retrieved successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve promoter campaigns data';
      return {
        success: false,
        data: {
          campaigns: [],
          page: request.page || 1,
          totalPages: 0,
          totalCount: 0,
          summary: {
            totalActive: 0,
            totalPending: 0,
            totalCompleted: 0,
            totalEarnings: 0,
            totalViews: 0,
          },
        },
        message: errorMessage,
      };
    }
  }

  @Post('campaigns/:campaignId/apply')
  async sendCampaignApplication(
    @Param('campaignId') campaignId: string,
    @Body() body: { applicationMessage: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<SendApplicationResponse> {
    try {
      const firebaseUid = req.user.uid;
      const request: SendApplicationRequest = {
        campaignId,
        applicationMessage: body.applicationMessage,
      };

      const result = await this.promoterService.sendCampaignApplication(
        firebaseUid,
        request,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to send campaign application';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Post('campaigns/accept-contract')
  async acceptContract(
    @Body() request: AcceptContractRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<AcceptContractResponse> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.acceptContract(
        firebaseUid,
        request,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to accept contract';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Post('campaigns/:campaignId/links')
  async addCampaignLink(
    @Param('campaignId') campaignId: string,
    @Body() body: { link: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    message: string;
    data?: string[];
  }> {
    try {
      const firebaseUid = req.user.uid;
      const { link } = body;

      const result = await this.promoterService.addCampaignLink(
        firebaseUid,
        campaignId,
        link,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add campaign link';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Put('campaigns/:campaignId/links')
  async updateCampaignLink(
    @Param('campaignId') campaignId: string,
    @Body() body: { oldLink: string; newLink: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    message: string;
    data?: string[];
  }> {
    try {
      const firebaseUid = req.user.uid;
      const { oldLink, newLink } = body;

      const result = await this.promoterService.updateCampaignLink(
        firebaseUid,
        campaignId,
        oldLink,
        newLink,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update campaign link';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Post('campaigns/:campaignId/links/delete')
  async deleteCampaignLink(
    @Param('campaignId') campaignId: string,
    @Body() body: { link: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    message: string;
    data?: string[];
  }> {
    try {
      const firebaseUid = req.user.uid;
      const { link } = body;

      const result = await this.promoterService.deleteCampaignLink(
        firebaseUid,
        campaignId,
        link,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to delete campaign link';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Get('campaigns/:campaignId/links')
  async getCampaignLinks(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    message: string;
    data: string[];
  }> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.getCampaignLinks(
        firebaseUid,
        campaignId,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch campaign links';
      return {
        success: false,
        message: errorMessage,
        data: [],
      };
    }
  }
}
