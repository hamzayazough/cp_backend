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
import { SalesTrackingMethod } from 'src/enums/sales-tracking-method';

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
    campaign.mediaUrl = campaignData.mediaUrl;
    campaign.requirements = campaignData.requirements;
    campaign.targetAudience = campaignData.targetAudience;
    campaign.preferredPlatforms = campaignData.preferredPlatforms;
    campaign.deadline = new Date(campaignData.deadline);
    campaign.startDate = new Date(campaignData.startDate);
    campaign.advertiserTypes = campaignData.advertiserTypes;

    if (campaignData.type === CampaignType.VISIBILITY) {
      campaign.isPublic = campaignData.isPublic;
    } else {
      campaign.isPublic = false; // Consultant, Seller, Salesman campaigns are not suppose to be public
    }

    if (
      campaignData.startDate &&
      this.isSameDay(new Date(campaignData.startDate), new Date())
    ) {
      campaign.status = CampaignStatus.ACTIVE;
    } else {
      campaign.status = CampaignStatus.PAUSED;
    }
    campaign.createdAt = new Date();
    campaign.updatedAt = new Date();

    //TODO: generate discord invite link for this campaign
  }

  /**
   * Checks if two dates are on the same day
   */
  private static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
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
    campaign.trackingLink = this.generateTrackingLink(data.trackingLink);
    campaign.minFollowers = data.minFollowers;
    campaign.currentViews = 0;
    campaign.budgetAllocated = data.cpv * (data.maxViews || 1000); // TODO: change that
  }

  // TODO: generate tracking link once we have the site URL
  private static generateTrackingLink(siteUrl: string): string {
    return siteUrl;
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
    campaign.budgetAllocated = campaign.maxBudget;
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
    campaign.maxBudget = data.maxBudget || 0;
    campaign.minBudget = data.minBudget || 0;
    campaign.minFollowers = data.minFollowers;
    campaign.meetingPlan = data.meetingPlan;
    campaign.needMeeting = data.needMeeting || false;
    campaign.meetingCount = data.meetingCount || 0;
    campaign.budgetAllocated = campaign.maxBudget;
  }

  /**
   * Sets salesman campaign specific fields
   */
  private static setSalesmanFields(
    campaign: CampaignEntity,
    data: SalesmanCampaign,
  ): void {
    campaign.commissionPerSale = data.commissionPerSale;
    campaign.trackSalesVia =
      data.trackSalesVia || SalesTrackingMethod.COUPON_CODE;
    campaign.codePrefix = data.codePrefix;
    campaign.minFollowers = data.minFollowers;
    campaign.budgetAllocated = 0;
  }
}
