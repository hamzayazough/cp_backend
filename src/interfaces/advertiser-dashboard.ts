export interface AdvertiserStats {
  spendingThisWeek: number;
  spendingLastWeek: number;
  spendingPercentageChange: number;
  viewsToday: number;
  viewsYesterday: number;
  viewsPercentageChange: number;
  conversionsThisWeek: number;
  conversionsLastWeek: number;
  conversionsPercentageChange: number;
  activeCampaigns: number;
  pendingApprovalCampaigns: number;
}

export interface AdvertiserActiveCampaign {
  id: string;
  title: string;
  type: 'VISIBILITY' | 'SALESMAN' | 'CONSULTANT';
  status: 'ONGOING' | 'AWAITING_PROMOTER' | 'COMPLETED' | 'PAUSED';
  views: number;
  spent: number;
  applications: number;
  conversions: number;
  deadline: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvertiserRecommendedPromoter {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  followers: number;
  specialties: string[];
  location?: string;
  successRate: number;
  averageViews: number;
  completedCampaigns: number;
  priceRange: {
    min: number;
    max: number;
  };
  isVerified: boolean;
  languages: string[];
}

export interface AdvertiserTransaction {
  id: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  date: string;
  campaign: string;
  campaignId: string;
  promoter?: string;
  promoterId?: string;
  type:
    | 'CAMPAIGN_PAYMENT'
    | 'PROMOTER_PAYMENT'
    | 'CONSULTANT_FEE'
    | 'COMMISSION_PAYMENT'
    | 'REFUND'
    | 'WALLET_DEPOSIT';
  paymentMethod: 'WALLET' | 'CREDIT_CARD' | 'BANK_TRANSFER';
  description?: string;
  estimatedDeliveryDate?: string;
}

export interface AdvertiserMessage {
  id: string;
  name: string;
  message: string;
  time: string;
  avatar?: string;
  isRead: boolean;
  threadId: string;
  senderType: 'PROMOTER' | 'ADMIN' | 'SYSTEM';
  campaignId?: string;
}

export interface AdvertiserWallet {
  balance: {
    currentBalance: string | number;
    pendingCharges: string | number;
    totalSpent: string | number;
    totalDeposited: string | number;
    lastDepositDate?: string;
    minimumBalance: string | number;
  };
  campaignBudgets: {
    totalAllocated: string | number;
    totalUsed: string | number;
    pendingPayments: string | number;
    lastPaymentDate?: string;
  };
  totalLifetimeSpent: string | number;
  totalAvailableBalance: string | number;
}

export interface AdvertiserDashboardData {
  stats: AdvertiserStats;
  activeCampaigns: AdvertiserActiveCampaign[];
  recommendedPromoters: AdvertiserRecommendedPromoter[];
  recentTransactions: AdvertiserTransaction[];
  recentMessages: AdvertiserMessage[];
  wallet: AdvertiserWallet;
}

// Request interfaces
export interface GetAdvertiserDashboardRequest {
  userId?: string; // Optional, can be derived from auth token
  includeStats?: boolean;
  includeCampaigns?: boolean;
  includeRecommendations?: boolean;
  includeTransactions?: boolean;
  includeMessages?: boolean;
  includeWallet?: boolean;
  activeCampaignLimit?: number;
  recommendedPromoterLimit?: number;
  transactionLimit?: number;
  messageLimit?: number;
}

// Response interfaces
export interface GetAdvertiserDashboardResponse {
  success: boolean;
  data: AdvertiserDashboardData;
  message?: string;
}

export interface GetAdvertiserStatsResponse {
  success: boolean;
  data: AdvertiserStats;
  message?: string;
}

export interface GetAdvertiserCampaignsResponse {
  success: boolean;
  data: {
    activeCampaigns: AdvertiserActiveCampaign[];
    totalActive: number;
    totalCompleted: number;
    totalPending: number;
  };
  message?: string;
}

export interface GetRecommendedPromotersResponse {
  success: boolean;
  data: {
    promoters: AdvertiserRecommendedPromoter[];
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface GetAdvertiserTransactionsResponse {
  success: boolean;
  data: {
    transactions: AdvertiserTransaction[];
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface GetAdvertiserMessagesResponse {
  success: boolean;
  data: {
    messages: AdvertiserMessage[];
    unreadCount: number;
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface GetAdvertiserWalletResponse {
  success: boolean;
  data: AdvertiserWallet;
  message?: string;
}
