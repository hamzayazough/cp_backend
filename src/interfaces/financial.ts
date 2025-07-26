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
