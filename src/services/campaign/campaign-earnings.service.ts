import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CampaignEarningsTracking } from 'src/database/entities/financial/campaign-earnings-tracking.entity';
import { UniqueViewEntity } from 'src/database/entities/unique-view.entity';
import { CampaignEntity } from 'src/database/entities';
import {
  CAMPAIGN_EARNINGS_CONSTANTS,
  CAMPAIGN_EARNINGS_MESSAGES,
} from 'src/constants/campaign-earnings.constants';

interface CampaignViewQueryResult {
  promoterId: string;
  campaignId: string;
  viewCount: string;
  cpvCents: string;
}

interface CampaignPromoterViewData {
  promoterId: string;
  campaignId: string;
  viewCount: number;
  cpvCents: number;
  month: number;
  year: number;
}

interface EarningsCalculationResult {
  grossEarningsCents: number;
  platformFeeCents: number;
  netEarningsCents: number;
  qualifiesForPayout: boolean;
}

/**
 * Service responsible for calculating and managing campaign earnings
 * Handles all logic related to promoter earnings from campaign views
 */
@Injectable()
export class CampaignEarningsService {
  private readonly logger = new Logger(CampaignEarningsService.name);

  constructor(
    @InjectRepository(CampaignEarningsTracking)
    private readonly campaignEarningsRepo: Repository<CampaignEarningsTracking>,
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepo: Repository<UniqueViewEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculate earnings for all active visibility campaigns for a specific month
   * @param month - Target month (1-12), defaults to current month
   * @param year - Target year, defaults to current year
   * @returns Promise<void>
   */
  async calculateAllCampaignEarnings(
    month?: number,
    year?: number,
  ): Promise<void> {
    const targetDate = new Date();
    const targetMonth = month || targetDate.getMonth() + 1; // getMonth() is 0-indexed
    const targetYear = year || targetDate.getFullYear();

    this.logger.log(
      `${CAMPAIGN_EARNINGS_MESSAGES.CALCULATION_STARTED} for ${targetMonth}/${targetYear}`,
    );

    const campaignViewData = await this.getActiveCampaignViewData(
      targetMonth,
      targetYear,
    );

    this.logger.log(
      `Found ${campaignViewData.length} campaign-promoter pairs to process for ${targetMonth}/${targetYear}`,
    );

    for (const viewData of campaignViewData) {
      try {
        await this.calculateIndividualCampaignEarnings(viewData);
      } catch (error) {
        this.logger.error(
          `Failed to calculate earnings for promoter ${viewData.promoterId} in campaign ${viewData.campaignId}:`,
          error,
        );
      }
    }

    this.logger.log(CAMPAIGN_EARNINGS_MESSAGES.CALCULATION_COMPLETED);
  }

  /**
   * Calculate earnings for the previous month (useful for monthly cron jobs)
   * @returns Promise<void>
   */
  async calculatePreviousMonthEarnings(): Promise<void> {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = previousMonth.getMonth() + 1; // getMonth() is 0-indexed
    const year = previousMonth.getFullYear();

    this.logger.log(
      `📅 Calculating earnings for previous month: ${month}/${year}`,
    );

    await this.calculateAllCampaignEarnings(month, year);
  }

  /**
   * Check if earnings calculations have already been performed for a specific month
   * @param month - Target month (1-12)
   * @param year - Target year
   * @returns Promise<boolean>
   */
  async hasCalculationsForMonth(month: number, year: number): Promise<boolean> {
    const count = await this.campaignEarningsRepo.count({
      where: {
        earningsMonth: month,
        earningsYear: year,
      },
    });

    return count > 0;
  }

  /**
   * Calculate earnings for a specific campaign-promoter pair for a specific month
   * @param viewData - The view data for calculation
   */
  async calculateIndividualCampaignEarnings(
    viewData: CampaignPromoterViewData,
  ): Promise<void> {
    this.logger.log(
      `📊 Calculating earnings for promoter ${viewData.promoterId.substring(0, 8)}... in campaign ${viewData.campaignId.substring(0, 8)}... for ${viewData.month}/${viewData.year}`,
    );

    // Check if earnings for this month already exist
    const existingRecord = await this.findExistingEarningsRecord(
      viewData.promoterId,
      viewData.campaignId,
      viewData.month,
      viewData.year,
    );

    if (existingRecord) {
      this.logger.warn(
        `Earnings record already exists for promoter ${viewData.promoterId.substring(0, 8)}... in campaign ${viewData.campaignId.substring(0, 8)}... for ${viewData.month}/${viewData.year}. Skipping calculation.`,
      );
      return;
    }

    const earningsCalculation = this.computeEarnings(
      viewData.viewCount,
      viewData.cpvCents,
    );

    // Create new record for this month
    await this.createEarningsRecord(viewData, earningsCalculation);
    this.logger.log(CAMPAIGN_EARNINGS_MESSAGES.RECORD_CREATED);

    this.logger.log(
      `✅ Earnings calculated for ${viewData.month}/${viewData.year}: Views: ${viewData.viewCount}, ` +
        `Gross: ${earningsCalculation.grossEarningsCents}¢, ` +
        `Net: ${earningsCalculation.netEarningsCents}¢, ` +
        `Qualifies: ${earningsCalculation.qualifiesForPayout}`,
    );
  }

  /**
   * Get all campaigns eligible for payout
   * @returns Promise<CampaignEarningsTracking[]>
   */
  async getEligiblePayouts(): Promise<CampaignEarningsTracking[]> {
    return this.campaignEarningsRepo.find({
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
  }

  /**
   * Get all campaign earnings records for debugging
   * @returns Promise<CampaignEarningsTracking[]>
   */
  async getAllEarningsRecords(): Promise<CampaignEarningsTracking[]> {
    return this.campaignEarningsRepo.find({
      select: [
        'id',
        'promoterId',
        'campaignId',
        'earningsMonth',
        'earningsYear',
        'viewsGenerated',
        'grossEarningsCents',
        'platformFeeCents',
        'netEarningsCents',
        'qualifiesForPayout',
        'payoutExecuted',
      ],
    });
  }

  /**
   * Get earnings records for a specific month
   * @param month - Target month (1-12)
   * @param year - Target year
   * @returns Promise<CampaignEarningsTracking[]>
   */
  async getEarningsForMonth(
    month: number,
    year: number,
  ): Promise<CampaignEarningsTracking[]> {
    return this.campaignEarningsRepo.find({
      where: {
        earningsMonth: month,
        earningsYear: year,
      },
      relations: ['promoter', 'campaign'],
    });
  }

  /**
   * Mark a payout as executed
   * @param earningsId - The earnings record ID
   * @param payoutAmountCents - Amount paid out in cents
   * @param transactionId - Payment transaction ID
   */
  async markPayoutExecuted(
    earningsId: string,
    payoutAmountCents: number,
    transactionId: string,
  ): Promise<void> {
    await this.campaignEarningsRepo.update(earningsId, {
      payoutExecuted: true,
      payoutAmountCents,
      payoutDate: new Date(),
      payoutTransactionId: transactionId,
    });

    this.logger.log(
      `Marked payout as executed for earnings record ${earningsId}`,
    );
  }

  // Private helper methods

  /**
   * Get campaign view data for all active visibility campaigns for a specific month
   * @param month - Target month (1-12)
   * @param year - Target year
   * @returns Promise<CampaignPromoterViewData[]>
   */
  private async getActiveCampaignViewData(
    month: number,
    year: number,
  ): Promise<CampaignPromoterViewData[]> {
    const result: CampaignViewQueryResult[] = await this.dataSource.query(
      `
      SELECT 
        uv.promoter_id as "promoterId",
        uv.campaign_id as "campaignId",
        COUNT(uv.id) as "viewCount",
        c.cpv as "cpvCents"
      FROM unique_views uv
      INNER JOIN campaigns c ON c.id = uv.campaign_id
      WHERE c.type = 'VISIBILITY'
        AND c.cpv IS NOT NULL
        AND EXTRACT(MONTH FROM uv.created_at) = $1
        AND EXTRACT(YEAR FROM uv.created_at) = $2
      GROUP BY uv.promoter_id, uv.campaign_id, c.cpv
    `,
      [month, year],
    );

    return result.map((row) => ({
      promoterId: row.promoterId,
      campaignId: row.campaignId,
      viewCount: parseInt(row.viewCount, 10),
      cpvCents: Math.round(
        parseFloat(row.cpvCents) * CAMPAIGN_EARNINGS_CONSTANTS.CENTS_TO_DOLLARS,
      ),
      month,
      year,
    }));
  }

  /**
   * Find existing earnings record for a promoter-campaign pair for a specific month
   * @param promoterId - Promoter ID
   * @param campaignId - Campaign ID
   * @param month - Earnings month (1-12)
   * @param year - Earnings year
   * @returns Promise<CampaignEarningsTracking | null>
   */
  private async findExistingEarningsRecord(
    promoterId: string,
    campaignId: string,
    month: number,
    year: number,
  ): Promise<CampaignEarningsTracking | null> {
    return this.campaignEarningsRepo.findOne({
      where: {
        promoterId,
        campaignId,
        earningsMonth: month,
        earningsYear: year,
      },
    });
  }

  /**
   * Compute earnings based on view count and CPV
   * @param viewCount - Number of views
   * @param cpvCents - Cost per view in cents
   * @returns EarningsCalculationResult
   */
  private computeEarnings(
    viewCount: number,
    cpvCents: number,
  ): EarningsCalculationResult {
    // Calculate gross earnings: (views * cpv) / 100 (since CPV is per 100 views)
    const grossEarningsCents = Math.round(
      (viewCount * cpvCents) /
        CAMPAIGN_EARNINGS_CONSTANTS.VIEWS_PER_CPV_CALCULATION,
    );

    // Calculate platform fee (20% of gross)
    const platformFeeCents = Math.round(
      grossEarningsCents * CAMPAIGN_EARNINGS_CONSTANTS.PLATFORM_FEE_PERCENTAGE,
    );

    // Calculate net earnings (gross - platform fee)
    const netEarningsCents = grossEarningsCents - platformFeeCents;

    // Check if qualifies for payout ($5 minimum)
    const qualifiesForPayout =
      netEarningsCents >=
      CAMPAIGN_EARNINGS_CONSTANTS.MINIMUM_PAYOUT_THRESHOLD_CENTS;

    return {
      grossEarningsCents,
      platformFeeCents,
      netEarningsCents,
      qualifiesForPayout,
    };
  }

  /**
   * Create a new earnings record for a specific month
   * @param viewData - Campaign view data
   * @param calculation - Earnings calculation result
   */
  private async createEarningsRecord(
    viewData: CampaignPromoterViewData,
    calculation: EarningsCalculationResult,
  ): Promise<void> {
    try {
      const earningsRecord = this.campaignEarningsRepo.create({
        promoterId: viewData.promoterId,
        campaignId: viewData.campaignId,
        earningsMonth: viewData.month,
        earningsYear: viewData.year,
        viewsGenerated: viewData.viewCount,
        cpvCents: viewData.cpvCents,
        grossEarningsCents: calculation.grossEarningsCents,
        platformFeeCents: calculation.platformFeeCents,
        netEarningsCents: calculation.netEarningsCents,
        qualifiesForPayout: calculation.qualifiesForPayout,
        payoutExecuted: false,
      });

      await this.campaignEarningsRepo.save(earningsRecord);
    } catch (error) {
      // Handle duplicate key error gracefully (race condition protection)
      const errorMessage = String(error);
      if (
        errorMessage.includes(
          'duplicate key value violates unique constraint',
        ) &&
        errorMessage.includes('promoter_campaign_month_year_key')
      ) {
        this.logger.warn(
          `Duplicate earnings record detected for promoter ${viewData.promoterId.substring(0, 8)}... in campaign ${viewData.campaignId.substring(0, 8)}... for ${viewData.month}/${viewData.year}. This is likely due to concurrent processing. Skipping.`,
        );
        return;
      }
      // Re-throw any other errors
      throw error;
    }
  }
}
