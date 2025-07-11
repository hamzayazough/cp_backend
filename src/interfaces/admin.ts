import { CampaignType } from '../enums/campaign-type';

// Platform-wide analytics and admin interfaces
export interface PlatformAnalytics {
  overview: {
    totalUsers: number;
    totalAdvertisers: number;
    totalPromoters: number;
    activeCampaigns: number;
    completedCampaigns: number;
  };

  financial: {
    totalGMV: number; // Gross Merchandise Value
    totalRevenue: number; // Platform fees
    totalPayouts: number;
    pendingPayouts: number;
    averageCampaignBudget: number;
  };

  campaignMetrics: {
    [CampaignType.VISIBILITY]: {
      count: number;
      totalViews: number;
      averageCPV: number;
      totalSpent: number;
    };
    [CampaignType.CONSULTANT]: {
      count: number;
      averageBudget: number;
      completionRate: number;
      totalSpent: number;
    };
    [CampaignType.SELLER]: {
      count: number;
      averageBudget: number;
      completionRate: number;
      totalSpent: number;
    };
    [CampaignType.SALESMAN]: {
      count: number;
      totalSales: number;
      averageCommission: number;
      totalCommissionsPaid: number;
    };
  };

  userMetrics: {
    newSignups: {
      thisMonth: number;
      lastMonth: number;
      growth: number;
    };
    activeUsers: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    retentionRate: number;
  };

  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

// Admin management interfaces
export interface AdminUserManagement {
  userId: string;
  userType: 'ADVERTISER' | 'PROMOTER';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION';
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    paymentMethodVerified: boolean;
    stripeAccountVerified: boolean;
  };
  statistics: {
    totalCampaigns: number;
    totalSpent?: number; // For advertisers
    totalEarned?: number; // For promoters
    successRate: number;
    averageRating: number;
  };
  flags: {
    hasDisputes: boolean;
    hasPaymentIssues: boolean;
    requiresReview: boolean;
  };
  lastActivity: Date;
  joinedAt: Date;
}

// Dispute management
export interface Dispute {
  id: string;
  campaignId: string;
  reporterId: string; // User who reported
  reportedUserId: string; // User being reported
  type:
    | 'PAYMENT_ISSUE'
    | 'QUALITY_ISSUE'
    | 'COMMUNICATION_ISSUE'
    | 'FRAUD'
    | 'OTHER';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  evidence: string[]; // URLs to uploaded evidence
  adminNotes?: string;
  resolution?: string;
  assignedAdminId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

// System health monitoring
export interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  services: {
    database: 'UP' | 'DOWN' | 'SLOW';
    stripe: 'UP' | 'DOWN' | 'SLOW';
    s3: 'UP' | 'DOWN' | 'SLOW';
    email: 'UP' | 'DOWN' | 'SLOW';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    uptime: number;
  };
  alerts: Array<{
    type: 'ERROR' | 'WARNING' | 'INFO';
    message: string;
    timestamp: Date;
  }>;
  lastChecked: Date;
}

// Payment reconciliation for admin
export interface PaymentReconciliation {
  period: {
    start: Date;
    end: Date;
  };
  charges: {
    total: number;
    successful: number;
    failed: number;
    disputed: number;
    refunded: number;
    totalAmount: number;
  };
  payouts: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    totalAmount: number;
  };
  fees: {
    stripeFees: number;
    platformFees: number;
    netRevenue: number;
  };
  discrepancies: Array<{
    type: 'MISSING_CHARGE' | 'MISSING_PAYOUT' | 'AMOUNT_MISMATCH';
    description: string;
    amount: number;
    relatedTransactionId?: string;
  }>;
  generatedAt: Date;
}
