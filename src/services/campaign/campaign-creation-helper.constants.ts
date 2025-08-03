import { UserType } from '../../enums/user-type';
import {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../../database/entities/transaction.entity';
import { CampaignType } from '../../enums/campaign-type';
import { Deliverable } from '../../enums/deliverable';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { CampaignDeliverableEntity } from '../../database/entities/campaign-deliverable.entity';
import { CampaignBudgetTracking } from '../../database/entities/campaign-budget-tracking.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { Campaign } from '../../interfaces/campaign';
import { v4 as uuidv4 } from 'uuid';

/**
 * Constants for campaign creation operations
 */
export const CAMPAIGN_CREATION_CONSTANTS = {
  /**
   * Campaign types that support deliverables
   */
  DELIVERABLE_SUPPORTED_TYPES: [CampaignType.CONSULTANT, CampaignType.SELLER],

  /**
   * Default values for campaign creation
   */
  DEFAULTS: {
    DELIVERABLE_SUBMITTED: false,
    DELIVERABLE_FINISHED: false,
    SPENT_BUDGET_CENTS: 0,
    PLATFORM_FEES_COLLECTED_CENTS: 0,
  },

  /**
   * Validation messages
   */
  ERROR_MESSAGES: {
    USER_NOT_FOUND: 'User not found',
    INVALID_USER_ROLE: 'User must be an advertiser',
    CAMPAIGN_NOT_FOUND: 'Campaign not found or does not belong to user',
    WALLET_NOT_FOUND:
      'Advertiser wallet not found. Please add funds to your wallet first.',
    FILE_UPLOAD_FAILED: 'Failed to upload file',
    CAMPAIGN_CREATION_FAILED: 'Campaign creation failed',
    INSUFFICIENT_FUNDS:
      'Insufficient funds. You need an additional ${{shortfall}} to create this campaign. Available: ${{available}}, Required: ${{required}}',
  },

  /**
   * Success messages
   */
  SUCCESS_MESSAGES: {
    FILE_UPLOADED: 'File uploaded successfully',
    CAMPAIGN_CREATED: 'Campaign created successfully',
  },

  /**
   * Transaction descriptions
   */
  TRANSACTION_DESCRIPTIONS: {
    CAMPAIGN_FUNDING: 'Budget allocated for campaign creation - ${{amount}}',
  },
} as const;

/**
 * Helper utilities for campaign creation
 */
export const CAMPAIGN_CREATION_UTILITIES = {
  /**
   * Generate unique file key for S3 upload
   */
  generateFileKey: (firebaseUid: string, originalName: string): string => {
    return `${firebaseUid}/${Date.now()}-${uuidv4()}-${originalName}`;
  },

  /**
   * Convert dollars to cents
   */
  dollarsToCents: (dollars: number): number => {
    return Math.round(dollars * 100);
  },

  /**
   * Format currency amount
   */
  formatCurrency: (amount: number): string => {
    const safeAmount = Number(amount) || 0;
    return isFinite(safeAmount) ? safeAmount.toFixed(2) : '0.00';
  },

  /**
   * Calculate available wallet balance
   */
  calculateAvailableBalance: (wallet: Wallet): number => {
    return wallet.currentBalance - (wallet.heldForCampaigns || 0);
  },

  /**
   * Check if campaign type supports deliverables
   */
  supportsDeliverables: (campaignType: CampaignType): boolean => {
    return (
      CAMPAIGN_CREATION_CONSTANTS.DELIVERABLE_SUPPORTED_TYPES as readonly CampaignType[]
    ).includes(campaignType);
  },

  /**
   * Extract deliverable enums from campaign data
   */
  extractDeliverablesFromCampaign: (campaignData: Campaign): Deliverable[] => {
    if (
      campaignData.type === CampaignType.CONSULTANT &&
      'expectedDeliverables' in campaignData
    ) {
      return (
        campaignData.expectedDeliverables?.map((cd) => cd.deliverable) || []
      );
    }

    if (
      campaignData.type === CampaignType.SELLER &&
      'deliverables' in campaignData
    ) {
      return campaignData.deliverables?.map((cd) => cd.deliverable) || [];
    }

    return [];
  },
} as const;

/**
 * Entity builders for campaign creation
 */
export const CAMPAIGN_ENTITY_BUILDERS = {
  /**
   * Build deliverable entity from deliverable enum
   */
  buildDeliverableEntity: (
    campaignId: string,
    deliverable: Deliverable,
  ): CampaignDeliverableEntity => {
    const entity = new CampaignDeliverableEntity();
    entity.campaignId = campaignId;
    entity.deliverable = deliverable;
    entity.isSubmitted =
      CAMPAIGN_CREATION_CONSTANTS.DEFAULTS.DELIVERABLE_SUBMITTED;
    entity.isFinished =
      CAMPAIGN_CREATION_CONSTANTS.DEFAULTS.DELIVERABLE_FINISHED;
    return entity;
  },

  /**
   * Build budget tracking entity for campaign
   */
  buildBudgetTrackingEntity: (
    campaign: CampaignEntity,
  ): CampaignBudgetTracking => {
    const budgetCents = CAMPAIGN_CREATION_UTILITIES.dollarsToCents(
      campaign.budgetAllocated || 0,
    );

    const budgetTracking = new CampaignBudgetTracking();
    budgetTracking.campaignId = campaign.id;
    budgetTracking.advertiserId = campaign.advertiserId;
    budgetTracking.allocatedBudgetCents = budgetCents;
    budgetTracking.spentBudgetCents =
      CAMPAIGN_CREATION_CONSTANTS.DEFAULTS.SPENT_BUDGET_CENTS;
    budgetTracking.platformFeesCollectedCents =
      CAMPAIGN_CREATION_CONSTANTS.DEFAULTS.PLATFORM_FEES_COLLECTED_CENTS;
    budgetTracking.cpvCents = campaign.cpv
      ? CAMPAIGN_CREATION_UTILITIES.dollarsToCents(campaign.cpv)
      : null;
    budgetTracking.commissionRate = campaign.commissionPerSale || null;

    return budgetTracking;
  },

  /**
   * Build transaction entity for budget allocation
   */
  buildBudgetAllocationTransaction: (
    advertiserId: string,
    budgetDollars: number,
  ): Transaction => {
    const transaction = new Transaction();
    transaction.userId = advertiserId;
    transaction.userType = UserType.ADVERTISER;
    transaction.type = TransactionType.CAMPAIGN_FUNDING;
    transaction.amount = -budgetDollars; // Negative for money held/allocated
    transaction.status = TransactionStatus.COMPLETED;
    transaction.description =
      CAMPAIGN_CREATION_CONSTANTS.TRANSACTION_DESCRIPTIONS.CAMPAIGN_FUNDING.replace(
        '{{amount}}',
        CAMPAIGN_CREATION_UTILITIES.formatCurrency(budgetDollars),
      );
    transaction.paymentMethod = PaymentMethod.WALLET;

    return transaction;
  },
} as const;

/**
 * Validation helpers for campaign creation
 */
export const CAMPAIGN_VALIDATORS = {
  /**
   * Validate user exists and return user entity
   */
  validateUserExists: (user: UserEntity | null): UserEntity => {
    if (!user) {
      throw new Error(
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.USER_NOT_FOUND,
      );
    }
    if (user.role !== UserType.ADVERTISER) {
      throw new Error(
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.INVALID_USER_ROLE,
      );
    }
    return user;
  },

  /**
   * Validate campaign exists and belongs to user
   */
  validateCampaignOwnership: (
    campaign: CampaignEntity | null,
    userId: string,
  ): CampaignEntity => {
    if (!campaign || campaign.advertiserId !== userId) {
      throw new Error(
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.CAMPAIGN_NOT_FOUND,
      );
    }
    return campaign;
  },

  /**
   * Validate wallet exists
   */
  validateWalletExists: (wallet: Wallet | null): Wallet => {
    if (!wallet) {
      throw new Error(
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.WALLET_NOT_FOUND,
      );
    }
    return wallet;
  },

  /**
   * Validate sufficient funds and return validation result
   */
  validateSufficientFunds: (
    wallet: Wallet,
    requiredAmount: number,
  ): {
    isValid: boolean;
    availableBalance: number;
    shortfall: number;
  } => {
    const availableBalance =
      CAMPAIGN_CREATION_UTILITIES.calculateAvailableBalance(wallet);
    const shortfall = requiredAmount - availableBalance;

    return {
      isValid: availableBalance >= requiredAmount,
      availableBalance,
      shortfall: Math.max(0, shortfall),
    };
  },

  /**
   * Build insufficient funds error message
   */
  buildInsufficientFundsMessage: (
    availableBalance: number,
    requiredAmount: number,
    shortfall: number,
  ): string => {
    return CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.INSUFFICIENT_FUNDS.replace(
      '{{shortfall}}',
      CAMPAIGN_CREATION_UTILITIES.formatCurrency(shortfall),
    )
      .replace(
        '{{available}}',
        CAMPAIGN_CREATION_UTILITIES.formatCurrency(availableBalance),
      )
      .replace(
        '{{required}}',
        CAMPAIGN_CREATION_UTILITIES.formatCurrency(requiredAmount),
      );
  },
} as const;

/**
 * Response builders for campaign creation
 */
export const CAMPAIGN_RESPONSE_BUILDERS = {
  /**
   * Build successful file upload response
   */
  buildFileUploadSuccessResponse: (
    fileUrl: string,
    campaign: Campaign,
  ): {
    success: boolean;
    message: string;
    fileUrl: string;
    campaign: Campaign;
  } => ({
    success: true,
    message: CAMPAIGN_CREATION_CONSTANTS.SUCCESS_MESSAGES.FILE_UPLOADED,
    fileUrl,
    campaign,
  }),

  /**
   * Build successful campaign creation response
   */
  buildCampaignCreationSuccessResponse: (
    campaign: Campaign,
  ): {
    success: boolean;
    message: string;
    campaign: Campaign;
  } => ({
    success: true,
    message: CAMPAIGN_CREATION_CONSTANTS.SUCCESS_MESSAGES.CAMPAIGN_CREATED,
    campaign,
  }),
} as const;

/**
 * Response interfaces for campaign operations
 */
export interface CreateCampaignResponse {
  success: boolean;
  message: string;
  campaign?: Campaign;
}

export interface UploadFileResponse {
  success: boolean;
  message: string;
  fileUrl?: string;
  campaign?: Campaign;
}

export interface DeleteMediaResponse {
  success: boolean;
  message: string;
}
