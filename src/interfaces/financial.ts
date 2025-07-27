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

// Campaign budget tracking
export interface CampaignBudgetTracking {
  campaignId: string;
  advertiserId: string;
  allocatedBudgetCents: number;
  spentBudgetCents: number;
  platformFeesCollectedCents: number;
  cpvCents?: number; // Cost per 100 views for visibility campaigns
  commissionRate?: number; // Commission rate percentage for salesman campaigns
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}
