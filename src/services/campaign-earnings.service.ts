import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CampaignEarningsTracking } from '../database/entities/financial/campaign-earnings-tracking.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { 
  CAMPAIGN_EARNINGS_CONSTANTS, 
  CAMPAIGN_EARNINGS_MESSAGES 
} from '../constants/campaign-earnings.constants';

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
   * Calculate earnings for all active visibility campaigns
   * @returns Promise<void>
   */
  async calculateAllCampaignEarnings(): Promise<void> {
    this.logger.log(CAMPAIGN_EARNINGS_MESSAGES.CALCULATION_STARTED);

    const campaignViewData = await this.getActiveCampaignViewData();
    
    this.logger.log(`Found ${campaignViewData.length} campaign-promoter pairs to process`);

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
   * Calculate earnings for a specific campaign-promoter pair
   * @param viewData - The view data for calculation
   */
  async calculateIndividualCampaignEarnings(
    viewData: CampaignPromoterViewData,
  ): Promise<void> {
    this.logger.log(
      `📊 Calculating earnings for promoter ${viewData.promoterId.substring(0, 8)}... in campaign ${viewData.campaignId.substring(0, 8)}...`,
    );

    // Get existing earnings record or create new one
    const earningsRecord = await this.findExistingEarningsRecord(
      viewData.promoterId,
      viewData.campaignId,
    );

    const earningsCalculation = this.computeEarnings(
      viewData.viewCount,
      viewData.cpvCents,
    );

    if (earningsRecord) {
      // Update existing record
      await this.updateEarningsRecord(earningsRecord, viewData, earningsCalculation);
      this.logger.log(CAMPAIGN_EARNINGS_MESSAGES.RECORD_UPDATED);
    } else {
      // Create new record
      await this.createEarningsRecord(viewData, earningsCalculation);
      this.logger.log(CAMPAIGN_EARNINGS_MESSAGES.RECORD_CREATED);
    }

    this.logger.log(
      `✅ Earnings calculated: Views: ${viewData.viewCount}, ` +
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

    this.logger.log(`Marked payout as executed for earnings record ${earningsId}`);
  }

  // Private helper methods

  /**
   * Get campaign view data for all active visibility campaigns
   * @returns Promise<CampaignPromoterViewData[]>
   */
  private async getActiveCampaignViewData(): Promise<CampaignPromoterViewData[]> {
    const result: CampaignViewQueryResult[] = await this.dataSource.query(`
      SELECT 
        uv.promoter_id as "promoterId",
        uv.campaign_id as "campaignId",
        COUNT(uv.id) as "viewCount",
        c.cpv as "cpvCents"
      FROM unique_views uv
      INNER JOIN campaigns c ON c.id = uv.campaign_id
      WHERE c.type = 'VISIBILITY'
        AND c.status = 'ACTIVE'
        AND c.cpv IS NOT NULL
      GROUP BY uv.promoter_id, uv.campaign_id, c.cpv
    `);

    return result.map((row) => ({
      promoterId: row.promoterId,
      campaignId: row.campaignId,
      viewCount: parseInt(row.viewCount, 10),
      cpvCents: Math.round(parseFloat(row.cpvCents) * CAMPAIGN_EARNINGS_CONSTANTS.CENTS_TO_DOLLARS),
    }));
  }

  /**
   * Find existing earnings record for a promoter-campaign pair
   * @param promoterId - Promoter ID
   * @param campaignId - Campaign ID
   * @returns Promise<CampaignEarningsTracking | null>
   */
  private async findExistingEarningsRecord(
    promoterId: string,
    campaignId: string,
  ): Promise<CampaignEarningsTracking | null> {
    return this.campaignEarningsRepo.findOne({
      where: { promoterId, campaignId },
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
      (viewCount * cpvCents) / CAMPAIGN_EARNINGS_CONSTANTS.VIEWS_PER_CPV_CALCULATION,
    );

    // Calculate platform fee (20% of gross)
    const platformFeeCents = Math.round(
      grossEarningsCents * CAMPAIGN_EARNINGS_CONSTANTS.PLATFORM_FEE_PERCENTAGE,
    );

    // Calculate net earnings (gross - platform fee)
    const netEarningsCents = grossEarningsCents - platformFeeCents;

    // Check if qualifies for payout ($5 minimum)
    const qualifiesForPayout = netEarningsCents >= CAMPAIGN_EARNINGS_CONSTANTS.MINIMUM_PAYOUT_THRESHOLD_CENTS;

    return {
      grossEarningsCents,
      platformFeeCents,
      netEarningsCents,
      qualifiesForPayout,
    };
  }

  /**
   * Create a new earnings record
   * @param viewData - Campaign view data
   * @param calculation - Earnings calculation result
   */
  private async createEarningsRecord(
    viewData: CampaignPromoterViewData,
    calculation: EarningsCalculationResult,
  ): Promise<void> {
    const earningsRecord = this.campaignEarningsRepo.create({
      promoterId: viewData.promoterId,
      campaignId: viewData.campaignId,
      viewsGenerated: viewData.viewCount,
      cpvCents: viewData.cpvCents,
      grossEarningsCents: calculation.grossEarningsCents,
      platformFeeCents: calculation.platformFeeCents,
      netEarningsCents: calculation.netEarningsCents,
      qualifiesForPayout: calculation.qualifiesForPayout,
      payoutExecuted: false,
    });

    await this.campaignEarningsRepo.save(earningsRecord);
  }

  /**
   * Update an existing earnings record
   * @param earningsRecord - Existing earnings record
   * @param viewData - Updated view data
   * @param calculation - New earnings calculation
   */
  private async updateEarningsRecord(
    earningsRecord: CampaignEarningsTracking,
    viewData: CampaignPromoterViewData,
    calculation: EarningsCalculationResult,
  ): Promise<void> {
    earningsRecord.viewsGenerated = viewData.viewCount;
    earningsRecord.cpvCents = viewData.cpvCents;
    earningsRecord.grossEarningsCents = calculation.grossEarningsCents;
    earningsRecord.platformFeeCents = calculation.platformFeeCents;
    earningsRecord.netEarningsCents = calculation.netEarningsCents;
    earningsRecord.qualifiesForPayout = calculation.qualifiesForPayout;

    await this.campaignEarningsRepo.save(earningsRecord);
  }
}
