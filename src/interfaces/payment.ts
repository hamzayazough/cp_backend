import { CampaignType } from '../enums/campaign-type';

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ChargeStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export interface PromoterBalance {
  id: string;
  promoterId: string;
  periodStart: Date;
  periodEnd: Date;
  visibilityEarnings: number;
  consultantEarnings: number;
  sellerEarnings: number;
  salesmanEarnings: number;
  totalEarnings: number;
  paidOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Payment flow DTOs
export interface CampaignPaymentInfo {
  campaignId: string;
  campaignType: CampaignType;
  budgetHeld: number;
  finalPayoutAmount?: number;
  payoutExecuted: boolean;
  payoutDate?: Date;
  stripeChargeId?: string;
  stripeTransferId?: string;
}

export interface CreateChargeRequest {
  advertiserId: string;
  campaignId?: string;
  amount: number;
  paymentMethodId: string;
  description?: string;
}

export interface CreatePayoutRequest {
  promoterId: string;
  campaignId?: string;
  amount: number;
  description?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface MonthlyPromoterEarnings {
  promoterId: string;
  promoterName: string;
  periodStart: Date;
  periodEnd: Date;
  earningsByType: {
    visibility: number;
    consultant: number;
    seller: number;
    salesman: number;
  };
  totalEarnings: number;
  paidOut: boolean;
  payoutDate?: Date;
}

export interface PaymentDashboard {
  // Promoter view
  currentBalance: number;
  pendingPayouts: number;
  totalEarningsThisMonth: number;
  totalEarningsLastMonth: number;
  nextPayoutDate?: Date;
  // recentPayouts: Replaced with Transaction queries

  // Advertiser view
  totalSpentThisMonth: number;
  totalSpentLastMonth: number;
  activeCampaignsBudget: number;
  prepaidBalance: number;
  // recentCharges: Replaced with PaymentRecord queries
}
