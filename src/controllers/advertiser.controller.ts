import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertiserService } from '../services/advertiser.service';
import { PromoterService } from '../services/promoter.service';
import {
  CampaignService,
  CreateCampaignResponse,
  UploadFileResponse,
} from '../services/campaign.service';
import {
  GetAdvertiserDashboardRequest,
  GetAdvertiserDashboardResponse,
} from '../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  AdvertiserDashboardSummary,
} from '../interfaces/advertiser-campaign';
import { Campaign } from '../interfaces/campaign';
import { CampaignWork } from '../interfaces/promoter-campaigns';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { ReviewCampaignApplicationResult } from 'src/interfaces/review-campaign-application-result';

@Controller('advertiser')
export class AdvertiserController {
  constructor(
    private readonly advertiserService: AdvertiserService,
    private readonly campaignService: CampaignService,
    private readonly promoterService: PromoterService,
  ) {}

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

  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCampaignFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<UploadFileResponse> {
    if (!campaignId) {
      throw new BadRequestException('Campaign ID is required');
    }

    const firebaseUid = req.user.uid;
    return this.campaignService.uploadCampaignFile(
      file,
      campaignId,
      firebaseUid,
    );
  }
  @Post('create-campaign')
  async createCampaign(
    @Body()
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    > & {
      mediaUrl?: string;
    },
    @Request() req: { user: FirebaseUser },
  ): Promise<CreateCampaignResponse> {
    const firebaseUid = req.user.uid;
    return this.campaignService.createCampaign(campaignData, firebaseUid);
  }

  @Post('campaigns/list')
  async getCampaignsList(
    @Body() request: AdvertiserCampaignListRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<AdvertiserCampaignListResponse> {
    try {
      const firebaseUid = req.user.uid;
      return await this.advertiserService.getCampaignsList(
        firebaseUid,
        request,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve campaigns list',
      );
    }
  }

  @Get('dashboard/summary')
  async getDashboardSummary(@Request() req: { user: FirebaseUser }): Promise<{
    success: boolean;
    data: AdvertiserDashboardSummary;
    message?: string;
  }> {
    try {
      const firebaseUid = req.user.uid;
      const data =
        await this.advertiserService.getDashboardSummary(firebaseUid);

      return {
        success: true,
        data,
        message: 'Dashboard summary retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve dashboard summary',
      );
    }
  }

  @Get('campaigns/filters')
  getCampaignFilters(): {
    success: boolean;
    data: { statuses: CampaignStatus[]; types: CampaignType[] };
    message?: string;
  } {
    try {
      const data = this.advertiserService.getCampaignFilters();

      return {
        success: true,
        data,
        message: 'Campaign filters retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve campaign filters',
      );
    }
  }
  @Post('campaigns/:campaignId/applications/:applicationId/review')
  async reviewCampaignApplication(
    @Param('campaignId') campaignId: string,
    @Param('applicationId') applicationId: string, // Can be either application ID or promoter ID
    @Body()
    reviewData: { action: 'ACCEPTED' | 'REJECTED' },
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    message: string;
    data?: ReviewCampaignApplicationResult;
  }> {
    try {
      const firebaseUid = req.user.uid;
      const result: ReviewCampaignApplicationResult =
        await this.advertiserService.reviewCampaignApplication(
          firebaseUid,
          campaignId,
          applicationId,
          reviewData.action,
        );

      return {
        success: true,
        message: 'Application reviewed successfully',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to review application',
      );
    }
  }

  @Delete('campaigns/:campaignId')
  async deleteCampaign(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const firebaseUid = req.user.uid;
      const result = await this.advertiserService.deleteCampaign(
        firebaseUid,
        campaignId,
      );
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete campaign',
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

      const result = await this.promoterService.addCommentToWorkAsAdvertiser(
        firebaseUid,
        campaignId,
        deliverableId,
        workId,
        body.commentMessage,
      );

      return result;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add comment to work',
      };
    }
  }

  @Put('campaigns/:campaignId/deliverables/:deliverableId/finish')
  async markDeliverableAsFinished(
    @Param('campaignId') campaignId: string,
    @Param('deliverableId') deliverableId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const firebaseUid = req.user.uid;

      const result = await this.promoterService.markDeliverableAsFinished(
        firebaseUid,
        campaignId,
        deliverableId,
      );

      return result;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to mark deliverable as finished',
      };
    }
  }
}
