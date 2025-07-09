import { CampaignType, CampaignStatus } from '../enums/campaign-type';

export interface CampaignAnalytics {
  campaignId: string;
  campaignType: CampaignType;
  status: CampaignStatus;

  // Performance metrics
  performance: {
    viewsGenerated?: number; // For visibility campaigns
    clickThroughRate?: number; // For visibility campaigns
    conversionRate?: number; // For salesman campaigns
    salesGenerated?: number; // For salesman campaigns
    deliverableCompletion?: number; // For consultant/seller campaigns (percentage)
    promoterSatisfactionRating?: number; // Advertiser rating of promoter
    advertiserSatisfactionRating?: number; // Promoter rating of advertiser
  };

  // Financial metrics
  financial: {
    budgetAllocated: number;
    budgetSpent: number;
    budgetRemaining: number;
    costPerResult: number; // Cost per view, sale, or completion
    roi: number; // Return on investment (if applicable)
    totalEarnings: number; // For promoters
  };

  // Timeline metrics
  timeline: {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number; // Duration in days
    daysToCompletion?: number;
    deadlineMet: boolean;
  };

  // Participation metrics
  participation: {
    applicationsReceived?: number; // For consultant/seller campaigns
    promotersParticipating: number;
    promoterEngagement: number; // Average engagement score
    averageTimeToJoin: number; // Time from campaign creation to promoter joining
  };

  generatedAt: Date;
}

export interface PromoterPerformanceMetrics {
  promoterId: string;
  promoterName: string;

  // Overall statistics
  overall: {
    totalCampaigns: number;
    completedCampaigns: number;
    activeCampaigns: number;
    completionRate: number;
    averageRating: number;
    totalEarnings: number;
    averageEarningsPerCampaign: number;
  };

  // Performance by campaign type
  byType: {
    [CampaignType.VISIBILITY]: {
      campaigns: number;
      totalViews: number;
      averageViews: number;
      totalEarnings: number;
      averageCPV: number;
    };
    [CampaignType.CONSULTANT]: {
      campaigns: number;
      completionRate: number;
      averageBudget: number;
      totalEarnings: number;
      averageRating: number;
    };
    [CampaignType.SELLER]: {
      campaigns: number;
      completionRate: number;
      averageBudget: number;
      totalEarnings: number;
      onTimeDeliveryRate: number;
    };
    [CampaignType.SALESMAN]: {
      campaigns: number;
      totalSales: number;
      averageSales: number;
      totalCommissions: number;
      conversionRate: number;
    };
  };

  // Trends and patterns
  trends: {
    monthlyEarnings: Array<{
      month: string;
      earnings: number;
      campaigns: number;
    }>;
    performanceScore: number; // Overall performance score (0-100)
    reliabilityScore: number; // Based on completion rates and deadlines
    qualityScore: number; // Based on ratings and feedback
  };

  periodStart: Date;
  periodEnd: Date;
}

export interface AdvertiserAnalytics {
  advertiserId: string;
  advertiserName: string;

  // Campaign creation and management
  campaigns: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    successRate: number;
    averageBudget: number;
    totalSpent: number;
  };

  // Performance metrics
  performance: {
    averageCampaignDuration: number;
    averageTimeToFindPromoter: number; // For consultant/seller campaigns
    promoterRetentionRate: number; // How often promoters work with this advertiser again
    averagePromoterRating: number; // How promoters rate this advertiser
    disputeRate: number; // Percentage of campaigns with disputes
  };

  // ROI and effectiveness
  effectiveness: {
    totalViews?: number; // For visibility campaigns
    totalSales?: number; // For salesman campaigns
    averageROI: number;
    costEfficiency: number; // Cost per result achieved
    brandReach?: number; // Estimated reach across all campaigns
  };

  // Spending patterns
  spending: {
    monthlySpend: Array<{
      month: string;
      amount: number;
      campaigns: number;
    }>;
    spendByType: {
      [CampaignType.VISIBILITY]: number;
      [CampaignType.CONSULTANT]: number;
      [CampaignType.SELLER]: number;
      [CampaignType.SALESMAN]: number;
    };
    averageMonthlySpend: number;
    spendingTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };

  periodStart: Date;
  periodEnd: Date;
}

export interface PlatformMetrics {
  // User metrics
  users: {
    totalUsers: number;
    activeUsers: number;
    newSignups: number;
    churnRate: number;
    promoterToAdvertiserRatio: number;
  };

  // Campaign metrics
  campaigns: {
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    successRate: number;
    averageCampaignValue: number;
    campaignsByType: {
      [CampaignType.VISIBILITY]: number;
      [CampaignType.CONSULTANT]: number;
      [CampaignType.SELLER]: number;
      [CampaignType.SALESMAN]: number;
    };
  };

  // Financial metrics
  financial: {
    grossMarketplaceVolume: number;
    totalRevenue: number;
    averageTransactionValue: number;
    totalPayouts: number;
    pendingPayouts: number;
    revenueGrowthRate: number;
  };

  // Engagement metrics
  engagement: {
    averageSessionDuration: number;
    averageCampaignsPerUser: number;
    repeatUsageRate: number;
    messagesSent: number;
    averageResponseTime: number;
  };

  // Quality metrics
  quality: {
    averageUserRating: number;
    disputeRate: number;
    refundRate: number;
    customerSatisfactionScore: number;
    platformTrustScore: number;
  };

  period: {
    start: Date;
    end: Date;
  };

  generatedAt: Date;
}
