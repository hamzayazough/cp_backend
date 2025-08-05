import {
  Controller,
  Param,
  Request,
  Logger,
  Patch,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CampaignExpirationService } from '../services/campaign/campaign-expiration.service';
import { AdvertiserService } from '../services/advertiser/advertiser.service';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { CampaignAdvertiser } from '../interfaces/advertiser-campaign';

/**
 * Controller for campaign management operations
 * Provides endpoints for manual triggering of campaign expiration checks and completions
 * All endpoints are protected and require Firebase authentication
 */
@Controller('campaign-management')
export class CampaignManagementController {
  private readonly logger = new Logger(CampaignManagementController.name);

  constructor(
    private readonly campaignExpirationService: CampaignExpirationService,
    private readonly advertiserService: AdvertiserService,
  ) {}

  /**
   * Complete a specific campaign
   * PATCH /campaign-management/campaigns/:campaignId/complete
   */
  @Patch('campaigns/:campaignId/complete')
  async completeCampaign(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; data?: CampaignAdvertiser }> {
    this.logger.log(
      `Campaign completion triggered by user: ${req.user.uid} for campaign: ${campaignId}`,
    );
    try {
      await this.campaignExpirationService.triggerCampaignCompletion(
        campaignId,
      );

      // Get the completed campaign data
      const campaignData = await this.advertiserService.getCampaignById(
        req.user.uid,
        campaignId,
      );

      return {
        success: true,
        message: `Campaign ${campaignId} completed successfully`,
        data: campaignData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Extend a campaign's deadline by adding days
   * PATCH /campaign-management/campaigns/:campaignId/extend/:additionalDays
   */
  @Patch('campaigns/:campaignId/extend/:additionalDays')
  async extendCampaignDeadline(
    @Param('campaignId') campaignId: string,
    @Param('additionalDays', ParseIntPipe) additionalDays: number,
    @Request() req: { user: FirebaseUser },
  ): Promise<{ success: boolean; message: string; newDeadline?: string }> {
    this.logger.log(
      `Campaign deadline extension triggered by user: ${req.user.uid} for campaign: ${campaignId} by ${additionalDays} days`,
    );

    try {
      const result =
        await this.campaignExpirationService.extendCampaignDeadline(
          req.user.uid,
          campaignId,
          additionalDays,
        );

      return {
        success: true,
        message: result.message,
        newDeadline: result.newDeadline.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to extend campaign ${campaignId} deadline:`,
        error,
      );

      // Re-throw HTTP exceptions so NestJS can handle them with proper status codes
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // For other errors, return a generic response
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
