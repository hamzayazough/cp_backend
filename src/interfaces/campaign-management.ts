import { CampaignType } from '../enums/campaign-type';

/**
 * Interface for campaign expiration notification data
 */
export interface CampaignExpirationNotification {
  campaignId: string;
  campaignTitle: string;
  campaignType: CampaignType;
  deadline: Date;
  advertiserEmail: string;
  advertiserName: string;
  daysUntilExpiry: number;
}

/**
 * Interface for email notification data
 */
export interface EmailNotificationData {
  to: string;
  subject: string;
  message: string;
  templateType: string;
  templateVariables: Record<string, string>;
}

/**
 * Interface for campaign completion result
 */
export interface CampaignCompletionResult {
  campaignId: string;
  completedAt: Date;
  affectedPromoterCampaigns: number;
  updatedPromoterDetails: number;
  updatedUserStats: number;
}

/**
 * Interface for promoter campaign statistics update
 */
export interface PromoterCampaignStatsUpdate {
  promoterId: string;
  campaignType: CampaignType;
  numberOfCampaignDone: number;
  userNumberOfCampaignDone: number;
}

/**
 * Interface for campaign expiration check result
 */
export interface CampaignExpirationCheckResult {
  totalCampaignsChecked: number;
  campaignsEndingInWeek: number;
  campaignsEndingInDay: number;
  campaignsCompletedToday: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Interface for campaigns grouped by expiration timeframe
 */
export interface CampaignsExpirationGroups {
  endingInWeek: CampaignExpirationNotification[];
  endingInDay: CampaignExpirationNotification[];
  endingToday: CampaignExpirationNotification[];
}

/**
 * Interface for user campaign statistics by type
 */
export interface UserCampaignStatistics {
  userId: string;
  numberOfVisibilityCampaignDone?: number;
  numberOfConsultantCampaignDone?: number;
  numberOfSellerCampaignDone?: number;
  numberOfSalesmanCampaignDone?: number;
}
