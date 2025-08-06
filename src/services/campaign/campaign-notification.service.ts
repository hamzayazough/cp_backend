import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { EmailService } from '../email/email.service';
import { CAMPAIGN_MANAGEMENT_CONSTANTS } from '../../constants/campaign-management.constants';
import {
  CampaignExpirationNotification,
  EmailNotificationData,
  CampaignsExpirationGroups,
} from '../../interfaces/campaign-management';

/**
 * Service responsible for sending campaign expiration notifications to advertisers
 */
@Injectable()
export class CampaignNotificationService {
  private readonly logger = new Logger(CampaignNotificationService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get campaigns expiring in the specified number of days
   * @param days - Number of days until expiry (7, 1, or 0)
   */
  async getCampaignsExpiringInDays(
    days: number,
  ): Promise<CampaignExpirationNotification[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);

    // For "ending today", we check if deadline is today or in the past
    let whereClause: string;
    let queryParameters: Record<string, any>;

    if (days === 0) {
      // Campaigns expiring today or already expired but still active
      whereClause = 'campaign.deadline <= :targetDate';
      queryParameters = { targetDate };
    } else {
      // Campaigns expiring exactly in X days
      const nextDay = new Date(targetDate);
      nextDay.setDate(targetDate.getDate() + 1);

      whereClause =
        'campaign.deadline >= :targetDate AND campaign.deadline < :nextDay';
      queryParameters = { targetDate, nextDay };
    }

    const campaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('campaign.status = :status', {
        status: CAMPAIGN_MANAGEMENT_CONSTANTS.COMPLETION_STATUS.ACTIVE,
      })
      .andWhere('campaign.deadline IS NOT NULL')
      .andWhere(whereClause, queryParameters)
      .getMany();

    return campaigns.map((campaign) => ({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignType: campaign.type,
      deadline: campaign.deadline,
      advertiserEmail: campaign.advertiser.email,
      advertiserName: campaign.advertiser.name,
      daysUntilExpiry: days,
    }));
  }

  /**
   * Group campaigns by their expiration timeframes
   */
  async getCampaignsGroupedByExpiration(): Promise<CampaignsExpirationGroups> {
    const [endingInWeek, endingInDay, endingToday] = await Promise.all([
      this.getCampaignsExpiringInDays(
        CAMPAIGN_MANAGEMENT_CONSTANTS.EXPIRATION_INTERVALS.ONE_WEEK_DAYS,
      ),
      this.getCampaignsExpiringInDays(
        CAMPAIGN_MANAGEMENT_CONSTANTS.EXPIRATION_INTERVALS.ONE_DAY_DAYS,
      ),
      this.getCampaignsExpiringInDays(
        CAMPAIGN_MANAGEMENT_CONSTANTS.EXPIRATION_INTERVALS.TODAY_DAYS,
      ),
    ]);

    return {
      endingInWeek,
      endingInDay,
      endingToday,
    };
  }

  /**
   * Send email notification for campaign expiration
   * @param campaign - Campaign expiration notification data
   * @param emailType - Type of email notification
   */
  async sendExpirationNotification(
    campaign: CampaignExpirationNotification,
    emailType: string,
  ): Promise<boolean> {
    try {
      const template = this.getEmailTemplate(emailType);
      const emailData = this.buildEmailData(campaign, template, emailType);

      return await this.emailService.sendEmail(emailData);
    } catch (error) {
      this.logger.error(
        `Failed to send expiration notification for campaign ${campaign.campaignId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send batch notifications for campaigns
   * @param campaigns - Array of campaigns to notify about
   * @param emailType - Type of email notification
   */
  async sendBatchExpirationNotifications(
    campaigns: CampaignExpirationNotification[],
    emailType: string,
  ): Promise<number> {
    if (campaigns.length === 0) {
      return 0;
    }

    this.logger.log(
      `📧 Sending ${emailType} notifications to ${campaigns.length} advertisers`,
    );

    const template = this.getEmailTemplate(emailType);
    const emails = campaigns.map((campaign) =>
      this.buildEmailData(campaign, template, emailType),
    );

    return await this.emailService.sendBatchEmails(emails);
  }

  /**
   * Get email template for the specified email type
   */
  private getEmailTemplate(emailType: string): {
    SUBJECT: string;
    MESSAGE: string;
  } {
    switch (emailType) {
      case CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_WEEK:
        return CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TEMPLATES
          .CAMPAIGN_ENDING_WEEK;
      case CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TYPES.CAMPAIGN_ENDING_DAY:
        return CAMPAIGN_MANAGEMENT_CONSTANTS.EMAIL_TEMPLATES
          .CAMPAIGN_ENDING_DAY;
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }
  }

  /**
   * Build email data from campaign notification and template
   */
  private buildEmailData(
    campaign: CampaignExpirationNotification,
    template: { SUBJECT: string; MESSAGE: string },
    emailType: string,
  ): EmailNotificationData {
    const templateVariables = {
      campaignTitle: campaign.campaignTitle,
      campaignType: campaign.campaignType,
      deadline: new Date(campaign.deadline).toLocaleDateString(),
      advertiserName: campaign.advertiserName,
    };

    const subject = this.replacePlaceholders(
      template.SUBJECT,
      templateVariables,
    );
    const message = this.replacePlaceholders(
      template.MESSAGE,
      templateVariables,
    );

    return {
      to: campaign.advertiserEmail,
      subject,
      message,
      templateType: emailType,
      templateVariables,
    };
  }

  /**
   * Replace template placeholders with actual values
   */
  private replacePlaceholders(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }
}
