import {
  Controller,
  Post,
  Body,
  Request,
  Param,
  Put,
  Delete,
  Get,
} from '@nestjs/common';
import { PromoterService } from 'src/services/promoter/promoter.service';
import {
  PromoterDashboardRequest,
  PromoterDashboardResponse,
} from '../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
} from '../interfaces/explore-campaign';
import {
  CampaignWork,
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
  CampaignPromoter,
} from '../interfaces/promoter-campaigns';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from '../interfaces/campaign-actions';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignUnion } from '../interfaces/explore-campaign';

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

  @Post('campaigns/:campaignId/deliverables/:deliverableId/work')
  async addCampaignWorkToDeliverable(
    @Param('campaignId') campaignId: string,
    @Param('deliverableId') deliverableId: string,
    @Body() body: { promoterLink: string; description?: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.addCampaignWorkToDeliverable(
        firebaseUid,
        campaignId,
        deliverableId,
        body.promoterLink,
        body.description,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to add work to deliverable';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Put('campaigns/:campaignId/deliverables/:deliverableId/work/:workId')
  async updateCampaignWorkInDeliverable(
    @Param('campaignId') campaignId: string,
    @Param('deliverableId') deliverableId: string,
    @Param('workId') workId: string,
    @Body() body: { promoterLink: string; description?: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.updateCampaignWorkInDeliverable(
        firebaseUid,
        campaignId,
        deliverableId,
        workId,
        body.promoterLink,
        body.description,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update work in deliverable';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Delete('campaigns/:campaignId/deliverables/:deliverableId/work/:workId')
  async deleteCampaignWorkFromDeliverable(
    @Param('campaignId') campaignId: string,
    @Param('deliverableId') deliverableId: string,
    @Param('workId') workId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const firebaseUid = req.user.uid;

      const result =
        await this.promoterService.deleteCampaignWorkFromDeliverable(
          firebaseUid,
          campaignId,
          deliverableId,
          workId,
        );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to delete work from deliverable';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Post(
    'campaigns/:campaignId/deliverables/:deliverableId/work/:workId/comments',
  )
  async addCommentToWork(
    @Param('campaignId') campaignId: string,
    @Param('deliverableId') deliverableId: string,
    @Param('workId') workId: string,
    @Body() body: { commentMessage: string },
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.addCommentToWork(
        firebaseUid,
        campaignId,
        deliverableId,
        workId,
        body.commentMessage,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to add comment to work';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Get('campaigns/explore/:campaignId')
  async getCampaignById(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    data: CampaignUnion;
    message?: string;
  }> {
    const firebaseUid = req.user.uid;

    const data = await this.promoterService.getCampaignById(
      firebaseUid,
      campaignId,
    );

    return {
      success: true,
      data,
      message: 'Campaign retrieved successfully',
    };
  }

  @Get('campaigns/list/:campaignId')
  async getPromoterCampaignById(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    data: CampaignPromoter;
    message?: string;
  }> {
    const firebaseUid = req.user.uid;

    const data = await this.promoterService.getPromoterCampaignById(
      firebaseUid,
      campaignId,
    );

    return {
      success: true,
      data,
      message: 'Promoter campaign retrieved successfully',
    };
  }
}
