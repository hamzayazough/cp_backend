export interface Wallet {
  id: string;
  promoterId: string;

  // View earnings (accumulated from visibility/salesman campaigns)
  currentBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  lastPayoutDate?: Date;
  nextPayoutDate?: Date;
  minimumThreshold: number;

  // Direct earnings (consultant/seller campaigns)
  directTotalEarned: number;
  directTotalPaid: number;
  directPendingPayments: number;
  directLastPaymentDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// Wallet summary for dashboard
export interface WalletSummary {
  totalAvailableBalance: number;
  pendingEarnings: number;
  totalLifetimeEarnings: number;
  nextPayoutDate?: Date;
  minimumThreshold: number;

  breakdown: {
    viewEarnings: {
      current: number;
      pending: number;
      totalEarned: number;
      lastPayout?: Date;
    };
    directEarnings: {
      totalEarned: number;
      totalPaid: number;
      pending: number;
      lastPayment?: Date;
    };
  };
}

// Withdrawal/payout requests
export interface WithdrawalRequest {
  promoterId: string;
  amount: number;
  paymentMethod: 'STRIPE' | 'BANK_TRANSFER';
  bankDetails?: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
  };
}

export interface PayoutSchedule {
  promoterId: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  minimumAmount: number;
  nextPayoutDate?: Date;
  autoPayoutEnabled: boolean;
}

// Earnings breakdown by campaign type
export interface EarningsBreakdown {
  period: {
    start: Date;
    end: Date;
  };
  totalEarnings: number;
  earningsByType: {
    visibility: number;
    consultant: number;
    seller: number;
    salesman: number;
  };
  topCampaigns: Array<{
    campaignId: string;
    campaignTitle: string;
    earnings: number;
    campaignType: string;
  }>;
}
