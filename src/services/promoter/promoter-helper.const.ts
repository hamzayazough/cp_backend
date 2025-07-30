import { PromoterDashboardRequest } from '../../interfaces/promoter-dashboard';
import { UserType } from '../../enums/user-type';
import { CampaignStatus } from '../../enums/campaign-type';
import {
  PromoterCampaignStatus,
  PromoterCampaign,
} from '../../database/entities/promoter-campaign.entity';
import {
  ApplicationStatus,
  CampaignApplicationEntity,
} from '../../database/entities/campaign-applications.entity';
import { CampaignWorkEntity } from '../../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../../database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from '../../database/entities/campaign-deliverable.entity';

// Configuration map for dashboard data fetching
export interface DashboardDataConfig {
  property: keyof PromoterDashboardRequest;
  dataKey: string;
  method: string;
  limitProperty?: keyof PromoterDashboardRequest;
  defaultLimit?: number;
}

// Helper function to get limit value with proper typing
export const getLimitValue = (
  request: PromoterDashboardRequest,
  limitProperty?: keyof PromoterDashboardRequest,
  defaultLimit?: number,
): number => {
  if (!limitProperty || defaultLimit === undefined) {
    return 0;
  }
  return (request[limitProperty] as number) || defaultLimit;
};

// Configuration map that defines what data to fetch based on request properties
export const DASHBOARD_DATA_CONFIG: DashboardDataConfig[] = [
  {
    property: 'includeStats',
    dataKey: 'stats',
    method: 'getPromoterStats',
  },
  {
    property: 'includeCampaigns',
    dataKey: 'activeCampaigns',
    method: 'getActiveCampaigns',
    limitProperty: 'activeCampaignLimit',
    defaultLimit: 10,
  },
  {
    property: 'includeSuggestions',
    dataKey: 'suggestedCampaigns',
    method: 'getSuggestedCampaigns',
    limitProperty: 'suggestedCampaignLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeTransactions',
    dataKey: 'recentTransactions',
    method: 'getRecentTransactions',
    limitProperty: 'transactionLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeMessages',
    dataKey: 'recentMessages',
    method: 'getRecentMessages',
    limitProperty: 'messageLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeWallet',
    dataKey: 'wallet',
    method: 'getWalletInfo',
  },
];

/**
 * Constants for promoter campaign interactions
 */
export const PROMOTER_INTERACTION_CONSTANTS = {
  USER_ROLES: {
    PROMOTER: 'PROMOTER' as const,
    ADVERTISER: 'ADVERTISER' as const,
  },
  CAMPAIGN_STATUS: {
    ACTIVE: CampaignStatus.ACTIVE,
  },
  PROMOTER_CAMPAIGN_STATUS: {
    ONGOING: PromoterCampaignStatus.ONGOING,
    AWAITING_REVIEW: PromoterCampaignStatus.AWAITING_REVIEW,
    COMPLETED: PromoterCampaignStatus.COMPLETED,
    REFUSED: PromoterCampaignStatus.REFUSED,
  },
  APPLICATION_STATUS: {
    PENDING: ApplicationStatus.PENDING,
  },
  SORT_ORDERS: {
    ASC: 'ASC' as const,
    DESC: 'DESC' as const,
  },
} as const;

/**
 * Error messages for campaign interactions
 */
