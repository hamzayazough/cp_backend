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
import { UserEntity } from 'src/database/entities';

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
    user: UserEntity,
  ): CampaignEntity {
    const campaign = new CampaignEntity();

    // Set common fields
    this.setCommonFields(campaign, campaignData, user);

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
    user: UserEntity,
  ): void {
    campaign.advertiserId = user.id;
    campaign.title = campaignData.title;
    campaign.description = campaignData.description;
    campaign.type = campaignData.type;
    // Note: mediaUrl is now handled via campaign_media relationship
    // The mediaUrl from campaignData will be processed separately in the service layer
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
      campaign.status = CampaignStatus.INACTIVE;
    }
    campaign.createdAt = new Date();
    campaign.updatedAt = new Date();
    campaign.currency = user.usedCurrency || 'USD';

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
    campaign.trackingLink = data.trackingLink;
    campaign.minFollowers = data.minFollowers;
    campaign.currentViews = 0;
    campaign.budgetAllocated = (data.cpv * (data.maxViews || 10000)) / 100;
    campaign.canHaveMultiplePromoters = data.isPublic;
  }

  /**
   * Generates a visit tracking link with promoter ID that promoters will share
   * This links to our tracking endpoint which will redirect to the campaign's trackingLink
   * Flow: User clicks this link → Our tracking endpoint → Redirect to campaign.trackingLink
   */
  static generateVisitTrackingLink(
    campaignId: string,
    promoterId: string,
  ): string {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    // Remove trailing slash if present
    const baseUrl = serverUrl.replace(/\/$/, '');
    return `${baseUrl}/api/visit/${campaignId}/${promoterId}`;
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
    // Note: expectedDeliverables will be created as separate entities in the service
    // Store the deliverable enum values temporarily - they'll be converted to entity IDs later
    campaign.expectedDeliverableIds = []; // Will be populated after deliverable entities are created
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
    // Note: deliverables will be created as separate entities in the service
    // Store the deliverable enum values temporarily - they'll be converted to entity IDs later
    campaign.deliverableIds = []; // Will be populated after deliverable entities are created
    campaign.maxBudget = data.maxBudget || 0;
    campaign.minBudget = data.minBudget || 0;
    campaign.minFollowers = data.minFollowers;
    campaign.meetingPlan = data.meetingPlan;
    campaign.needMeeting = Boolean(data.needMeeting);
    campaign.meetingCount = Number(data.meetingCount || 0);
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
