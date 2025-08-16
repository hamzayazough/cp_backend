import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CampaignEarningsTracking } from '../../database/entities/financial/campaign-earnings-tracking.entity';
import { PromoterPaymentService } from '../promoter/promoter-payment.service';
import { CampaignEarningsService } from './campaign-earnings.service';
import { getCachedFxRate } from '../../helpers/currency.helper';
import { TransactionType } from '../../database/entities/transaction.entity';
import { NotificationType } from '../../enums/notification-type';
import { CAMPAIGN_MANAGEMENT_CONSTANTS } from 'src/constants/campaign-management.constants';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../notification-delivery.service';
import { NotificationHelperService } from '../notifications/notification-helper.service';

/**
 * Automated campaign-based payout processing service
 * Continuously processes payouts for campaigns that reach the $5 minimum threshold
 */
@Injectable()
export class CampaignPayoutService {
  private readonly logger = new Logger(CampaignPayoutService.name);

  constructor(
    @InjectRepository(CampaignEarningsTracking)
    private readonly campaignEarningsRepo: Repository<CampaignEarningsTracking>,
    private readonly dataSource: DataSource,
    private readonly promoterPaymentService: PromoterPaymentService,
    private readonly campaignEarningsService: CampaignEarningsService,
    private readonly notificationDeliveryService: NotificationDeliveryService,
    private readonly notificationHelperService: NotificationHelperService,
  ) {}

  /**
   * Runs every 5 minutes to check for campaigns ready for payout (TESTING MODE)
   * Calculates earnings and processes payouts for eligible campaigns
   */
  @Cron(CAMPAIGN_MANAGEMENT_CONSTANTS.CRON_SCHEDULES.MONTHLY_CHECK, {
    name: 'campaignPayoutProcess',
    timeZone: 'UTC',
  })
  async processCampaignPayouts(): Promise<void> {
    this.logger.log(
      '🚀 Starting campaign payout processing cycle (every 5 minutes for testing)',
    );

    try {
      // For testing: Calculate earnings for current month
      // In production, this would be calculatePreviousMonthEarnings()
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // getMonth() is 0-indexed
      const currentYear = currentDate.getFullYear();

      this.logger.log(
        `📅 Calculating earnings for current month: ${currentMonth}/${currentYear}`,
      );

      // Check if we've already calculated earnings for this month to avoid duplicates
      const hasCalculations =
        await this.campaignEarningsService.hasCalculationsForMonth(
          currentMonth,
          currentYear,
        );

      if (hasCalculations) {
        this.logger.log(
          `⏭️  Earnings already calculated for ${currentMonth}/${currentYear}, skipping calculation`,
        );
      } else {
        this.logger.log(
          `🔢 Calculating new earnings for ${currentMonth}/${currentYear}`,
        );
        await this.campaignEarningsService.calculateAllCampaignEarnings(
          currentMonth,
          currentYear,
        );
      }

      // Step 2: Process eligible campaign payouts
      await this.processEligibleCampaignPayouts();

      this.logger.log('✅ Completed campaign payout processing cycle');
    } catch (error) {
      this.logger.error('❌ Failed campaign payout processing cycle:', error);
    }
  }

  /**
   * Process payouts for campaigns that meet the minimum threshold
   */
  private async processEligibleCampaignPayouts(): Promise<void> {
    this.logger.log('🔍 Checking for campaigns eligible for payout...');

    // Get all campaign earnings records for debugging
    const allEarnings =
      await this.campaignEarningsService.getAllEarningsRecords();

    this.logger.log(
      `📊 Found ${allEarnings.length} total campaign earnings records:`,
    );
    allEarnings.forEach((earning) => {
      this.logger.log(
        `  - Promoter: ${earning.promoterId.substring(0, 8)}..., ` +
          `Campaign: ${earning.campaignId.substring(0, 8)}..., ` +
          `Views: ${earning.viewsGenerated}, ` +
          `Gross: ${earning.grossEarningsCents}¢, ` +
          `Platform Fee: ${earning.platformFeeCents}¢, ` +
          `Net: ${earning.netEarningsCents}¢, ` +
          `Qualifies: ${earning.qualifiesForPayout}, ` +
          `Executed: ${earning.payoutExecuted}`,
      );
    });

    // Get eligible campaigns for payout
    const eligibleEarnings =
      await this.campaignEarningsService.getEligiblePayouts();

    this.logger.log(
      `💰 Found ${eligibleEarnings.length} campaigns eligible for payout`,
    );

    if (eligibleEarnings.length === 0) {
      this.logger.log('❌ No campaigns eligible for payout at this time');

      // Let's check why no campaigns qualify
      const nonQualifyingEarnings = allEarnings.filter(
        (earning) => !earning.qualifiesForPayout,
      );

      this.logger.log(
        `🔍 Reasons for non-qualification (${nonQualifyingEarnings.length} records):`,
      );
      nonQualifyingEarnings.forEach((earning) => {
        const netDollars = earning.netEarningsCents
          ? (earning.netEarningsCents / 100).toFixed(2)
          : 'NULL';
        this.logger.log(
          `  - Promoter ${earning.promoterId.substring(0, 8)}... has net earnings: $${netDollars} (minimum: $0.01)`,
        );
      });

      return;
    }

    this.logger.log(
      `💳 Processing payouts for ${eligibleEarnings.length} eligible campaigns`,
    );

    const totalPayoutAmount =
      eligibleEarnings.reduce(
        (sum, earnings) => sum + (earnings.netEarningsCents || 0),
        0,
      ) / 100; // Convert to dollars

    this.logger.log(`💰 Total payout amount: $${totalPayoutAmount.toFixed(2)}`);

    // Process each campaign payout
    for (const earnings of eligibleEarnings) {
      try {
        this.logger.log(
          `🎯 Processing individual payout for promoter ${earnings.promoterId.substring(0, 8)}... in campaign ${earnings.campaignId.substring(0, 8)}...`,
        );
        await this.processIndividualCampaignPayout(earnings);
      } catch (error) {
        this.logger.error(
          `❌ Failed to process payout for campaign ${earnings.campaignId} and promoter ${earnings.promoterId}:`,
          error,
        );
      }
    }
  }