export const INTERACTION_ERROR_MESSAGES = {
  PROMOTER_NOT_FOUND: 'Promoter not found',
  ADVERTISER_NOT_FOUND: 'Advertiser not found',
  CAMPAIGN_NOT_FOUND: 'Campaign not found or not active',
  CAMPAIGN_ACCESS_DENIED: 'You do not have access to this campaign',
  ALREADY_APPLIED: 'You have already applied to this campaign',
  ALREADY_JOINED: 'You have already joined this campaign',
  APPLICATION_PENDING: 'Your application is pending review',
  CAMPAIGN_COMPLETED: 'You have already completed this campaign',
  APPLICATION_REFUSED: 'Your application was refused for this campaign',
  CAMPAIGN_NOT_PUBLIC: 'This campaign is private and requires approval process',
  DELIVERABLE_NOT_FOUND: 'Deliverable not found for this campaign',
  WORK_NOT_FOUND: 'Work item not found',
  WORK_WRONG_CAMPAIGN: 'Work item does not belong to this campaign',
  DELIVERABLE_ALREADY_FINISHED: 'Deliverable is already marked as finished',
  FAILED_TO_ADD_WORK: 'Failed to add work',
  FAILED_TO_UPDATE_WORK: 'Failed to update work',
  FAILED_TO_DELETE_WORK: 'Failed to delete work',
  FAILED_TO_ADD_COMMENT: 'Failed to add comment to work',
  FAILED_TO_MARK_FINISHED: 'Failed to mark deliverable as finished',
} as const;

/**
 * Success messages for campaign interactions
 */
export const INTERACTION_SUCCESS_MESSAGES = {
  APPLICATION_SENT: 'Application sent successfully',
  CONTRACT_ACCEPTED: 'Contract accepted successfully',
  WORK_ADDED: 'Work added successfully',
  WORK_UPDATED: 'Work updated successfully',
  WORK_DELETED: 'Work deleted successfully',
  COMMENT_ADDED: 'Comment added successfully',
  DELIVERABLE_FINISHED: 'Deliverable marked as finished successfully',
} as const;

/**
 * Default values for campaign interactions
 */
export const INTERACTION_DEFAULTS = {
  INITIAL_CAMPAIGN_VALUES: {
    viewsGenerated: 0,
    earnings: 0,
    budgetHeld: 0,
    spentBudget: 0,
    payoutExecuted: false,
  },
  WORK_SORT_ORDER: { createdAt: 'DESC' as const },
  COMMENT_SORT_ORDER: { createdAt: 'ASC' as const },
} as const;

/**
 * Utility functions for campaign status validation
 */
export const CAMPAIGN_STATUS_VALIDATORS = {
  /**
   * Check if a promoter campaign status allows joining
   */
  canJoinCampaign: (status?: PromoterCampaignStatus): boolean => {
    if (!status) return true;
    return ![
      PromoterCampaignStatus.ONGOING,
      PromoterCampaignStatus.AWAITING_REVIEW,
      PromoterCampaignStatus.COMPLETED,
    ].includes(status);
  },

  /**
   * Get error message for existing campaign status
   */
  getStatusErrorMessage: (status: PromoterCampaignStatus): string => {
    switch (status) {
      case PromoterCampaignStatus.ONGOING:
        return INTERACTION_ERROR_MESSAGES.ALREADY_JOINED;
      case PromoterCampaignStatus.AWAITING_REVIEW:
        return INTERACTION_ERROR_MESSAGES.APPLICATION_PENDING;
      case PromoterCampaignStatus.COMPLETED:
        return INTERACTION_ERROR_MESSAGES.CAMPAIGN_COMPLETED;
      case PromoterCampaignStatus.REFUSED:
        return INTERACTION_ERROR_MESSAGES.APPLICATION_REFUSED;
      default:
        return INTERACTION_ERROR_MESSAGES.ALREADY_APPLIED;
    }
  },
} as const;

/**
 * Utility functions for entity transformation
 */
export const ENTITY_TRANSFORMERS = {
  /**
   * Transform CampaignWorkEntity to CampaignWork DTO
   */
  workEntityToDto: (work: CampaignWorkEntity, campaignId: string) => ({
    id: work.id,
    campaignId: campaignId,
    promoterLink: work.promoterLink,
    description: work.description,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    comments:
      work.comments?.map((comment: CampaignWorkCommentEntity) => ({
        id: comment.id,
        workId: comment.workId,
        commentMessage: comment.commentMessage,
        commentatorId: comment.commentatorId,
        commentatorName: comment.commentatorName,
        createdAt: comment.createdAt,
      })) || [],
  }),

  /**
   * Transform deliverable entity to DTO
   */
  deliverableEntityToDto: (deliverable: CampaignDeliverableEntity) => ({
    id: deliverable.id,
    campaignId: deliverable.campaignId,
    deliverable: deliverable.deliverable,
    isSubmitted: deliverable.isSubmitted,
    isFinished: deliverable.isFinished,
    createdAt: deliverable.createdAt,
    updatedAt: deliverable.updatedAt,
  }),
} as const;

