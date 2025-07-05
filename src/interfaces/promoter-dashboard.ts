import { CampaignType } from '../enums/campaign-type';

export interface PromoterDashboardRequest {
  includeStats?: boolean;
  includeCampaigns?: boolean;
  includeSuggestions?: boolean;
  includeTransactions?: boolean;
  includeMessages?: boolean;
  includeWallet?: boolean;
  activeCampaignLimit?: number;
  suggestedCampaignLimit?: number;
  transactionLimit?: number;
  messageLimit?: number;
}

export interface PromoterStats {
  earningsThisWeek: number;
  earningsLastWeek: number;
  earningsPercentageChange: number;
  viewsToday: number;
  viewsYesterday: number;
  viewsPercentageChange: number;
  salesThisWeek: number;
  salesLastWeek: number;
  salesPercentageChange: number;
  activeCampaigns: number;
  pendingReviewCampaigns: number;
}

export interface PromoterActiveCampaign {
  id: string;
  title: string;
  type: CampaignType;
  status: string;
  views: number;
  earnings: number;
  advertiser: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromoterSuggestedCampaign {
  id: string;
  title: string;
  type: CampaignType;
  cpv?: number;
  budget?: number;
  advertiser: string;
  tags: string[];
  description: string;
  requirements: string[];
  estimatedEarnings: number;
  applicationDeadline?: string;
}

export interface PromoterTransaction {
  id: string;
  amount: number;
  status: string;
  date: string;
  campaign: string;
  campaignId?: string;
  type: string;
  paymentMethod: string;
  description?: string;
  estimatedPaymentDate?: string;
}

export interface PromoterMessage {
  id: string;
  name: string;
  message: string;
  time: string;
  avatar?: string;
  isRead: boolean;
  threadId: string;
  senderType: string;
  campaignId: string;
}

export interface PromoterWalletViewEarnings {
  currentBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  lastPayoutDate?: string;
  nextPayoutDate?: string;
  minimumThreshold: number;
}

export interface PromoterWalletDirectEarnings {
  totalEarned: number;
  totalPaid: number;
  pendingPayments: number;
  lastPaymentDate?: string;
}

export interface PromoterWallet {
  viewEarnings: PromoterWalletViewEarnings;
  directEarnings: PromoterWalletDirectEarnings;
  totalLifetimeEarnings: number;
  totalAvailableBalance: number;
}

export interface PromoterDashboardData {
  stats?: PromoterStats;
  activeCampaigns?: PromoterActiveCampaign[];
  suggestedCampaigns?: PromoterSuggestedCampaign[];
  recentTransactions?: PromoterTransaction[];
  recentMessages?: PromoterMessage[];
  wallet?: PromoterWallet;
}

export interface PromoterDashboardResponse {
  success: boolean;
  data: PromoterDashboardData;
  message: string;
}
