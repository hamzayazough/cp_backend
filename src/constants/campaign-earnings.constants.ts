/**
 * Constants for campaign earnings calculations
 */

export const CAMPAIGN_EARNINGS_CONSTANTS = {
  /** Minimum payout threshold in cents ($5.00) */
  MINIMUM_PAYOUT_THRESHOLD_CENTS: 500,

  /** Platform fee percentage (20%) */
  PLATFORM_FEE_PERCENTAGE: 0.2,

  /** Conversion factor from cents to dollars */
  CENTS_TO_DOLLARS: 100,

  /** Views per payment calculation (per 100 views for CPV) */
  VIEWS_PER_CPV_CALCULATION: 100,
} as const;

export const CAMPAIGN_EARNINGS_MESSAGES = {
  CALCULATION_STARTED: 'Starting earnings calculation',
  CALCULATION_COMPLETED: 'Earnings calculation completed',
  PAYOUT_QUALIFIED: 'Campaign qualifies for payout',
  PAYOUT_NOT_QUALIFIED: 'Campaign does not qualify for payout',
  RECORD_CREATED: 'Campaign earnings record created',
  RECORD_UPDATED: 'Campaign earnings record updated',
  INSUFFICIENT_EARNINGS: 'Net earnings below minimum threshold',
} as const;
