import { CampaignStatus } from '../../enums/campaign-status';
import {
  CampaignType,
  MeetingPlan,
  SalesTrackingMethod,
} from 'src/enums/campaign-type';
import { UserType } from '../../enums/user-type';
import { TransactionType } from 'src/database/entities/transaction.entity';
import { TransactionStatus } from 'src/database/entities/transaction.entity';
import { PromoterCampaignStatus } from '../../database/entities/promoter-campaign.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { PromoterCampaign } from '../../database/entities/promoter-campaign.entity';
import { CampaignDeliverableEntity } from '../../database/entities/campaign-deliverable.entity';
import { CampaignDeliverable } from '../../interfaces/promoter-campaigns';
import { transformUserToPromoter } from '../../helpers/user-transformer.helper';
import { AdvertiserCampaignStatus } from 'src/interfaces/advertiser-dashboard';
import {
  AdvertiserBaseCampaignDetails,
  AdvertiserVisibilityCampaignDetails,
  AdvertiserConsultantCampaignDetails,
  AdvertiserSellerCampaignDetails,
  AdvertiserSalesmanCampaignDetails,
  PromoterApplicationInfo,
} from 'src/interfaces/advertiser-campaign';
import { CampaignApplicationEntity } from 'src/database/entities';
/**
 * Constants for advertiser campaign operations
 */
export const ADVERTISER_CAMPAIGN_CONSTANTS = {
  DEFAULT_PAGINATION: {
    PAGE: 1,
    LIMIT: 10,
  },
  SPENDING_TRANSACTION_TYPES: [
    TransactionType.VIEW_EARNING,
    TransactionType.SALESMAN_COMMISSION,
    TransactionType.MONTHLY_PAYOUT,
    TransactionType.DIRECT_PAYMENT,
  ],
  COMMISSION_TRANSACTION_TYPES: [TransactionType.SALESMAN_COMMISSION],
  VALID_TRANSACTION_STATUSES: [
    TransactionStatus.COMPLETED,
    TransactionStatus.PENDING,
  ],
  ACTIVE_PROMOTER_STATUSES: [
    PromoterCampaignStatus.ONGOING,
    PromoterCampaignStatus.COMPLETED,
  ],
  ONGOING_PROMOTER_STATUSES: [
    PromoterCampaignStatus.ONGOING,
    PromoterCampaignStatus.AWAITING_REVIEW,
  ],
} as const;

/**
 * User entity relations for loading campaign data
 */
export const USER_CAMPAIGN_RELATIONS = [
  'campaigns',
  'campaigns.advertiser',
  'campaigns.advertiser.advertiserDetails',
  'campaigns.advertiser.advertiserDetails.advertiserTypeMappings',
  'campaigns.campaignDeliverables',
  'campaigns.campaignDeliverables.promoterWork',
  'campaigns.campaignDeliverables.promoterWork.comments',
  'campaigns.campaignApplications',
  'campaigns.campaignApplications.promoter',
  'campaigns.campaignApplications.promoter.promoterDetails',
  'campaigns.campaignApplications.promoter.promoterDetails.promoterLanguages',
  'campaigns.campaignApplications.promoter.promoterDetails.promoterSkills',
  'campaigns.campaignApplications.promoter.promoterDetails.promoterWorks',
  'campaigns.campaignApplications.promoter.promoterDetails.followerEstimates',
  'campaigns.promoterCampaigns',
  'campaigns.promoterCampaigns.promoter',
  'campaigns.promoterCampaigns.promoter.promoterDetails',
  'campaigns.promoterCampaigns.promoter.promoterDetails.promoterLanguages',
  'campaigns.promoterCampaigns.promoter.promoterDetails.promoterSkills',
  'campaigns.promoterCampaigns.promoter.promoterDetails.promoterWorks',
  'campaigns.promoterCampaigns.promoter.promoterDetails.followerEstimates',
  'campaigns.transactions',
];

/**
 * Simplified relations for basic campaign operations
 */
export const BASIC_CAMPAIGN_RELATIONS = [
  'campaigns',
  'campaigns.promoterCampaigns',
  'campaigns.promoterCampaigns.promoter',
  'campaigns.campaignApplications',
  'campaigns.transactions',
];

/**
 * Campaign filters configuration
 */
export const CAMPAIGN_FILTERS = {
  statuses: Object.values(CampaignStatus),
  types: Object.values(CampaignType),
} as const;

