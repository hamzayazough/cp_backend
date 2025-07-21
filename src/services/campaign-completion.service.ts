import { Injectable, Logger } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { CampaignStatus } from '../enums/campaign-status';
import { CampaignType } from '../enums/campaign-type';
import { PromoterCampaignStatus } from '../interfaces/promoter-campaign';

@Injectable()
export class CampaignCompletionService {
  private readonly logger = new Logger(CampaignCompletionService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepo: Repository<PromoterCampaign>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PromoterDetailsEntity)
    private readonly promoterDetailsRepo: Repository<PromoterDetailsEntity>,
  ) {}

  /**
   * Checks if a campaign has reached its maxViews limit and updates statuses accordingly
   * @param campaignId - The ID of the campaign to check
   * @returns Promise<boolean> - true if campaign was completed, false otherwise
   */
  async checkAndCompleteCampaignIfNeeded(campaignId: string): Promise<boolean> {
    this.logger.log(
      `🔍 Checking campaign completion status for: ${campaignId}`,
    );

    // Fetch campaign with current views and max views
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      select: ['id', 'maxViews', 'currentViews', 'status'],
    });

    if (!campaign) {
      this.logger.warn(`❌ Campaign not found: ${campaignId}`);
      return false;
    }

    if (!campaign.maxViews) {
      this.logger.debug(`⚠️ Campaign has no maxViews limit: ${campaignId}`);
      return false;
    }

    const currentViews = campaign.currentViews || 0;
    this.logger.log(
      `📊 Campaign ${campaignId} - Current views: ${currentViews}, Max views: ${campaign.maxViews}`,
    );

    // Check if max views reached
    if (currentViews >= campaign.maxViews) {
      this.logger.log(
        `🎯 Campaign ${campaignId} has reached maxViews limit. Completing campaign...`,
      );

      await this.completeCampaign(campaignId);
      return true;
    }

    this.logger.debug(
      `✅ Campaign ${campaignId} has not reached maxViews limit yet`,
    );
    return false;
  }

  /**
   * Completes a campaign by updating its status to ENDED and all associated promoter campaigns to COMPLETED
   * @param campaignId - The ID of the campaign to complete
   */
  private async completeCampaign(campaignId: string): Promise<void> {
    this.logger.log(
      `🏁 Starting campaign completion process for: ${campaignId}`,
    );

    try {
      // Fetch campaign details including type for user counter updates
      const campaign = await this.campaignRepo.findOne({
        where: { id: campaignId },
        select: ['id', 'type'],
      });

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Update campaign status to ENDED
      await this.campaignRepo.update(
        { id: campaignId },
        { status: CampaignStatus.ENDED },
      );
      this.logger.log(`✅ Campaign status updated to ENDED: ${campaignId}`);

      // Get all promoters who had ONGOING campaigns for this campaign
      const ongoingPromoterCampaigns = await this.promoterCampaignRepo.find({
        where: {
          campaignId,
          status: PromoterCampaignStatus.ONGOING,
        },
        select: ['id', 'promoterId'],
      });

      // Update all associated promoter campaigns to COMPLETED
      const updateResult = await this.promoterCampaignRepo.update(
        {
          campaignId,
          status: PromoterCampaignStatus.ONGOING, // Only update ongoing campaigns
        },
        { status: PromoterCampaignStatus.COMPLETED },
      );

      this.logger.log(
        `✅ Updated ${updateResult.affected} promoter campaigns to COMPLETED for campaign: ${campaignId}`,
      );

      // Update user campaign counters for completed promoter campaigns
      if (ongoingPromoterCampaigns.length > 0) {
        await this.updateUserCampaignCounters(
          campaign.type,
          ongoingPromoterCampaigns.map((pc) => pc.promoterId),
        );
        this.logger.log(
          `✅ Updated campaign counters for ${ongoingPromoterCampaigns.length} promoters`,
        );
      }

      this.logger.log(
        `🎉 Campaign completion process finished successfully for: ${campaignId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error completing campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Manually complete a campaign (for administrative purposes)
   * @param campaignId - The ID of the campaign to complete
   */
  async manuallyCompleteCampaign(campaignId: string): Promise<void> {
    this.logger.log(
      `🔧 Manual campaign completion requested for: ${campaignId}`,
    );

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      select: ['id', 'status'],
    });

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    if (campaign.status === CampaignStatus.ENDED) {
      this.logger.warn(`⚠️ Campaign ${campaignId} is already ended`);
      return;
    }

    await this.completeCampaign(campaignId);
  }

  /**
   * Updates promoter campaign counters based on campaign type
   * @param campaignType - The type of campaign that was completed
   * @param promoterIds - Array of promoter IDs whose counters should be updated
   */
  private async updateUserCampaignCounters(
    campaignType: CampaignType,
    promoterIds: string[],
  ): Promise<void> {
    this.logger.log(
      `📊 Updating campaign counters for ${promoterIds.length} promoters, campaign type: ${campaignType}`,
    );

    // Increment general campaign counter in promoter details
    await this.promoterDetailsRepo.increment(
      { userId: In(promoterIds) },
      'numberOfCampaignDone',
      1,
    );

    // Increment specific campaign type counter in user entity
    let specificCounterField: string;
    switch (campaignType) {
      case CampaignType.VISIBILITY:
        specificCounterField = 'numberOfVisibilityCampaignDone';
        break;
      case CampaignType.SELLER:
        specificCounterField = 'numberOfSellerCampaignDone';
        break;
      case CampaignType.SALESMAN:
        specificCounterField = 'numberOfSalesmanCampaignDone';
        break;
      case CampaignType.CONSULTANT:
        specificCounterField = 'numberOfConsultantCampaignDone';
        break;
      default:
        this.logger.warn(`⚠️ Unknown campaign type: ${campaignType as string}`);
        return;
    }

    await this.userRepo.increment(
      { id: In(promoterIds) },
      specificCounterField,
      1,
    );

    this.logger.log(
      `✅ Updated numberOfCampaignDone in promoter details and ${specificCounterField} in user entity for ${promoterIds.length} promoters`,
    );
  }
}
