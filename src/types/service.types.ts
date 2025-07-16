import { UserType } from 'src/database/entities/billing-period-summary.entity';
import { CampaignType } from 'src/enums/campaign-type';
import { PromoterCampaignStatus } from 'src/interfaces';

export interface AdvertiserDashboardData {
  stats: AdvertiserStats;
  activeCampaigns: AdvertiserActiveCampaign[];
  recentTransactions: AdvertiserTransaction[];
  recentMessages: AdvertiserMessage[];
  wallet: AdvertiserWallet;
}

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
  type: CampaignType;
  status: PromoterCampaignStatus;
  views: number;
  spent: number;
  applications: number;
  conversions: number;
  deadline: string;
  createdAt: string;
  updatedAt: string;
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
  type: string;
  paymentMethod: 'WALLET' | 'CREDIT_CARD' | 'BANK_TRANSFER';
  description: string;
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
  senderType: UserType;
  campaignId?: string;
}

export interface AdvertiserWallet {
  balance: {
    currentBalance: number;
    pendingCharges: number;
    totalSpent: number;
    totalDeposited: number;
    lastDepositDate?: string;
    minimumBalance: number;
  };
  campaignBudgets: {
    totalAllocated: number;
    totalUsed: number;
    pendingPayments: number;
    lastPaymentDate?: string;
  };
  totalLifetimeSpent: number;
  totalAvailableBalance: number;
}