/**
 * Helper functions for campaign transformations
 */
export const CAMPAIGN_TRANSFORMERS = {
  /**
   * Calculate total views from promoter campaigns
   */
  calculateTotalViews: (promoterCampaigns: PromoterCampaign[]): number => {
    return promoterCampaigns.reduce(
      (sum, pc) => sum + (pc.viewsGenerated || 0),
      0,
    );
  },

  /**
   * Calculate total spent from promoter campaigns using their earnings
   */
  calculateTotalSpent: (promoterCampaigns: PromoterCampaign[]): number => {
    return promoterCampaigns.reduce(
      (sum, pc) => sum + Number(pc.earnings || 0),
      0,
    );
  },

  /**
   * Calculate total spent from transactions (more accurate)
   */
  calculateTotalSpentFromTransactions: (campaign: CampaignEntity): number => {
    if (!campaign.transactions) return 0;

    return campaign.transactions
      .filter(
        (tx) =>
          tx.userType === UserType.ADVERTISER &&
          (
            ADVERTISER_CAMPAIGN_CONSTANTS.SPENDING_TRANSACTION_TYPES as readonly TransactionType[]
          ).includes(tx.type),
      )
      .reduce((total, tx) => total + Math.abs(tx.amount), 0);
  },

  /**
   * Calculate conversions from transactions
   */
  calculateConversions: (campaign: CampaignEntity): number => {
    if (!campaign.transactions) return 0;

    return campaign.transactions.filter(
      (tx) =>
        (
          ADVERTISER_CAMPAIGN_CONSTANTS.COMMISSION_TRANSACTION_TYPES as readonly TransactionType[]
        ).includes(tx.type) &&
        (
          ADVERTISER_CAMPAIGN_CONSTANTS.VALID_TRANSACTION_STATUSES as readonly TransactionStatus[]
        ).includes(tx.status),
    ).length;
  },

  /**
   * Map campaign status based on promoter campaigns and applications
   */
  mapCampaignStatus: (
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
  ): AdvertiserCampaignStatus => {
    // Check if campaign is completed
    if (
      campaign.status === CampaignStatus.INACTIVE ||
      promoterCampaigns.some(
        (pc) => pc.status === PromoterCampaignStatus.COMPLETED,
      )
    ) {
      return AdvertiserCampaignStatus.COMPLETED;
    }

    // Check if promoters are actively working
    if (
      promoterCampaigns.some((pc) =>
        (
          ADVERTISER_CAMPAIGN_CONSTANTS.ONGOING_PROMOTER_STATUSES as readonly PromoterCampaignStatus[]
        ).includes(pc.status),
      )
    ) {
      return AdvertiserCampaignStatus.ONGOING;
    }

    // Check if there are applications but no active promoters
    if (
      campaign.campaignApplications &&
      (campaign.campaignApplications as any[]).length > 0 &&
      promoterCampaigns.length === 0
    ) {
      return AdvertiserCampaignStatus.REVIEWING_APPLICATIONS;
    }

    return AdvertiserCampaignStatus.PENDING_PROMOTER;
  },

  /**
   * Transform campaign deliverables entities to DTOs
   */
  transformCampaignDeliverables: (
    deliverableEntities: CampaignDeliverableEntity[] | undefined,
  ): CampaignDeliverable[] => {
    if (!deliverableEntities || deliverableEntities.length === 0) {
      return [];
    }

    return deliverableEntities.map((entity) => ({
      id: entity.id,
      campaignId: entity.campaignId,
      deliverable: entity.deliverable,
      isSubmitted: entity.isSubmitted,
      isFinished: entity.isFinished,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      promoterWork:
        entity.promoterWork?.map((work) => ({
          id: work.id,
          campaignId: entity.campaignId,
          promoterLink: work.promoterLink,
          description: work.description,
          createdAt: work.createdAt,
          updatedAt: work.updatedAt,
          comments:
            work.comments?.map((comment) => ({
              id: comment.id,
              workId: comment.workId,
              commentMessage: comment.commentMessage,
              commentatorId: comment.commentatorId,
              commentatorName: comment.commentatorName,
              createdAt: comment.createdAt,
            })) || [],
        })) || [],
    }));
  },

  /**
   * Extract advertiser types from mappings
   */
  extractAdvertiserTypes: (campaign: CampaignEntity) => {
    return (
      campaign.advertiser?.advertiserDetails?.advertiserTypeMappings?.map(
        (mapping) => mapping.advertiserType,
      ) || []
    );
  },

  /**
   * Transform applicants from campaign applications
   * If campaign is not public and has chosen promoters, return empty array
   */
  transformApplicants: (
    campaign: CampaignEntity,
  ): PromoterApplicationInfo[] => {
    // Check if campaign is not public and has chosen promoters
    if (
      !campaign.isPublic &&
      CAMPAIGN_TRANSFORMERS.hasChosenPromoters(campaign)
    ) {
      return [];
    }

    const applications = campaign.campaignApplications || [];
    return applications.map((app: CampaignApplicationEntity) => ({
      promoter: transformUserToPromoter(app.promoter),

      applicationStatus: app.status,

      applicationMessage: app.applicationMessage,
    }));
  },

  /**
   * Check if campaign has at least one chosen promoter
   */
  hasChosenPromoters: (campaign: CampaignEntity): boolean => {
    const activePromoters = (campaign.promoterCampaigns || []).filter((pc) =>
      (
        ADVERTISER_CAMPAIGN_CONSTANTS.ACTIVE_PROMOTER_STATUSES as readonly PromoterCampaignStatus[]
      ).includes(pc.status),
    );
    return activePromoters.length > 0;
  },

  /**
   * Check if campaign has at least one completed promoter campaign
   */
  hasCompletedPromoters: (campaign: CampaignEntity): boolean => {
    const completedPromoters = (campaign.promoterCampaigns || []).filter(
      (pc) => pc.status === PromoterCampaignStatus.COMPLETED,
    );
    return completedPromoters.length > 0;
  },

  /**
   * Transform chosen promoters from promoter campaigns
   */
  transformChosenPromoters: (campaign: CampaignEntity) => {
    const activePromoters = (campaign.promoterCampaigns || []).filter((pc) =>
      (
        ADVERTISER_CAMPAIGN_CONSTANTS.ACTIVE_PROMOTER_STATUSES as readonly PromoterCampaignStatus[]
      ).includes(pc.status),
    );

    return activePromoters.map((pc) => ({
      promoter: transformUserToPromoter(pc.promoter),
      status: pc.status,
      viewsGenerated: pc.viewsGenerated,
      joinedAt: pc.joinedAt,
      earnings: pc.earnings,
      budgetAllocated: campaign.budgetAllocated,
    }));
  },
} as const;

