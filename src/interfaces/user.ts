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
  walletBalance?: number;

  // Role-specific fields
  advertiserDetails?: AdvertiserDetails;
  promoterDetails?: PromoterDetails;
}

// Advertiser-specific data
export interface AdvertiserDetails {
  companyName: string;
  advertiserTypes: AdvertiserType[]; // e.g., ["CLOTHING", "EDUCATION"]
  companyWebsite: string;
  verified?: boolean;
  advertiserWork?: AdvertiserWork[]; // Example products or services offered
}

// 📣 Promoter-specific data
export interface PromoterDetails {
  location: string;
  languagesSpoken: Language[];
  skills: string[];
  works?: PromoterWork[]; // List of past projects (mp4, images)
  followersEstimate?: FollowerEstimate[];
  verified?: boolean;

  // Statistics
  totalSales?: number;
  numberOfCampaignDone?: number;
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

  advertiserDetails?: AdvertiserDetailsDto;

  promoterDetails?: PromoterDetailsDto;
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
