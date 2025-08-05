import { CampaignType } from '../../enums/campaign-type';

/**
 * Campaign Management Helper Constants and Utilities
 * Contains constants, calculations, and helper functions to lighten the main service
 */

/**
 * Campaign completion messages and templates
 */
export const CAMPAIGN_COMPLETION_MESSAGES = {
  VISIBILITY: {
    STARTING: (campaignId: string) =>
      `💰 Processing VISIBILITY campaign ${campaignId} budget reconciliation`,
    NO_CPV: (campaignId: string) =>
      `VISIBILITY campaign ${campaignId} has no CPV set, skipping reconciliation`,
    ANALYSIS: (campaignId: string, views: number, cpv: number, spent: number) =>
      `📊 VISIBILITY campaign ${campaignId} analysis: ` +
      `Total unique views: ${views}, ` +
      `CPV: $${(cpv / 100).toFixed(2)}, ` +
      `Actual spent: $${spent.toFixed(2)}`,
    NO_WALLET: (campaignId: string) =>
      `Advertiser wallet not found for campaign ${campaignId}`,
    NO_FUNDS_TO_RELEASE: (campaignId: string) =>
      `✅ No funds to release for VISIBILITY campaign ${campaignId}`,
    RELEASING_FUNDS: (amount: number, campaignId: string) =>
      `💰 Releasing $${amount.toFixed(2)} unused funds for VISIBILITY campaign ${campaignId}`,
    FUNDS_RELEASED: (amount: number, campaignId: string) =>
      `✅ Released $${amount.toFixed(2)} back to advertiser wallet for campaign ${campaignId}`,
  },
  CONSULTANT_SELLER: {
    NO_MIN_BUDGET: (campaignId: string, type: CampaignType) =>
      `Campaign ${campaignId} is ${type} but has no minBudget set`,
    NO_BUDGET_TRACKING: (campaignId: string) =>
      `No budget tracking found for campaign ${campaignId}, skipping reconciliation`,
    ANALYSIS: (
      campaignId: string,
      minBudget: number,
      spent: number,
      remaining: number,
    ) =>
      `📊 Budget analysis for campaign ${campaignId}: ` +
      `MinBudget: $${minBudget}, ` +
      `Spent: $${spent.toFixed(2)}, ` +
      `Remaining: $${remaining.toFixed(2)}`,
    FULLY_UTILIZED: (campaignId: string) =>
      `✅ Campaign ${campaignId} budget fully utilized, no reconciliation needed`,
    NO_PROMOTERS: (campaignId: string) =>
      `No promoters found for campaign ${campaignId}, cannot distribute remaining budget`,
    NO_ADVERTISER: (campaignId: string) =>
      `Advertiser not found for campaign ${campaignId}, cannot process payments`,
    AMOUNT_TOO_SMALL: (promoterCount: number) =>
      `Remaining budget too small to distribute among ${promoterCount} promoters`,
    DISTRIBUTING: (amount: number, promoterCount: number) =>
      `💳 Distributing $${amount.toFixed(2)} to each of ${promoterCount} promoters`,
    PAYMENT_SUCCESS: (promoterId: string) =>
      `✅ Reconciliation payment processed for promoter ${promoterId}`,
    PAYMENT_FAILED: (promoterId: string) =>
      `❌ Failed to process reconciliation payment for promoter ${promoterId}:`,
  },
  GENERAL: {
    STARTING: (type: CampaignType, campaignId: string) =>
      `💰 Processing budget reconciliation for ${type} campaign ${campaignId}`,
    RECONCILIATION_FAILED: (campaignId: string) =>
      `❌ Failed to process budget reconciliation for campaign ${campaignId}:`,
    COMPLETION_STARTING: (campaignId: string) =>
      `🏁 Starting completion process for campaign ${campaignId}`,
    COMPLETION_SUCCESS: (
      campaignId: string,
      promoterCount: number,
      budgetReconciled: boolean,
    ) =>
      `✅ Campaign ${campaignId} completed successfully. ` +
      `Promoter campaigns updated: ${promoterCount}, ` +
      `Budget reconciliation: ${budgetReconciled ? 'processed' : 'skipped'}`,
    COMPLETION_FAILED: (campaignId: string) =>
      `❌ Failed to complete campaign ${campaignId}:`,
    BATCH_STARTING: (campaignCount: number) =>
      `🏁 Starting batch completion for ${campaignCount} campaigns`,
    BATCH_RESULTS: (successCount: number, totalCount: number) =>
      `📊 Batch completion results: ${successCount}/${totalCount} campaigns completed successfully`,
  },
} as const;

