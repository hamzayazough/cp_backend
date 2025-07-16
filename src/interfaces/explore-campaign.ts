import { CampaignType } from '../enums/campaign-type';
import { CampaignStatus } from '../enums/campaign-status';
import { AdvertiserType } from '../enums/advertiser-type';
import { SocialPlatform } from '../enums/social-platform';
import { Deliverable } from '../enums/deliverable';
import { MeetingPlan } from '../enums/meeting-plan';
import { SalesTrackingMethod } from '../enums/sales-tracking-method';
import { PromoterCampaignStatus } from './promoter-campaign';

export interface ExploreCampaignRequest {
  // Pagination
  page?: number;
  limit?: number;

  // Search
  searchTerm?: string;

  // Filtering
  typeFilter?: CampaignType[];
  advertiserTypes?: AdvertiserType[];

  // Sorting
  sortBy?: 'newest' | 'deadline' | 'budget' | 'applicants';
}

export interface Advertiser {
  id: string;
  companyName: string;
  profileUrl?: string;
  rating: number;
  verified: boolean;
  description: string;
  website: string;
  advertiserTypes: AdvertiserType[];
}

export interface BaseCampaignDetails {
  id: string;
  advertiser: Advertiser;
  title: string;
  type: CampaignType;
  mediaUrl?: string; // URL to the S3 campaign media (image/video)
  status: PromoterCampaignStatus; // PromoterCampaign.status
  description: string; // from Campaign
  targetAudience?: string;
  preferredPlatforms?: SocialPlatform[]; // Preferred platforms for the campaign
  requirements?: string[];
  createdAt: Date;
  deadline: string;
  startDate: string;
  isPublic: boolean;
  tags: AdvertiserType[]; //getting them from Advertiser user -> user.advertiserType
  campaignStatus?: CampaignStatus; // Optional campaign status that overrides default behavior
}

export interface ConsultantCampaign extends BaseCampaignDetails {
  type: CampaignType.CONSULTANT;
  meetingPlan: MeetingPlan;
  expectedDeliverables?: Deliverable[];
  expertiseRequired?: string; // a requirement
  meetingCount: number;
  maxBudget: number;
  minBudget: number;
}

export interface VisibilityCampaign extends BaseCampaignDetails {
  type: CampaignType.VISIBILITY;
  maxViews: number;
  currentViews: number;
  cpv: number;
  minFollowers?: number; // a requirement
}

export interface SellerCampaign extends BaseCampaignDetails {
  type: CampaignType.SELLER;
  sellerRequirements?: Deliverable[];
  deliverables?: Deliverable[];
  maxBudget: number;
  minBudget: number;
  minFollowers?: number; // a requirement
  needMeeting: boolean; // If true, the promoter needs to have a meeting with the advertiser before starting the campaign
  meetingPlan: MeetingPlan; // If needMeeting is true, this will contain the meeting plan details
  meetingCount: number;
}

export interface SalesmanCampaign extends BaseCampaignDetails {
  type: CampaignType.SALESMAN;
  commissionPerSale: number;
  trackSalesVia: SalesTrackingMethod;
  codePrefix?: string;
  refLink?: string;
  minFollowers?: number; // a requirement
}

export type CampaignUnion =
  | VisibilityCampaign
  | ConsultantCampaign
  | SellerCampaign
  | SalesmanCampaign;

export interface ExploreCampaignResponse {
  campaigns: CampaignUnion[];
  page: number;
  totalPages: number;
  totalCount: number;
  sortBy: string; // sorting criteria used
  searchTerm: string; // search term used for filtering
  typeFilter: CampaignType[]; // type filter used for filtering
  advertiserTypes: AdvertiserType[]; // Advertiser types used for filtering
}
