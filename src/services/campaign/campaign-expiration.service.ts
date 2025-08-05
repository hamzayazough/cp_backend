import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CampaignNotificationService } from './campaign-notification.service';
import { CampaignCompletionService } from './campaign-management.service';
import { CAMPAIGN_MANAGEMENT_CONSTANTS } from '../../constants/campaign-management.constants';
import { CampaignExpirationCheckResult } from '../../interfaces/campaign-management';

/**
 * Main service that orchestrates campaign expiration checks and completion
 * Runs daily to check for campaigns ending soon and complete expired campaigns
 */
@Injectable()
export class CampaignExpirationService {
  private readonly logger = new Logger(CampaignExpirationService.name);

  constructor(
    private readonly campaignNotificationService: CampaignNotificationService,
    private readonly campaignCompletionService: CampaignCompletionService,
  ) {}

  /**
   * Daily cron job to check campaign expirations and send notifications
   * Runs at midnight every day
   */
  @Cron(CAMPAIGN_MANAGEMENT_CONSTANTS.CRON_SCHEDULES.DAILY_CHECK, {
    name: 'campaignExpirationCheck',
    timeZone: 'UTC',
  })
  async processCampaignExpirations(): Promise<void> {
    this.logger.log('🕒 Starting daily campaign expiration check');

    try {
      const result = await this.checkCampaignExpirations();

      this.logger.log(
        `✅ Daily campaign expiration check completed successfully:\n` +
          `   📊 Total campaigns checked: ${result.totalCampaignsChecked}\n` +
          `   📧 Campaigns ending in week: ${result.campaignsEndingInWeek}\n` +
          `   📧 Campaigns ending in day: ${result.campaignsEndingInDay}\n` +
          `   🏁 Campaigns completed today: ${result.campaignsCompletedToday}\n` +
          `   ✉️  Total emails sent: ${result.emailsSent}\n` +
          `   ❌ Errors encountered: ${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          '⚠️ Some errors occurred during processing:',
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to complete daily campaign expiration check:',
        error,
      );
    }
  }

  /**
   * Manual trigger for campaign expiration processing
   */
  async checkCampaignExpirations(): Promise<CampaignExpirationCheckResult> {
    const result: CampaignExpirationCheckResult = {
      totalCampaignsChecked: 0,
      campaignsEndingInWeek: 0,
      campaignsEndingInDay: 0,
      campaignsCompletedToday: 0,
      emailsSent: 0,
      errors: [],
    };

    try {
      // 1. Get campaigns grouped by expiration timeframes
      this.logger.log(
        '📋 Fetching campaigns grouped by expiration timeframes...',
      );
      const campaignsGroups =
        await this.campaignNotificationService.getCampaignsGroupedByExpiration();

      result.totalCampaignsChecked =
        campaignsGroups.endingInWeek.length +
        campaignsGroups.endingInDay.length +
        campaignsGroups.endingToday.length;

      result.campaignsEndingInWeek = campaignsGroups.endingInWeek.length;
      result.campaignsEndingInDay = campaignsGroups.endingInDay.length;
      result.campaignsCompletedToday = campaignsGroups.endingToday.length;

      // 2. Send notifications for campaigns ending in a week
      if (campaignsGroups.endingInWeek.length > 0) {
        this.logger.log(
          `📧 Processing ${campaignsGroups.endingInWeek.length} campaigns ending in a week...`,
        );
        try {
          const weekEmailsSent =
            await this.campaignNotificationService.sendBatchExpirationNotifications(
              campaignsGroups.endingInWeek,
              CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_WEEK,
            );
          result.emailsSent += weekEmailsSent;
        } catch (error) {
          const errorMsg = `Failed to send week expiration notifications: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      // 3. Send notifications for campaigns ending in a day
      if (campaignsGroups.endingInDay.length > 0) {
        this.logger.log(
          `📧 Processing ${campaignsGroups.endingInDay.length} campaigns ending in a day...`,
        );
        try {
          const dayEmailsSent =
            await this.campaignNotificationService.sendBatchExpirationNotifications(
              campaignsGroups.endingInDay,
              CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_DAY,
            );
          result.emailsSent += dayEmailsSent;
        } catch (error) {
          const errorMsg = `Failed to send day expiration notifications: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      // 4. Complete campaigns ending today
      if (campaignsGroups.endingToday.length > 0) {
        this.logger.log(
          `🏁 Completing ${campaignsGroups.endingToday.length} campaigns ending today...`,
        );
        try {
          const campaignIds = campaignsGroups.endingToday.map(
            (c) => c.campaignId,
          );
          const completionResults =
            await this.campaignCompletionService.completeCampaignsBatch(
              campaignIds,
            );

          this.logger.log(
            `✅ Campaign completion results: ${completionResults.length}/${campaignIds.length} campaigns completed successfully`,
          );
        } catch (error) {
          const errorMsg = `Failed to complete campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      return result;
    } catch (error) {
      const errorMsg = `Failed to check campaign expirations: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg, error);
      throw error;
    }
  }

  /**
   * Manual trigger for completing a specific campaign
   * @param campaignId - ID of the campaign to complete
   */
  async triggerCampaignCompletion(campaignId: string): Promise<void> {
    this.logger.log(`🎯 Manual trigger: completing campaign ${campaignId}`);

    try {
      const result =
        await this.campaignCompletionService.completeCampaign(campaignId);

      this.logger.log(
        `✅ Campaign ${campaignId} completed manually. ` +
          `Affected: ${result.affectedPromoterCampaigns} promoter campaigns, ` +
          `${result.updatedPromoterDetails} promoter details, ` +
          `${result.updatedUserStats} user stats`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to manually complete campaign ${campaignId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Manual trigger for sending expiration notifications for a specific timeframe
   * @param timeframe - 'week' or 'day'
   */
  async triggerExpirationNotifications(
    timeframe: 'week' | 'day',
  ): Promise<number> {
    this.logger.log(
      `🎯 Manual trigger: sending ${timeframe} expiration notifications`,
    );

    try {
      const days = timeframe === 'week' ? 7 : 1;
      const emailType =
        timeframe === 'week'
          ? CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_WEEK
          : CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_DAY;

      const campaigns =
        await this.campaignNotificationService.getCampaignsExpiringInDays(days);

      if (campaigns.length === 0) {
        this.logger.log(`📭 No campaigns found ending in ${timeframe}`);
        return 0;
      }

      const emailsSent =
        await this.campaignNotificationService.sendBatchExpirationNotifications(
          campaigns,
          emailType,
        );

      this.logger.log(
        `✅ Sent ${emailsSent}/${campaigns.length} ${timeframe} expiration notifications successfully`,
      );

      return emailsSent;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send ${timeframe} expiration notifications:`,
        error,
      );
      throw error;
    }
  }
}