/**
 * Campaign detail builders for different campaign types
 */
export const CAMPAIGN_DETAIL_BUILDERS = {
  /**
   * Build base campaign details common to all types
   */
  buildBaseCampaignDetails: (
    campaign: CampaignEntity,
  ): AdvertiserBaseCampaignDetails => ({
    budgetHeld: campaign.budgetAllocated || 0,
    spentBudget:
      CAMPAIGN_TRANSFORMERS.calculateTotalSpentFromTransactions(campaign),
    targetAudience: campaign.targetAudience,
    preferredPlatforms: campaign.preferredPlatforms,
    requirements: campaign.requirements,
    createdAt: campaign.createdAt,
    deadline: campaign.deadline
      ? new Date(campaign.deadline).toISOString()
      : '',
    startDate: campaign.startDate
      ? new Date(campaign.startDate).toISOString()
      : '',
    isPublic: campaign.isPublic || false,
    discordInviteLink: campaign.discordInviteLink || '',
    budgetAllocated: campaign.budgetAllocated || 0,
  }),

  /**
   * Build visibility campaign details
   */
  buildVisibilityCampaignDetails: (
    campaign: CampaignEntity,
  ): AdvertiserVisibilityCampaignDetails => ({
    ...CAMPAIGN_DETAIL_BUILDERS.buildBaseCampaignDetails(campaign),
    maxViews: campaign.maxViews || 0,
    currentViews: campaign.currentViews || 0,
    cpv: campaign.cpv || 0,
    minFollowers: campaign.minFollowers,
    trackingLink: campaign.trackingLink || '',
    type: CampaignType.VISIBILITY,
  }),

  /**
   * Build consultant campaign details
   */
  buildConsultantCampaignDetails: (
    campaign: CampaignEntity,
  ): AdvertiserConsultantCampaignDetails => ({
    ...CAMPAIGN_DETAIL_BUILDERS.buildBaseCampaignDetails(campaign),
    meetingPlan: campaign.meetingPlan || MeetingPlan.CUSTOM,
    expectedDeliverables: CAMPAIGN_TRANSFORMERS.transformCampaignDeliverables(
      campaign.expectedDeliverables,
    ),
    expertiseRequired: campaign.expertiseRequired,
    meetingCount: campaign.meetingCount || 0,
    maxBudget: campaign.maxBudget || 0,
    minBudget: campaign.minBudget || 0,
    type: CampaignType.CONSULTANT,
  }),

  /**
   * Build seller campaign details
   */
  buildSellerCampaignDetails: (
    campaign: CampaignEntity,
  ): AdvertiserSellerCampaignDetails => ({
    ...CAMPAIGN_DETAIL_BUILDERS.buildBaseCampaignDetails(campaign),
    sellerRequirements: campaign.sellerRequirements,
    deliverables: CAMPAIGN_TRANSFORMERS.transformCampaignDeliverables(
      campaign.deliverables,
    ),
    maxBudget: campaign.maxBudget || 0,
    minBudget: campaign.minBudget || 0,
    minFollowers: campaign.minFollowers,
    needMeeting: campaign.needMeeting || false,
    meetingPlan: campaign.meetingPlan || MeetingPlan.CUSTOM,
    meetingCount: campaign.meetingCount || 0,
    type: CampaignType.SELLER,
  }),

  /**
   * Build salesman campaign details
   */
  buildSalesmanCampaignDetails: (
    campaign: CampaignEntity,
  ): AdvertiserSalesmanCampaignDetails => ({
    ...CAMPAIGN_DETAIL_BUILDERS.buildBaseCampaignDetails(campaign),
    commissionPerSale: campaign.commissionPerSale || 0,
    trackSalesVia: campaign.trackSalesVia || SalesTrackingMethod.COUPON_CODE,
    codePrefix: campaign.codePrefix,
    minFollowers: campaign.minFollowers,
    currentSales: campaign.currentSales || 0,
    type: CampaignType.SALESMAN,
  }),
} as const;