/**
 * Response builders for consistent API responses
 */
export const RESPONSE_BUILDERS = {
  /**
   * Build success response
   */
  buildSuccessResponse: <T>(message: string, data?: T) => ({
    success: true,
    message,
    ...(data && { data }),
  }),

  /**
   * Build error response
   */
  buildErrorResponse: (message: string) => ({
    success: false,
    message,
  }),

  /**
   * Build application response
   */
  buildApplicationResponse: (application: CampaignApplicationEntity) => ({
    success: true,
    message: INTERACTION_SUCCESS_MESSAGES.APPLICATION_SENT,
    data: {
      applicationId: application.id,
      status: application.status,
    },
  }),

  /**
   * Build contract response
   */
  buildContractResponse: (contract: PromoterCampaign) => ({
    success: true,
    message: INTERACTION_SUCCESS_MESSAGES.CONTRACT_ACCEPTED,
    data: {
      contractId: contract.id,
      campaignId: contract.campaignId,
      status: contract.status,
      acceptedAt: contract.joinedAt.toISOString(),
    },
  }),
} as const;

/**
 * Repository query builders
 */
export const QUERY_BUILDERS = {
  /**
   * Build user find options for promoter
   */
  buildPromoterFindOptions: (firebaseUid: string) => ({
    where: { firebaseUid, role: UserType.PROMOTER },
  }),

  /**
   * Build user find options for advertiser
   */
  buildAdvertiserFindOptions: (firebaseUid: string) => ({
    where: { firebaseUid, role: UserType.ADVERTISER },
  }),

  /**
   * Build campaign find options
   */
  buildCampaignFindOptions: (campaignId: string) => ({
    where: { id: campaignId, status: CampaignStatus.ACTIVE },
    relations: ['advertiser'],
  }),

  /**
   * Build campaign find options for advertiser
   */
  buildAdvertiserCampaignFindOptions: (
    campaignId: string,
    advertiserId: string,
  ) => ({
    where: { id: campaignId, advertiserId },
  }),

  /**
   * Build promoter campaign find options
   */
  buildPromoterCampaignFindOptions: (
    promoterId: string,
    campaignId: string,
  ) => ({
    where: { promoterId, campaignId },
  }),

  /**
   * Build campaign application find options
   */
  buildCampaignApplicationFindOptions: (
    promoterId: string,
    campaignId: string,
  ) => ({
    where: { promoterId, campaignId },
  }),

  /**
   * Build deliverable find options
   */
  buildDeliverableFindOptions: (deliverableId: string, campaignId: string) => ({
    where: { id: deliverableId, campaignId },
  }),

  /**
   * Build work find options
   */
  buildWorkFindOptions: (workId: string, deliverableId: string) => ({
    where: { id: workId, deliverableId },
    relations: ['deliverable'],
  }),

  /**
   * Build work list options
   */
  buildWorkListOptions: (deliverableId: string) => ({
    where: { deliverableId },
    relations: ['comments'],
    order: INTERACTION_DEFAULTS.WORK_SORT_ORDER,
  }),

  /**
   * Build transaction find options for promoter campaign
   * Finds all transactions for a specific promoter in a specific campaign
   */
  buildPromoterCampaignTransactionOptions: (
    promoterId: string,
    campaignId: string,
  ) => ({
    where: {
      userId: promoterId,
      campaignId: campaignId,
    },
    relations: ['campaign', 'user'],
    order: { createdAt: 'DESC' as const },
  }),
} as const;
