import { CampaignType } from '../enums/campaign-type';

// Enhanced payment tracking interfaces
export interface PaymentTransaction {
  id: string;
  type: 'CHARGE' | 'PAYOUT' | 'REFUND';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  description?: string;
  relatedCampaignId?: string;
  stripeTransactionId?: string;
  processedAt?: Date;
  createdAt: Date;
}

// Stripe Connect account management
export interface StripeConnectAccount {
  userId: string;
  stripeAccountId: string;
  status: 'pending' | 'active' | 'restricted' | 'rejected';
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
  capabilities: {
    transfers: 'active' | 'inactive' | 'pending';
    cardPayments: 'active' | 'inactive' | 'pending';
  };
  createdAt: Date;
  updatedAt: Date;
}

// Payment method for advertisers
export interface StripePaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account' | 'sepa_debit';
  last4: string;
  brand?: string; // For cards: visa, mastercard, etc.
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

// Campaign budget allocation
export interface CampaignBudgetAllocation {
  campaignId: string;
  campaignType: CampaignType;
  totalBudget: number;
  allocatedBudget: number;
  remainingBudget: number;
  spentAmount: number;
  heldAmount: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'PAUSED';
}

// Billing period summary
export interface BillingPeriodSummary {
  periodStart: Date;
  periodEnd: Date;

  // For promoters
  totalEarned?: number;
  totalPaidOut?: number;
  pendingPayouts?: number;
  campaignsCompleted?: number;

  // For advertisers
  totalSpent?: number;
  totalCharged?: number;
  campaignsFunded?: number;
  remainingCredits?: number;
}

// Financial analytics
export interface FinancialAnalytics {
  userId: string;
  userType: 'PROMOTER' | 'ADVERTISER';
  period: {
    start: Date;
    end: Date;
  };

  overview: {
    totalTransactions: number;
    totalAmount: number;
    averageTransactionAmount: number;
    largestTransaction: number;
  };

  trends: {
    monthlyGrowth: number; // Percentage
    quarterlyGrowth: number;
    yearlyGrowth: number;
  };

  breakdown: {
    [CampaignType.VISIBILITY]?: number;
    [CampaignType.CONSULTANT]?: number;
    [CampaignType.SELLER]?: number;
    [CampaignType.SALESMAN]?: number;
  };
}

// Payout settings for promoters
export interface PayoutSettings {
  promoterId: string;
  minimumThreshold: number;
  autoPayoutEnabled: boolean;
  payoutFrequency: 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  preferredPayoutMethod: 'STRIPE' | 'BANK_TRANSFER';
  stripeAccountId?: string;
  bankAccountId?: string;
  taxInformation?: {
    taxIdProvided: boolean;
    w9Submitted: boolean;
    taxFormType?: 'W9' | '1099' | 'OTHER';
  };
}

// Invoice generation for enterprise advertisers
export interface Invoice {
  id: string;
  advertiserId: string;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: Date;
  paidAt?: Date;
  campaignIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