  /**
   * Process individual campaign payout via Stripe Connect
   */
  private async processIndividualCampaignPayout(
    earnings: CampaignEarningsTracking,
  ): Promise<void> {
    this.logger.log(
      `🏁 Starting individual payout process for promoter ${earnings.promoterId.substring(0, 8)}...`,
    );
    this.logger.log(`📊 Earnings details:`, {
      viewsGenerated: earnings.viewsGenerated,
      grossEarningsCents: earnings.grossEarningsCents,
      platformFeeCents: earnings.platformFeeCents,
      netEarningsCents: earnings.netEarningsCents,
      qualifiesForPayout: earnings.qualifiesForPayout,
      payoutExecuted: earnings.payoutExecuted,
    });

    // The payment should be based on NET earnings (after 20% platform fee)
    // Currency conversion will be handled by the PromoterPaymentService
    const campaignCurrency = earnings.campaign.currency;
    const promoterCurrency = earnings.promoter.usedCurrency;

    this.logger.log(
      `💱 Currency conversion: ${campaignCurrency} → ${promoterCurrency}`,
    );

    // Use NET earnings (after 20% fee) as the base amount - NO conversion here
    const netEarningsCents = earnings.netEarningsCents;
    const netEarningsDollars = netEarningsCents / 100;

    // We need to pass the GROSS amount to the payment service so it can:
    // 1. Calculate the 20% platform fee correctly
    // 2. Handle currency conversion properly
    // 3. Update budget tracking with the full gross amount
    const grossEarningsCents = earnings.grossEarningsCents;

    if (campaignCurrency !== promoterCurrency) {
      this.logger.log(
        `🔄 Converting currency from ${campaignCurrency} to ${promoterCurrency}`,
      );
      const exchangeRate = getCachedFxRate(campaignCurrency, promoterCurrency);
      this.logger.log(`📈 Exchange rate: ${exchangeRate}`);
      const convertedNetEarnings = Math.round(netEarningsCents * exchangeRate);
      this.logger.log(
        `💰 Converted amount: ${netEarningsCents}¢ → ${convertedNetEarnings}¢`,
      );
    } else {
      this.logger.log(`✅ No currency conversion needed`);
    }

    this.logger.log(
      `💳 Processing campaign payout of ${netEarningsDollars.toFixed(2)} ${campaignCurrency} for promoter ${earnings.promoterId} in campaign "${earnings.campaign.title}"${
        campaignCurrency !== promoterCurrency
          ? ` (converted from ${netEarningsDollars.toFixed(2)} ${campaignCurrency})`
          : ''
      }`,
    );

    try {
      // Check if promoter has Stripe account
      this.logger.log(`🔍 Checking Stripe Connect account for promoter...`);
      if (!earnings.promoter.stripeConnectAccount) {
        this.logger.error(
          `❌ Promoter ${earnings.promoterId} does not have a Stripe account configured`,
        );
        throw new Error(
          `Promoter ${earnings.promoterId} does not have a Stripe account configured`,
        );
      }
      this.logger.log(
        `✅ Stripe Connect account found: ${earnings.promoter.stripeConnectAccount.stripeAccountId}`,
      );

      // Use the promoter payment service to process the payment
      this.logger.log(`💳 Initiating payment via PromoterPaymentService...`);
      const paymentResult = await this.promoterPaymentService.payPromoter(
        earnings.campaign.advertiser.firebaseUid,
        {
          campaignId: earnings.campaignId,
          promoterId: earnings.promoterId,
          amount: grossEarningsCents, // Pass GROSS amount - service will calculate 20% fee and handle conversion
          description: `Campaign earnings payout for "${earnings.campaign.title}" - ${earnings.viewsGenerated} views generated`,
          transactionType: TransactionType.VIEW_EARNING,
        },
      );
      this.logger.log(`✅ Payment processed successfully:`, {
        paymentId: paymentResult.paymentId,
        amount: grossEarningsCents,
      });

      // Mark as paid in database using NET earnings in campaign currency (not converted)
      this.logger.log(`📝 Marking payout as executed in database...`);
      await this.campaignEarningsService.markPayoutExecuted(
        earnings.id,
        netEarningsCents, // Store NET earnings in campaign currency (560¢ CAD, not 507¢ USD)
        paymentResult.paymentId,
      );
      this.logger.log(`✅ Database updated successfully`);

      // Send additional payout processed notification for campaign earnings
      try {
        await this.sendCampaignEarningsPayoutNotification(
          earnings,
          netEarningsCents,
          paymentResult.paymentId,
        );
      } catch (notificationError) {
        this.logger.error(
          `Failed to send payout processed notification to promoter ${earnings.promoterId}:`,
          notificationError,
        );
        // Don't throw error - payment was successful, notification is optional
      }

      this.logger.log(
        `🎉 Successfully processed campaign payout for promoter ${earnings.promoterId} in campaign ${earnings.campaignId} - Payment ID: ${paymentResult.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to process campaign payout for promoter ${earnings.promoterId} in campaign ${earnings.campaignId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Manual trigger for calculating earnings for a specific campaign
   */
  async triggerCampaignEarningsCalculation(campaignId: string): Promise<void> {
    this.logger.log(
      `Manual trigger: calculating earnings for campaign ${campaignId}`,
    );

    // Use the new service to calculate earnings
    await this.campaignEarningsService.calculateAllCampaignEarnings();

    this.logger.log(
      `Completed earnings calculation for campaign ${campaignId}`,
    );
  }

  /**
   * Manual trigger for processing payouts for a specific promoter
   */
  async triggerPromoterPayouts(promoterId: string): Promise<void> {
    this.logger.log(
      `Manual trigger: processing payouts for promoter ${promoterId}`,
    );

    const eligibleEarnings =
      await this.campaignEarningsService.getEligiblePayouts();
    const promoterEarnings = eligibleEarnings.filter(
      (earning) => earning.promoterId === promoterId,
    );

    for (const earnings of promoterEarnings) {
      await this.processIndividualCampaignPayout(earnings);
    }

    this.logger.log(`Completed payout processing for promoter ${promoterId}`);
  }

  /**
   * Send campaign earnings payout notification to promoter
   * This is sent in addition to the PAYMENT_RECEIVED notification to provide
   * more context about the automated earnings payout
   */
  private async sendCampaignEarningsPayoutNotification(
    earnings: CampaignEarningsTracking,
    netEarningsCents: number,
    paymentId: string,
  ): Promise<void> {
    this.logger.log(
      `📧 Sending campaign earnings payout notification to promoter: ${earnings.promoterId}`,
    );

    try {
      // Get notification delivery methods for this promoter
      const deliveryMethods =
        await this.notificationHelperService.getNotificationMethods(
          earnings.promoterId,
          NotificationType.PAYOUT_PROCESSED,
        );

      if (deliveryMethods.length === 0) {
        this.logger.log(
          `Promoter ${earnings.promoterId} has disabled payout processed notifications`,
        );
        return; // User has disabled notifications for payouts
      }

      const netEarningsDollars = (netEarningsCents / 100).toFixed(2);
      const campaignCurrency = earnings.campaign.currency;

      // Prepare notification data
      const notificationData: NotificationDeliveryData = {
        userId: earnings.promoterId,
        notificationType: NotificationType.PAYOUT_PROCESSED,
        title: '🏦 Campaign Earnings Payout Processed',
        message: `Great news! Your campaign earnings payout of $${netEarningsDollars} ${campaignCurrency} has been processed for campaign "${earnings.campaign.title}". You generated ${earnings.viewsGenerated} views during ${earnings.earningsMonth}/${earnings.earningsYear}. The payment has been sent to your connected payment account and should arrive within 2-7 business days.`,
        deliveryMethods,
        metadata: {
          campaignId: earnings.campaignId,
          campaignTitle: earnings.campaign.title,
          campaignCurrency: campaignCurrency,
          payoutAmount: netEarningsCents,
          payoutAmountDollars: netEarningsDollars,
          paymentId: paymentId,
          viewsGenerated: earnings.viewsGenerated,
          grossEarningsCents: earnings.grossEarningsCents,
          platformFeeCents: earnings.platformFeeCents,
          netEarningsCents: earnings.netEarningsCents,
          payoutType: 'automated_campaign_earnings',
          processedAt: new Date().toISOString(),
          earningsMonth: earnings.earningsMonth,
          earningsYear: earnings.earningsYear,
        },
        campaignId: earnings.campaignId,
      };

      // Send notification
      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );

      this.logger.log(
        `Campaign earnings payout notification sent to promoter: ${earnings.promoterId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send campaign earnings payout notification to promoter ${earnings.promoterId}:`,
        error,
      );
      throw error;
    }
  }
}
