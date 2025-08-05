import { Controller, Post, Param, Get } from '@nestjs/common';
import { CampaignExpirationService } from '../services/campaign/campaign-expiration.service';
import { CampaignExpirationCheckResult } from '../interfaces/campaign-management';

/**
 * TESTING PURPOSES ONLY
 * TODO: Remove
 * Controller for campaign management operations
 * Provides endpoints for manual triggering of campaign expiration checks and completions
 */
@Controller('campaign-management')
export class CampaignManagementController {
  constructor(
    private readonly campaignExpirationService: CampaignExpirationService,
  ) {}

  /**
   * Manually trigger campaign expiration check
   * GET /campaign-management/check-expirations
   */
  @Get('check-expirations')
  async checkExpirations(): Promise<CampaignExpirationCheckResult> {
    return await this.campaignExpirationService.checkCampaignExpirations();
  }

  /**
   * Manually complete a specific campaign
   * POST /campaign-management/complete/:campaignId
   */
  @Post('complete/:campaignId')
  async completeCampaign(
    @Param('campaignId') campaignId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.campaignExpirationService.triggerCampaignCompletion(
        campaignId,
      );
      return {
        success: true,
        message: `Campaign ${campaignId} completed successfully`,
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
   * Manually send expiration notifications for campaigns ending in a week
   * POST /campaign-management/notify/week
   */
  @Post('notify/week')
  async notifyWeekExpiration(): Promise<{
    success: boolean;
    emailsSent: number;
    message: string;
  }> {
    try {
      const emailsSent =
        await this.campaignExpirationService.triggerExpirationNotifications(
          'week',
        );
      return {
        success: true,
        emailsSent,
        message: `Sent ${emailsSent} week expiration notifications`,
      };
    } catch (error) {
      return {
        success: false,
        emailsSent: 0,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Manually send expiration notifications for campaigns ending in a day
   * POST /campaign-management/notify/day
   */
  @Post('notify/day')
  async notifyDayExpiration(): Promise<{
    success: boolean;
    emailsSent: number;
    message: string;
  }> {
    try {
      const emailsSent =
        await this.campaignExpirationService.triggerExpirationNotifications(
          'day',
        );
      return {
        success: true,
        emailsSent,
        message: `Sent ${emailsSent} day expiration notifications`,
      };
    } catch (error) {
      return {
        success: false,
        emailsSent: 0,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
