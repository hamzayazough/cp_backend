import { CampaignType } from '../enums/campaign-type';
import { CampaignStatus } from '../enums/campaign-status';
import { PromoterCampaignStatus } from '../database/entities/promoter-campaign.entity';
import { Advertiser } from './explore-campaign';
import { CampaignMedia } from './campaign-media';

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
  mediaUrls?: CampaignMedia[]; // Campaign media files (images/videos)
  type: CampaignType;
  status: PromoterCampaignStatus;
  views: number;
  earnings: number;
  advertiser: Advertiser;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  requirements?: string[];
  minBudget?: number; //if consultant or seller type
  maxBudget?: number; //if consultant or seller type
  meetingPlan?: string; //if consultant or seller type
  meetingCount?: number; //if consultant or seller type
  meetingDone?: boolean; // if consultant or seller type
  cpv?: number; //if visibility type
  maxViews?: number; //if visibility type
  commissionPerSale?: number; //if salesman type
}

export interface PromoterSuggestedCampaign {
  id: string;
  title: string;
  mediaUrls?: CampaignMedia[]; // Campaign media files (images/videos)
  type: CampaignType;
  status: CampaignStatus;
  advertiser: Advertiser;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  requirements?: string[];
  minBudget?: number; //if consultant or seller type
  maxBudget?: number; //if consultant or seller type
  meetingPlan?: string; //if consultant or seller type
  meetingCount?: number; //if consultant or seller type
  cpv?: number; //if visibility type
  maxViews?: number; //if visibility type
  commissionPerSale?: number; //if salesman type
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
