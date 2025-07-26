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
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertiserService } from '../services/advertiser.service';
import { AdvertiserPaymentService } from '../services/advertiser-payment.service';
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
  CampaignAdvertiser,
} from '../interfaces/advertiser-campaign';
import { Campaign } from '../interfaces/campaign';
import { CampaignWork } from '../interfaces/promoter-campaigns';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { ReviewCampaignApplicationResult } from 'src/interfaces/review-campaign-application-result';

// Payment DTOs
export class CompletePaymentSetupDto {
  companyName: string;
  email: string;
}

export class AddPaymentMethodDto {
  paymentMethodId: string;
  setAsDefault?: boolean = false;
}

export class AddFundsDto {
  amount: number; // in cents
  paymentMethodId?: string;
  description?: string;
}

export class FundCampaignDto {
  amount: number; // in cents
  source: 'wallet' | 'direct';
  paymentMethodId?: string;
}

export class UpdateBudgetDto {
  newBudget: number; // in cents
}

export class TransactionQueryDto {
  page?: number = 1;
  limit?: number = 10;
  type?: 'DEPOSIT' | 'WITHDRAWAL' | 'CAMPAIGN_FUNDING' | 'REFUND';
}

@Controller('advertiser')
export class AdvertiserController {
  constructor(
    private readonly advertiserService: AdvertiserService,
    private readonly advertiserPaymentService: AdvertiserPaymentService,
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

  @Get('campaigns/:campaignId')
  async getCampaignById(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{
    success: boolean;
    data: CampaignAdvertiser;
    message?: string;
  }> {
    const firebaseUid = req.user.uid;

    const data = await this.advertiserService.getCampaignById(
      firebaseUid,
      campaignId,
    );

    return {
      success: true,
      data,
      message: 'Campaign retrieved successfully',
    };
  }

  // Payment Setup Endpoints

  @Get('payment-setup/status')
  @HttpCode(HttpStatus.OK)
  async getPaymentSetupStatus(@Request() req: { user: FirebaseUser }) {
    const status = await this.advertiserPaymentService.getPaymentSetupStatus(
      req.user.uid,
    );

    return {
      success: true,
      data: status,
      message: 'Payment setup status retrieved successfully',
    };
  }

  @Post('payment-setup/complete')
  @HttpCode(HttpStatus.OK)
  async completePaymentSetup(
    @Request() req: { user: FirebaseUser },
    @Body() dto: CompletePaymentSetupDto,
  ) {
    const result = await this.advertiserPaymentService.completePaymentSetup(
      req.user.uid,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Payment setup completed successfully',
    };
  }

  // Payment Methods Endpoints

  @Get('payment-methods')
  @HttpCode(HttpStatus.OK)
  async getPaymentMethods(@Request() req: { user: FirebaseUser }) {
    const paymentMethods =
      await this.advertiserPaymentService.getPaymentMethods(req.user.uid);

    return {
      success: true,
      data: paymentMethods,
      message: 'Payment methods retrieved successfully',
    };
  }

  @Post('payment-methods/setup-intent')
  @HttpCode(HttpStatus.OK)
  async createSetupIntent(@Request() req: { user: FirebaseUser }) {
    const setupIntent = await this.advertiserPaymentService.createSetupIntent(
      req.user.uid,
    );

    return {
      success: true,
      data: setupIntent,
      message: 'Setup intent created successfully',
    };
  }

  @Post('payment-methods')
  @HttpCode(HttpStatus.OK)
  async addPaymentMethod(
    @Request() req: { user: FirebaseUser },
    @Body() dto: AddPaymentMethodDto,
  ) {
    await this.advertiserPaymentService.addPaymentMethod(req.user.uid, dto);

    return {
      success: true,
      message: 'Payment method added successfully',
    };
  }

  @Delete('payment-methods/:paymentMethodId')
  @HttpCode(HttpStatus.OK)
  async removePaymentMethod(
    @Request() req: { user: FirebaseUser },
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    await this.advertiserPaymentService.removePaymentMethod(
      req.user.uid,
      paymentMethodId,
    );

    return {
      success: true,
      message: 'Payment method removed successfully',
    };
  }

  @Put('payment-methods/:paymentMethodId/default')
  @HttpCode(HttpStatus.OK)
  async setDefaultPaymentMethod(
    @Request() req: { user: FirebaseUser },
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    await this.advertiserPaymentService.setDefaultPaymentMethod(
      req.user.uid,
      paymentMethodId,
    );

    return {
      success: true,
      message: 'Default payment method updated successfully',
    };
  }

  // Wallet Management Endpoints

  @Get('wallet/balance')
  @HttpCode(HttpStatus.OK)
  async getWalletBalance(@Request() req: { user: FirebaseUser }) {
    const balance = await this.advertiserPaymentService.getWalletBalance(
      req.user.uid,
    );

    return {
      success: true,
      data: balance,
      message: 'Wallet balance retrieved successfully',
    };
  }

  @Post('wallet/add-funds')
  @HttpCode(HttpStatus.OK)
  async addFunds(
    @Request() req: { user: FirebaseUser },
    @Body() dto: AddFundsDto,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const result = await this.advertiserPaymentService.addFunds(
      req.user.uid,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Add funds request processed successfully',
    };
  }

  @Get('wallet/transactions')
  @HttpCode(HttpStatus.OK)
  async getWalletTransactions(
    @Request() req: { user: FirebaseUser },
    @Query() query: TransactionQueryDto,
  ) {
    // Validate pagination parameters
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    if (query.page && query.page < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }

    const transactions = await this.advertiserPaymentService.getTransactions(
      req.user.uid,
      query,
    );

    return {
      success: true,
      data: transactions,
      message: 'Wallet transactions retrieved successfully',
    };
  }

  // Campaign Funding Endpoints

  @Post('campaigns/:campaignId/fund')
  @HttpCode(HttpStatus.OK)
  async fundCampaign(
    @Request() req: { user: FirebaseUser },
    @Param('campaignId') campaignId: string,
    @Body() dto: FundCampaignDto,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (dto.source === 'direct' && !dto.paymentMethodId) {
      throw new BadRequestException(
        'Payment method ID is required for direct payments',
      );
    }

    const result = await this.advertiserPaymentService.fundCampaign(
      req.user.uid,
      campaignId,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Campaign funded successfully',
    };
  }

  @Get('campaigns/:campaignId/funding-status')
  @HttpCode(HttpStatus.OK)
  async getCampaignFundingStatus(
    @Request() req: { user: FirebaseUser },
    @Param('campaignId') campaignId: string,
  ) {
    const status = await this.advertiserPaymentService.getCampaignFundingStatus(
      req.user.uid,
      campaignId,
    );

    return {
      success: true,
      data: status,
      message: 'Campaign funding status retrieved successfully',
    };
  }

  @Put('campaigns/:campaignId/budget')
  @HttpCode(HttpStatus.OK)
  async updateCampaignBudget(
    @Request() req: { user: FirebaseUser },
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    if (dto.newBudget <= 0) {
      throw new BadRequestException('Budget must be greater than 0');
    }

    const result = await this.advertiserPaymentService.updateCampaignBudget(
      req.user.uid,
      campaignId,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Campaign budget updated successfully',
    };
  }
}