/**
 * Error messages for campaign management operations
 */
export const CAMPAIGN_MANAGEMENT_ERROR_MESSAGES = {
  CAMPAIGN_NOT_FOUND: 'Campaign not found',
  PROMOTER_DETAILS_NOT_FOUND: 'Promoter details not found',
  USER_NOT_FOUND: 'User not found',
} as const;

/**
 * Campaign completion status constants
 */
export const CAMPAIGN_COMPLETION_STATUS = {
  ACTIVE: 'ACTIVE',
} as const;

/**
 * Transaction descriptions for different scenarios
 */
export const TRANSACTION_DESCRIPTIONS = {
  FUND_RELEASE: (actualSpent: number) =>
    `Unused funds released for VISIBILITY campaign completion. Actual spent: $${actualSpent.toFixed(2)}`,
} as const;

/**
 * Campaign budget calculation utilities
 */
export class CampaignBudgetCalculator {
  /**
   * Calculate actual spent amount for VISIBILITY campaigns
   */
  static calculateVisibilityActualSpent(
    totalViews: number,
    cpvCents: number,
  ): number {
    return (totalViews * cpvCents) / 100;
  }

  /**
   * Calculate funds to release for VISIBILITY campaigns
   */
  static calculateFundsToRelease(
    currentHeldFunds: number,
    actualSpent: number,
  ): number {
    return Math.max(0, currentHeldFunds - actualSpent);
  }

  /**
   * Convert minBudget to cents
   */
  static convertMinBudgetToCents(minBudget: number): number {
    return Math.round(minBudget * 100);
  }

  /**
   * Calculate remaining budget in cents
   */
  static calculateRemainingBudgetCents(
    minBudgetCents: number,
    spentCents: number,
  ): number {
    return minBudgetCents - spentCents;
  }

  /**
   * Calculate payment per promoter (split equally)
   */
  static calculatePaymentPerPromoter(
    remainingBudgetCents: number,
    promoterCount: number,
  ): number {
    return Math.floor(remainingBudgetCents / promoterCount);
  }

  /**
   * Convert cents to dollars for display
   */
  static centsToDollars(cents: number): number {
    return cents / 100;
  }
}

/**
 * Campaign type validation utilities
 */
export class CampaignTypeValidator {
  /**
   * Check if campaign type requires VISIBILITY reconciliation
   */
  static isVisibilityCampaign(type: CampaignType): boolean {
    return type === CampaignType.VISIBILITY;
  }

  /**
   * Check if campaign type requires CONSULTANT/SELLER reconciliation
   */
  static isConsultantOrSellerCampaign(type: CampaignType): boolean {
    return type === CampaignType.CONSULTANT || type === CampaignType.SELLER;
  }

  /**
   * Check if campaign type requires any reconciliation
   */
  static requiresReconciliation(type: CampaignType): boolean {
    return (
      this.isVisibilityCampaign(type) || this.isConsultantOrSellerCampaign(type)
    );
  }
}

/**
 * Validation result types
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Campaign validation utilities
 */
export class CampaignValidator {
  /**
   * Validate VISIBILITY campaign for reconciliation
   */
  static validateVisibilityCampaign(campaign: {
    id: string;
    cpv?: number;
  }): ValidationResult {
    if (!campaign.cpv) {
      return {
        isValid: false,
        reason: CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.NO_CPV(campaign.id),
      };
    }
    return { isValid: true };
  }

  /**
   * Validate CONSULTANT/SELLER campaign for reconciliation
   */
  static validateConsultantSellerCampaign(campaign: {
    id: string;
    type: CampaignType;
    minBudget?: number;
  }): ValidationResult {
    if (!campaign.minBudget) {
      return {
        isValid: false,
        reason: CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.NO_MIN_BUDGET(
          campaign.id,
          campaign.type,
        ),
      };
    }
    return { isValid: true };
  }

  /**
   * Validate if funds should be released for VISIBILITY campaign
   */
  static shouldReleaseFunds(fundsToRelease: number): boolean {
    return fundsToRelease > 0;
  }

  /**
   * Validate if remaining budget should be distributed
   */
  static shouldDistributeRemainingBudget(
    remainingBudgetCents: number,
  ): boolean {
    return remainingBudgetCents > 0;
  }

  /**
   * Validate if payment amount is valid for distribution
   */
  static isPaymentAmountValid(paymentPerPromoterCents: number): boolean {
    return paymentPerPromoterCents > 0;
  }
}
