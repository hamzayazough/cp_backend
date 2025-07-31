import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from 'src/database/entities/campaign.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from 'src/database/entities/campaign-applications.entity';
import { UserType } from 'src/enums/user-type';

/**
 * Constants and utility functions for AdvertiserService
 * This file centralizes all the constants, relation arrays, and helper functions
 * to eliminate code duplication and improve maintainability
 */

// Relation arrays for different entity loading scenarios
export const ADVERTISER_RELATIONS = {
  // For basic advertiser lookup with campaigns and applications
  BASIC_WITH_CAMPAIGNS: [
    'campaigns',
    'campaigns.campaignApplications',
    'campaigns.campaignApplications.promoter',
  ],

  // For dashboard data loading
  DASHBOARD: ['campaigns', 'transactions', 'wallet'],

  // For campaign management operations
  CAMPAIGN_MANAGEMENT: [
    'campaigns',
    'campaigns.campaignApplications',
    'campaigns.campaignApplications.promoter',
  ],

  // For single campaign with all applications
  SINGLE_CAMPAIGN: [
    'campaigns',
    'campaigns.campaignApplications',
    'campaigns.campaignApplications.promoter',
  ],
};

// Error messages
export const ADVERTISER_SERVICE_MESSAGES = {
  ADVERTISER_NOT_FOUND: 'Advertiser not found',
  CAMPAIGN_NOT_FOUND: 'Campaign not found',
  CAMPAIGN_NOT_OWNED: 'You do not own this campaign',
  APPLICATION_NOT_FOUND: 'Application not found',
  CAMPAIGN_HAS_PROMOTERS: 'Cannot delete campaign with associated promoters',
  CAMPAIGN_DELETION_SUCCESS: 'Campaign deleted successfully',
  S3_DELETION_ERROR: 'Error deleting campaign media from S3:',
} as const;

// Validators
export const ADVERTISER_SERVICE_VALIDATORS = {
  validateAdvertiserExists: (advertiser: UserEntity | null): UserEntity => {
    if (!advertiser) {
      throw new Error(ADVERTISER_SERVICE_MESSAGES.ADVERTISER_NOT_FOUND);
    }
    return advertiser;
  },

  validateCampaignExists: (campaign: CampaignEntity | null): CampaignEntity => {
    if (!campaign) {
      throw new Error(ADVERTISER_SERVICE_MESSAGES.CAMPAIGN_NOT_FOUND);
    }
    return campaign;
  },

  validateApplicationExists: (
    application: CampaignApplicationEntity | null,
  ): CampaignApplicationEntity => {
    if (!application) {
      throw new Error(ADVERTISER_SERVICE_MESSAGES.APPLICATION_NOT_FOUND);
    }
    return application;
  },

  validateCampaignCanBeDeleted: (promoterCount: number): void => {
    if (promoterCount > 0) {
      throw new Error(ADVERTISER_SERVICE_MESSAGES.CAMPAIGN_HAS_PROMOTERS);
    }
  },
};

// Utility functions for finding data within loaded entities
export const ADVERTISER_SERVICE_UTILS = {
  /**
   * Find a campaign by ID within the advertiser's campaigns
   */
  findCampaignById: (
    advertiser: UserEntity,
    campaignId: string,
  ): CampaignEntity | null => {
    const campaigns = advertiser.campaigns as CampaignEntity[] | undefined;
    if (!campaigns || campaigns.length === 0) return null;
    return campaigns.find((campaign) => campaign.id === campaignId) || null;
  },

  /**
   * Find an application within a campaign by application ID or promoter ID
   */
  findApplicationInCampaign: (
    campaign: CampaignEntity,
    applicationId: string,
  ): CampaignApplicationEntity | null => {
    if (!campaign.campaignApplications) return null;

    // Try by application ID first
    let application = campaign.campaignApplications.find(
      (app) => app.id === applicationId,
    );

    // If not found by application ID, try to find by promoter ID
    if (!application) {
      application = campaign.campaignApplications.find(
        (app) => app.promoterId === applicationId,
      );
    }

    return application || null;
  },

  /**
   * Count promoter campaigns for a campaign (using accepted applications)
   */
  countPromoterCampaignsFromApplications: (
    campaign: CampaignEntity,
  ): number => {
    if (!campaign.campaignApplications) return 0;
    return campaign.campaignApplications.filter(
      (app) => app.status === ApplicationStatus.ACCEPTED,
    ).length;
  },

  /**
   * Check if advertiser owns the campaign
   */
  doesAdvertiserOwnCampaign: (
    advertiser: UserEntity,
    campaign: CampaignEntity,
  ): boolean => {
    return campaign.advertiserId === advertiser.id;
  },
};

// Entity transformation helpers
export const ADVERTISER_SERVICE_TRANSFORMERS = {
  /**
   * Create a basic advertiser lookup object
   */
  createAdvertiserLookup: (firebaseUid: string) => ({
    where: { firebaseUid, role: UserType.ADVERTISER },
  }),

  /**
   * Create advertiser lookup with relations
   */
  createAdvertiserLookupWithRelations: (
    firebaseUid: string,
    relations: string[],
  ) => ({
    where: { firebaseUid, role: UserType.ADVERTISER },
    relations,
  }),
};

// Response builders
export const ADVERTISER_SERVICE_BUILDERS = {
  /**
   * Build campaign deletion response
   */
  buildCampaignDeletionResponse: (success: boolean, message: string) => ({
    success,
    message,
  }),
};
