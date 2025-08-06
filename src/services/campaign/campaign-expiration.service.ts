import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignNotificationService } from './campaign-notification.service';
import { CampaignCompletionService } from './campaign-management.service';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { UserEntity } from '../../database/entities';
import { CampaignStatus } from '../../enums/campaign-status';
import { CAMPAIGN_MANAGEMENT_CONSTANTS } from '../../constants/campaign-management.constants';
import { CampaignExpirationCheckResult } from '../../interfaces/campaign-management';

/**
 * Main service that orchestrates campaign expiration checks and completion
 * Runs daily to check for campaigns ending soon and complete expired campaigns
 */
@Injectable()
export class CampaignExpirationService {
  private readonly logger = new Logger(CampaignExpirationService.name);
  private isProcessing = false; // Lock to prevent overlapping executions

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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
    // Prevent overlapping executions
    if (this.isProcessing) {
      this.logger.warn(
        '⏳ Campaign expiration check already in progress, skipping this execution',
      );
      return;
    }

    this.isProcessing = true;
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
    } finally {
      this.isProcessing = false;
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

  /**
   * Extend a campaign's deadline by adding days
   * @param firebaseUid - Firebase UID of the requesting user
   * @param campaignId - ID of the campaign to extend
   * @param additionalDays - Number of days to add to the current deadline
   * @returns The updated campaign with new deadline
   */
  async extendCampaignDeadline(
    firebaseUid: string,
    campaignId: string,
    additionalDays: number,
  ): Promise<{ success: boolean; message: string; newDeadline: Date }> {
    this.logger.log(
      `🔄 Extending campaign ${campaignId} deadline by ${additionalDays} days for user ${firebaseUid}`,
    );

    try {
      // Validate input
      if (additionalDays <= 0) {
        throw new BadRequestException(
          'Additional days must be a positive number',
        );
      }

      // Find the user by Firebase UID
      const user = await this.userRepository.findOne({
        where: { firebaseUid },
        select: ['id', 'name', 'email'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Find the campaign with advertiser check
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
        select: ['id', 'title', 'deadline', 'status', 'advertiserId'],
      });

      if (!campaign) {
        throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
      }

      // Validate campaign ownership
      if (campaign.advertiserId !== user.id) {
        throw new ForbiddenException(
          'You are not authorized to modify this campaign',
        );
      }

      // Validate campaign status
      if (campaign.status !== CampaignStatus.ACTIVE) {
        throw new BadRequestException(
          'Can only extend deadline for active campaigns',
        );
      }

      if (!campaign.deadline) {
        throw new BadRequestException('Campaign does not have a deadline set');
      }

      // Calculate new deadline
      const currentDeadline = new Date(campaign.deadline);
      const newDeadline = new Date(currentDeadline);
      newDeadline.setDate(currentDeadline.getDate() + additionalDays);

      // Update the campaign deadline
      await this.campaignRepository.update(
        { id: campaignId },
        {
          deadline: newDeadline,
          updatedAt: new Date(),
        },
      );

      this.logger.log(
        `✅ Campaign ${campaignId} deadline extended by user ${user.email} from ${currentDeadline.toISOString()} to ${newDeadline.toISOString()}`,
      );

      return {
        success: true,
        message: `Campaign "${campaign.title}" deadline extended by ${additionalDays} days`,
        newDeadline,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to extend campaign ${campaignId} deadline for user ${firebaseUid}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new Error(
        `Failed to extend campaign deadline: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
