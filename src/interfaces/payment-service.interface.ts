import {
  PayoutRecord,
  AdvertiserCharge,
  PromoterBalance,
  AdvertiserSpend,
  CreateChargeRequest,
  CreatePayoutRequest,
  MonthlyPromoterEarnings,
  MonthlyAdvertiserSpend,
  PaymentDashboard,
} from '../interfaces/payment';
import { CampaignType } from '../enums/campaign-type';
import { CampaignEntity } from 'src/database/entities';

export interface PaymentService {
  // Campaign funding and payouts
  chargeCampaignBudget(
    campaign: CampaignEntity,
    promoterId: string,
    paymentMethodId: string,
  ): Promise<AdvertiserCharge>;
  executePromoterPayout(
    campaignId: string,
    promoterId: string,
    finalAmount?: number,
  ): Promise<PayoutRecord>;
  refundCampaignBudget(
    campaignId: string,
    promoterId: string,
    amount?: number,
  ): Promise<AdvertiserCharge>;

  // Periodic accounting
  calculateMonthlyPromoterEarnings(
    promoterId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MonthlyPromoterEarnings>;
  calculateMonthlyAdvertiserSpend(
    advertiserId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MonthlyAdvertiserSpend>;
  processMonthlyPayouts(minimumThreshold?: number): Promise<PayoutRecord[]>;

  // Balance tracking
  getPromoterBalance(promoterId: string): Promise<PromoterBalance | null>;
  getAdvertiserSpend(advertiserId: string): Promise<AdvertiserSpend | null>;
  updatePromoterBalance(
    promoterId: string,
    campaignType: CampaignType,
    amount: number,
  ): Promise<void>;

  // Payment history and dashboard
  getPaymentDashboard(
    userId: string,
    userType: 'PROMOTER' | 'ADVERTISER',
  ): Promise<PaymentDashboard>;
  getPayoutHistory(promoterId: string, limit?: number): Promise<PayoutRecord[]>;
  getChargeHistory(
    advertiserId: string,
    limit?: number,
  ): Promise<AdvertiserCharge[]>;

  // Stripe integration helpers
  validateStripeAccount(userId: string): Promise<boolean>;
  createStripeConnectAccount(userId: string): Promise<string>; // Returns account ID
  getStripeAccountStatus(
    userId: string,
  ): Promise<'pending' | 'active' | 'rejected'>;
}

// Payment flow constants
export const PAYMENT_CONSTANTS = {
  MINIMUM_PAYOUT_THRESHOLD: 20.0,
  STRIPE_FEE_PERCENTAGE: 0.029, // 2.9%
  STRIPE_FIXED_FEE: 0.3, // $0.30
  PAYOUT_SCHEDULE_DAY: 1, // 1st of every month
  CONSULTANT_SELLER_IMMEDIATE_PAYOUT: true, // Pay immediately after completion
  VISIBILITY_SALESMAN_MONTHLY_PAYOUT: true, // Monthly batch payouts
} as const;

// Campaign type payment behavior
export const CAMPAIGN_PAYMENT_FLOWS = {
  [CampaignType.VISIBILITY]: {
    chargeUpfront: false,
    payoutSchedule: 'monthly',
    trackEarnings: 'incremental', // Track per view
    requiresApproval: false,
  },
  [CampaignType.CONSULTANT]: {
    chargeUpfront: true,
    payoutSchedule: 'immediate',
    trackEarnings: 'lumpsum', // Single payout on completion
    requiresApproval: true,
  },
  [CampaignType.SELLER]: {
    chargeUpfront: true,
    payoutSchedule: 'immediate',
    trackEarnings: 'lumpsum', // Single payout on completion
    requiresApproval: true,
  },
  [CampaignType.SALESMAN]: {
    chargeUpfront: false,
    payoutSchedule: 'monthly',
    trackEarnings: 'incremental', // Track per sale
    requiresApproval: false,
  },
} as const;