/**
 * Data validation and filtering utilities
 */
export const CAMPAIGN_VALIDATORS = {
  /**
   * Filter campaigns by status
   */
  filterByStatus: (
    campaigns: CampaignEntity[],
    statuses?: CampaignStatus[],
  ) => {
    if (!Array.isArray(statuses) || statuses.length === 0) return campaigns;
    return campaigns.filter((c) => statuses.includes(c.status));
  },

  /**
   * Filter campaigns by type
   */
  filterByType: (campaigns: CampaignEntity[], types?: CampaignType[]) => {
    if (!Array.isArray(types) || types.length === 0) return campaigns;
    return campaigns.filter((c) => types.includes(c.type));
  },

  /**
   * Filter campaigns by search query
   */
  filterBySearch: (campaigns: CampaignEntity[], searchQuery?: string) => {
    if (!searchQuery) return campaigns;
    const search = searchQuery.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search),
    );
  },

  /**
   * Apply pagination to campaigns
   */
  applyPagination: (
    campaigns: CampaignEntity[],
    page: number,
    limit: number,
  ) => {
    const skip = (page - 1) * limit;
    return campaigns.slice(skip, skip + limit);
  },
} as const;

/**
 * Response builders for consistent API responses
 */
export const RESPONSE_BUILDERS = {
  /**
   * Build pagination metadata
   */
  buildPaginationMeta: (page: number, limit: number, totalCount: number) => {
    const totalPages = Math.ceil(totalCount / limit);
    return {
      page,
      limit,
      totalPages,
      totalCount,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  },

  /**
   * Build empty campaign list response
   */
  buildEmptyCampaignListResponse: (page: number, limit: number) => ({
    campaigns: [],
    pagination: RESPONSE_BUILDERS.buildPaginationMeta(page, limit, 0),
    summary: {
      totalActiveCampaigns: 0,
      totalCompletedCampaigns: 0,
      totalSpentThisMonth: 0,
      totalAllocatedBudget: 0,
      totalRemainingBudget: 0,
    },
  }),
} as const;

/**
 * Date utilities for campaign operations
 */
export const DATE_UTILITIES = {
  /**
   * Get start of current month
   */
  getStartOfCurrentMonth: (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  },

  /**
   * Get end of current month
   */
  getEndOfCurrentMonth: (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  },
} as const;
