import { SocialPlatform } from 'src/enums/social-platform';
import { AdvertiserType } from '../enums/advertiser-type';
import { Language } from '../enums/language';
import { FollowerEstimate } from './follower-estimate';
import { PromoterWork } from './promoter-work';
import { AdvertiserWork } from './advertiser-work';
export type UserRole = 'ADVERTISER' | 'PROMOTER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  isSetupDone: boolean;
  updatedAt: Date;

  avatarUrl?: string; // Profile picture (S3 URL)
  backgroundUrl?: string; // Background banner (S3 URL)
  bio?: string;
  rating?: number;

  // Social Media Links
  tiktokUrl?: string;
  instagramUrl?: string;
  snapchatUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string; // Personal or company website

  // Stripe / Financial
  stripeAccountId?: string;
  walletBalance: number;

  // Role-specific fields
  advertiserDetails?: AdvertiserDetails;
  promoterDetails?: PromoterDetails;
  usedCurrency?: 'USD' | 'CAD'; // Currency used by the user
  country: string; // User's country for localization
}

// Advertiser-specific data
export interface AdvertiserDetails {
  companyName: string;
  advertiserTypes: AdvertiserType[]; // e.g., ["CLOTHING", "EDUCATION"]
  companyWebsite: string;
  verified?: boolean;
  advertiserWork?: AdvertiserWork[]; // Example products or services offered
  discordChannelUrl?: string; // Discord channel ID for advertiser communication
}

// 📣 Promoter-specific data
export interface PromoterDetails {
  location: string;
  languagesSpoken: Language[];
  skills: string[];
  works?: PromoterWork[]; // List of past projects (mp4, images)
  followersEstimate?: FollowerEstimate[];
  verified?: boolean;
  isBusiness?: boolean;
  businessName?: string; // Optional business name if isBusiness is TRUE

  // Statistics
  totalSales?: number;
  numberOfCampaignDone?: number;
  numberOfVisibilityCampaignDone?: number;
  numberOfSellerCampaignDone?: number;
  numberOfSalesmanCampaignDone?: number;
  numberOfConsultantCampaignDone?: number;
  totalViewsGenerated?: number;
}

//--------------------DTOs----------------------------------
export interface CreateUserDto {
  firebaseUid: string;
  email: string;
  name: string;
  bio: string;
  role: UserRole | null;

  tiktokUrl: string;
  instagramUrl: string;
  snapchatUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  usedCurrency: 'USD' | 'CAD';
  advertiserDetails?: AdvertiserDetailsDto;

  promoterDetails?: PromoterDetailsDto;
  country: string; // User's country for localization
}

export interface AdvertiserDetailsDto {
  companyName: string;
  advertiserTypes: AdvertiserType[];
  companyWebsite: string;
}
export interface PromoterDetailsDto {
  location: string;
  languagesSpoken: Language[];
  skills: string[];
  followerEstimates?: FollowerEstimateDto[];
  works?: PromoterWorkDto[];
  isBusiness?: boolean;
  businessName?: string; // Optional business name if isBusiness is TRUE
}

export interface FollowerEstimateDto {
  platform: SocialPlatform;
  count: number;
}

export interface PromoterWorkDto {
  title: string;
  description?: string;
  mediaUrl: string;
}

export interface Promoter {
  id: string;
  email: string;
  name: string;
  createdAt: string;

  avatarUrl?: string; // Profile picture (S3 URL)
  backgroundUrl?: string; // Background banner (S3 URL)
  bio?: string;
  rating?: number;

  // Social Media Links
  tiktokUrl?: string;
  instagramUrl?: string;
  snapchatUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  works: PromoterWork[]; // List of past projects (mp4, images)
  location?: string;
  languagesSpoken?: Language[];
  followersEstimate?: FollowerEstimate[];
  skills?: string[];
  verified?: boolean;
  totalSales?: number;
  numberOfCampaignDone?: number;
  numberOfVisibilityCampaignDone?: number;
  numberOfSellerCampaignDone?: number;
  numberOfSalesmanCampaignDone?: number;
  numberOfConsultantCampaignDone?: number;
  totalViewsGenerated?: number;
  isBusiness: boolean;
  businessName?: string;
  country: string;
}
