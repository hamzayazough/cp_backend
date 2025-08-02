import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CampaignEarningsTracking } from '../database/entities/financial/campaign-earnings-tracking.entity';
import { PromoterPaymentService } from './promoter/promoter-payment.service';
import { CampaignEarningsService } from './campaign-earnings.service';
import { getCachedFxRate } from '../helpers/currency.helper';
import { TransactionType } from '../database/entities/transaction.entity';

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
  ) {}

  /**
   * Runs every 5 minutes to check for campaigns ready for payout
   * Calculates earnings and processes payouts for eligible campaigns
   */
  @Cron('0 * * * *', {
    name: 'campaignPayoutProcess',
    timeZone: 'UTC',
  })
  async processCampaignPayouts(): Promise<void> {
    this.logger.log('Starting campaign payout processing cycle');

    try {
      // Step 1: Calculate earnings for all active campaigns using the new service
      await this.campaignEarningsService.calculateAllCampaignEarnings();

      // Step 2: Process eligible campaign payouts
      await this.processEligibleCampaignPayouts();

      this.logger.log('Completed campaign payout processing cycle');
    } catch (error) {
      this.logger.error('Failed campaign payout processing cycle:', error);
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
          `  - Promoter ${earning.promoterId.substring(0, 8)}... has net earnings: $${netDollars} (needs $5.00 minimum)`,
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

    // Convert payout amount to promoter's preferred currency
    const campaignCurrency = earnings.campaign.currency;
    const promoterCurrency = earnings.promoter.usedCurrency;

    this.logger.log(
      `💱 Currency conversion: ${campaignCurrency} → ${promoterCurrency}`,
    );

    let payoutAmountCents = earnings.netEarningsCents;

    // Convert currency if needed
    if (campaignCurrency !== promoterCurrency) {
      this.logger.log(
        `🔄 Converting currency from ${campaignCurrency} to ${promoterCurrency}`,
      );
      const exchangeRate = getCachedFxRate(campaignCurrency, promoterCurrency);
      this.logger.log(`📈 Exchange rate: ${exchangeRate}`);
      payoutAmountCents = Math.round(earnings.netEarningsCents * exchangeRate);
      this.logger.log(
        `💰 Converted amount: ${earnings.netEarningsCents}¢ → ${payoutAmountCents}¢`,
      );
    } else {
      this.logger.log(`✅ No currency conversion needed`);
    }

    const payoutAmountDollars = payoutAmountCents / 100;

    this.logger.log(
      `💳 Processing campaign payout of ${payoutAmountDollars.toFixed(2)} ${promoterCurrency} for promoter ${earnings.promoterId} in campaign "${earnings.campaign.title}"${
        campaignCurrency !== promoterCurrency
          ? ` (converted from ${earnings.netEarningsDollars.toFixed(2)} ${campaignCurrency})`
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
          amount: payoutAmountCents, // Amount in promoter's currency
          description: `Campaign earnings payout for "${earnings.campaign.title}" - ${earnings.viewsGenerated} views generated`,
          transactionType: TransactionType.VIEW_EARNING,
        },
      );
      this.logger.log(`✅ Payment processed successfully:`, {
        paymentId: paymentResult.paymentId,
        amount: payoutAmountCents,
      });

      // Mark as paid in database using the new service
      this.logger.log(`📝 Marking payout as executed in database...`);
      await this.campaignEarningsService.markPayoutExecuted(
        earnings.id,
        payoutAmountCents,
        paymentResult.paymentId,
      );
      this.logger.log(`✅ Database updated successfully`);

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
}
