import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Get,
  Param,
  Delete,
  Put,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AdvertiserService } from '../services/advertiser/advertiser.service';
import { AdvertiserPaymentService } from 'src/services/advertiser/advertiser-payment-facade.service';
import { PromoterService } from 'src/services/promoter/promoter.service';
import {
  CampaignService,
  CreateCampaignResponse,
  UploadFileResponse,
  UploadMultipleFilesResponse,
  DeleteMediaResponse,
} from 'src/services/campaign/campaign.service';
import {
  GetAdvertiserDashboardRequest,
  GetAdvertiserDashboardResponse,
} from '../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  CampaignAdvertiser,
} from '../interfaces/advertiser-campaign';
import { Campaign } from '../interfaces/campaign';
import { CampaignWork } from '../interfaces/promoter-campaigns';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignType, CampaignStatus } from '../enums/campaign-type';
import { ReviewCampaignApplicationResult } from 'src/interfaces/review-campaign-application-result';
import { TransactionType } from 'src/database/entities/transaction.entity';
import { FAILED_DASHBOARD_DATA } from 'src/constants/advertiser.constants';
import { ApplicationStatus } from 'src/database/entities/campaign-applications.entity';

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

export class UpdateBudgetDto {
  additionalBudget: number; // in cents
}

export class TransactionQueryDto {
  page?: number = 1;
  limit?: number = 10;
  type?: TransactionType;
}

export class WithdrawFundsDto {
  amount: number; // Amount in cents
  bankAccountId?: string; // Optional: specific bank account to withdraw to
  description?: string;
}

export class CheckCampaignFundingDto {
  estimatedBudgetCents: number; // in cents
}

export class PayPromoterDto {
  campaignId: string;
  promoterId: string;
  amount: number; // in cents
  description?: string;
  transactionType?: TransactionType;
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
        data: FAILED_DASHBOARD_DATA,
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

  @Post('upload-files')
  @UseInterceptors(FilesInterceptor('files', 10)) // Maximum 10 files
  async uploadCampaignFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<UploadMultipleFilesResponse> {
    if (!campaignId) {
      throw new BadRequestException('Campaign ID is required');
    }

    if (!files || files.length === 0) {
      // Return success response for 0 files case
      return {
        success: true,
        message: 'No files uploaded',
        uploadedFiles: [],
        failedFiles: [],
      };
    }

    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed');
    }

    const firebaseUid = req.user.uid;
    return await this.campaignService.uploadCampaignFiles(
      files,
      campaignId,
      firebaseUid,
    );
  }

  @Delete('campaigns/:campaignId/media')
  async deleteCampaignMedia(
    @Param('campaignId') campaignId: string,
    @Body('mediaUrl') mediaUrl: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<DeleteMediaResponse> {
    if (!mediaUrl) {
      throw new BadRequestException('Media URL is required');
    }

    const firebaseUid = req.user.uid;
    return this.campaignService.deleteCampaignMedia(
      campaignId,
      mediaUrl,
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
    reviewData: {
      action: ApplicationStatus.ACCEPTED | ApplicationStatus.REJECTED;
    },
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

  // TODO: work back on this once advertiser will have a stripe connect id
  @Post('wallet/withdraw-funds')
  @HttpCode(HttpStatus.OK)
  async withdrawFunds(
    @Request() req: { user: FirebaseUser },
    @Body() dto: WithdrawFundsDto,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (dto.amount < 600) {
      // Minimum $6 withdrawal to cover $5 fee + $1 net
      throw new BadRequestException(
        'Minimum withdrawal amount is $6.00 (includes $5.00 processing fee)',
      );
    }

    const result = await this.advertiserPaymentService.withdrawFunds(
      req.user.uid,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Withdrawal request processed successfully',
    };
  }

  @Get('wallet/withdrawal-limits')
  @HttpCode(HttpStatus.OK)
  async getWithdrawalLimits(@Request() req: { user: FirebaseUser }) {
    try {
      const limits = await this.advertiserPaymentService.getWithdrawalLimits(
        req.user.uid,
      );

      return {
        success: true,
        data: limits,
        message: 'Withdrawal limits retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve withdrawal limits',
      );
    }
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
    console.log('=== UPDATE CAMPAIGN BUDGET ENDPOINT ===');
    console.log('Firebase UID:', req.user.uid);
    console.log('Campaign ID:', campaignId);
    console.log('Request DTO:', dto);
    console.log('Additional Budget (cents):', dto.additionalBudget);
    console.log('Additional Budget (dollars):', dto.additionalBudget / 100);

    if (dto.additionalBudget <= 0) {
      console.log(
        '❌ Validation failed: Additional budget must be greater than 0',
      );
      throw new BadRequestException('Additional budget must be greater than 0');
    }

    console.log('✅ Validation passed, calling campaign service...');

    try {
      const result = await this.campaignService.updateCampaignBudget(
        req.user.uid,
        campaignId,
        dto.additionalBudget,
      );

      console.log('✅ Campaign service returned result:', result);

      return {
        success: true,
        data: result,
        message: 'Campaign budget updated successfully',
      };
    } catch (error) {
      console.error('❌ Error in updateCampaignBudget:', error);
      console.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw error;
    }
  }

  @Post('campaigns/funding-check')
  @HttpCode(HttpStatus.OK)
  async checkCampaignFundingFeasibility(
    @Request() req: { user: FirebaseUser },
    @Body() dto: CheckCampaignFundingDto,
  ) {
    if (!dto.estimatedBudgetCents || dto.estimatedBudgetCents <= 0) {
      throw new BadRequestException('Estimated budget must be greater than 0');
    }

    const feasibility =
      await this.advertiserPaymentService.checkCampaignFundingFeasibility(
        req.user.uid,
        dto,
      );

    return {
      success: true,
      data: feasibility,
      message: feasibility.canAfford
        ? 'Sufficient funds available for campaign'
        : `Additional funding of $${feasibility.shortfallAmount.toFixed(2)} required`,
    };
  }

  @Post('campaigns/pay-promoter')
  @HttpCode(HttpStatus.OK)
  async payPromoter(
    @Request() req: { user: FirebaseUser },
    @Body() dto: PayPromoterDto,
  ) {
    if (!dto.campaignId || !dto.promoterId) {
      throw new BadRequestException('Campaign ID and Promoter ID are required');
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    // Minimum payment of $1.00
    if (dto.amount < 100) {
      throw new BadRequestException('Minimum payment amount is $1.00');
    }
    const result = await this.advertiserPaymentService.payPromoter(
      req.user.uid,
      dto,
    );

    return {
      success: true,
      data: result,
      message: `Payment of $${(dto.amount / 100).toFixed(2)} processed successfully`,
    };
  }
}
