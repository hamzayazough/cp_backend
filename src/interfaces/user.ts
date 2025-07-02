import { AdvertiserType } from "../enums/advertiser-type";
import { Language } from "../enums/language";
import { FollowerEstimate } from "./follower-estimate";
import { PromoterWork } from "./promoter-work";

export type UserRole = "ADVERTISER" | "PROMOTER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  companyWebsite?: string;
  verified?: boolean;
}

// 📣 Promoter-specific data
export interface PromoterDetails {
  works: PromoterWork[]; // List of past projects (mp4, images)
  location?: string;
  languagesSpoken?: Language[];
  followersEstimate?: FollowerEstimate[];
  skills?: string[];
  verified?: boolean;
}
