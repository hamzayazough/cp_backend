import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CampaignEarningsTracking } from '../database/entities/financial/campaign-earnings-tracking.entity';
import { PromoterPaymentService } from './promoter/promoter-payment.service';
import { getCachedFxRate } from '../helpers/currency.helper';
import { TransactionType } from '../database/entities/transaction.entity';

interface CampaignPromoterPair {
  promoter_id: string;
  campaign_id: string;
}

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
  ) {}

  /**
   * Runs every hour to check for campaigns ready for payout
   * Calculates earnings and processes payouts for eligible campaigns
   */
  @Cron('0 * * * *', {
    name: 'campaignPayoutProcess',
    timeZone: 'UTC',
  })
  async processCampaignPayouts(): Promise<void> {
    this.logger.log('Starting campaign payout processing cycle');

    try {
      // Step 1: Calculate earnings for all active campaigns
      await this.calculateAllCampaignEarnings();

      // Step 2: Process eligible campaign payouts
      await this.processEligibleCampaignPayouts();

      this.logger.log('Completed campaign payout processing cycle');
    } catch (error) {
      this.logger.error('Failed campaign payout processing cycle:', error);
    }
  }

  /**
   * Calculate earnings for all promoters in all active VISIBILITY campaigns
   */
  private async calculateAllCampaignEarnings(): Promise<void> {
    this.logger.log('Calculating earnings for all active campaigns');

    // Get all active VISIBILITY campaigns with promoter views
    const campaignPromoterPairs: CampaignPromoterPair[] = await this.dataSource
      .query(`
      SELECT DISTINCT 
        uv.promoter_id,
        uv.campaign_id
      FROM unique_views uv
      INNER JOIN campaigns c ON c.id = uv.campaign_id
      WHERE c.type = 'VISIBILITY'
        AND c.status = 'ACTIVE'
    `);

    this.logger.log(
      `Found ${campaignPromoterPairs.length} campaign-promoter pairs to process`,
    );

    // Calculate earnings for each campaign-promoter pair
    for (const pair of campaignPromoterPairs) {
      try {
        await this.dataSource.query(
          'SELECT calculate_campaign_earnings($1, $2)',
          [pair.promoter_id, pair.campaign_id],
        );
      } catch (error) {
        this.logger.error(
          `Failed to calculate earnings for promoter ${pair.promoter_id} in campaign ${pair.campaign_id}:`,
          error,
        );
      }
    }

    this.logger.log('Completed earnings calculation for all campaigns');
  }

  /**
   * Process payouts for campaigns that meet the minimum threshold
   */
  private async processEligibleCampaignPayouts(): Promise<void> {
    // Get all campaign earnings eligible for payout
    const eligibleEarnings = await this.campaignEarningsRepo.find({
      where: {
        qualifiesForPayout: true,
        payoutExecuted: false,
      },
      relations: [
        'promoter',
        'promoter.stripeConnectAccount',
        'campaign',
        'campaign.advertiser',
      ],
    });

    if (eligibleEarnings.length === 0) {
      this.logger.log('No campaigns eligible for payout at this time');
      return;
    }

    this.logger.log(
      `Processing payouts for ${eligibleEarnings.length} eligible campaigns`,
    );

    const totalPayoutAmount =
      eligibleEarnings.reduce(
        (sum, earnings) => sum + earnings.netEarningsCents,
        0,
      ) / 100; // Convert to dollars

    this.logger.log(`Total payout amount: $${totalPayoutAmount.toFixed(2)}`);

    // Process each campaign payout
    for (const earnings of eligibleEarnings) {
      try {
        await this.processIndividualCampaignPayout(earnings);
      } catch (error) {
        this.logger.error(
          `Failed to process payout for campaign ${earnings.campaignId} and promoter ${earnings.promoterId}:`,
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
    // Convert payout amount to promoter's preferred currency
    const campaignCurrency = earnings.campaign.currency;
    const promoterCurrency = earnings.promoter.usedCurrency;

    let payoutAmountCents = earnings.netEarningsCents;

    // Convert currency if needed
    if (campaignCurrency !== promoterCurrency) {
      const exchangeRate = getCachedFxRate(campaignCurrency, promoterCurrency);
      payoutAmountCents = Math.round(earnings.netEarningsCents * exchangeRate);
    }

    const payoutAmountDollars = payoutAmountCents / 100;

    this.logger.log(
      `Processing campaign payout of ${payoutAmountDollars.toFixed(2)} ${promoterCurrency} for promoter ${earnings.promoterId} in campaign "${earnings.campaign.title}"${
        campaignCurrency !== promoterCurrency
          ? ` (converted from ${earnings.netEarningsDollars.toFixed(2)} ${campaignCurrency})`
          : ''
      }`,
    );

    try {
      // Check if promoter has Stripe account
      if (!earnings.promoter.stripeConnectAccount) {
        throw new Error(
          `Promoter ${earnings.promoterId} does not have a Stripe account configured`,
        );
      }

      // Use the promoter payment service to process the payment
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

      // Mark as paid in database using the PostgreSQL function
      await this.dataSource.query(
        'SELECT process_campaign_payout($1, $2, $3, $4)',
        [
          earnings.id,
          payoutAmountCents, // Store the converted amount
          paymentResult.paymentId, // Use the payment transaction ID
          null, // No direct Stripe transfer ID from payPromoter
        ],
      );

      this.logger.log(
        `Successfully processed campaign payout for promoter ${earnings.promoterId} in campaign ${earnings.campaignId} - Payment ID: ${paymentResult.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process campaign payout for promoter ${earnings.promoterId} in campaign ${earnings.campaignId}:`,
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

    // Get all promoters who have views in this campaign
    const promoterIds: any[] = await this.dataSource.query(
      `
      SELECT DISTINCT promoter_id
      FROM unique_views
      WHERE campaign_id = $1
    `,
      [campaignId],
    );

    for (const { promoter_id } of promoterIds) {
      await this.dataSource.query(
        'SELECT calculate_campaign_earnings($1, $2)',
        [promoter_id, campaignId],
      );
    }

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

    const eligibleEarnings = await this.campaignEarningsRepo.find({
      where: {
        promoterId,
        qualifiesForPayout: true,
        payoutExecuted: false,
      },
      relations: ['promoter', 'promoter.stripeConnectAccount', 'campaign'],
    });

    for (const earnings of eligibleEarnings) {
      await this.processIndividualCampaignPayout(earnings);
    }

    this.logger.log(`Completed payout processing for promoter ${promoterId}`);
  }
}
