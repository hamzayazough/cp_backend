import { CampaignEntity } from '../database/entities/campaign.entity';
import {
  Campaign,
  VisibilityCampaign,
  ConsultantCampaign,
  SellerCampaign,
  SalesmanCampaign,
} from '../interfaces/campaign';
import { CampaignStatus } from '../enums/campaign-status';
import { CampaignType } from '../enums/campaign-type';

export class CampaignEntityBuilder {
  /**
   * Creates a campaign entity from campaign data and user ID
   */
  static buildCampaignEntity(
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    > & {
      mediaUrl?: string;
    },
    userId: string,
  ): CampaignEntity {
    const campaign = new CampaignEntity();

    // Set common fields
    this.setCommonFields(campaign, campaignData, userId);

    // Set type-specific fields
    this.setTypeSpecificFields(campaign, campaignData);

    return campaign;
  }

  /**
   * Sets common fields that are shared across all campaign types
   */
  private static setCommonFields(
    campaign: CampaignEntity,
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    > & {
      mediaUrl?: string;
    },
    userId: string,
  ): void {
    campaign.advertiserId = userId;
    campaign.title = campaignData.title;
    campaign.description = campaignData.description;
    campaign.type = campaignData.type;
    campaign.isPublic = campaignData.isPublic;
    campaign.mediaUrl = campaignData.mediaUrl;
    campaign.requirements = campaignData.requirements;
    campaign.targetAudience = campaignData.targetAudience;
    campaign.preferredPlatforms = campaignData.preferredPlatforms;
    campaign.deadline = new Date(campaignData.deadline);
    campaign.startDate = new Date(campaignData.startDate);
    campaign.advertiserTypes = campaignData.advertiserTypes;
    campaign.status = CampaignStatus.PAUSED; // Default to paused until activated
  }

  /**
   * Sets type-specific fields based on campaign type
   */
  private static setTypeSpecificFields(
    campaign: CampaignEntity,
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    > & {
      mediaUrl?: string;
    },
  ): void {
    switch (campaignData.type) {
      case CampaignType.VISIBILITY:
        this.setVisibilityFields(campaign, campaignData as VisibilityCampaign);
        break;

      case CampaignType.CONSULTANT:
        this.setConsultantFields(campaign, campaignData as ConsultantCampaign);
        break;

      case CampaignType.SELLER:
        this.setSellerFields(campaign, campaignData as SellerCampaign);
        break;

      case CampaignType.SALESMAN:
        this.setSalesmanFields(campaign, campaignData as SalesmanCampaign);
        break;
    }
  }

  /**
   * Sets visibility campaign specific fields
   */
  private static setVisibilityFields(
    campaign: CampaignEntity,
    data: VisibilityCampaign,
  ): void {
    campaign.cpv = data.cpv;
    campaign.maxViews = data.maxViews;
    campaign.trackingLink = data.trackingLink;
    campaign.minFollowers = data.minFollowers;
    campaign.currentViews = 0;
  }

  /**
   * Sets consultant campaign specific fields
   */
  private static setConsultantFields(
    campaign: CampaignEntity,
    data: ConsultantCampaign,
  ): void {
    campaign.meetingPlan = data.meetingPlan;
    campaign.expertiseRequired = data.expertiseRequired;
    campaign.expectedDeliverables = data.expectedDeliverables;
    campaign.meetingCount = data.meetingCount;
    campaign.maxBudget = data.maxBudget;
    campaign.minBudget = data.minBudget;
  }

  /**
   * Sets seller campaign specific fields
   */
  private static setSellerFields(
    campaign: CampaignEntity,
    data: SellerCampaign,
  ): void {
    campaign.sellerRequirements = data.sellerRequirements;
    campaign.deliverables = data.deliverables;
    campaign.maxBudget = data.maxBudget;
    campaign.minBudget = data.minBudget;
    campaign.minFollowers = data.minFollowers;
    campaign.meetingPlan = data.meetingPlan;
  }

  /**
   * Sets salesman campaign specific fields
   */
  private static setSalesmanFields(
    campaign: CampaignEntity,
    data: SalesmanCampaign,
  ): void {
    campaign.commissionPerSale = data.commissionPerSale;
    campaign.trackSalesVia = data.trackSalesVia;
    campaign.codePrefix = data.codePrefix;
    campaign.minFollowers = data.minFollowers;
  }
}
