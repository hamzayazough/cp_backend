import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertiserService } from '../services/advertiser.service';
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
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';

@Controller('advertiser')
export class AdvertiserController {
  constructor(
    private readonly advertiserService: AdvertiserService,
    private readonly campaignService: CampaignService,
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
      console.log('Fetching campaigns list with request:', request);
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
}
