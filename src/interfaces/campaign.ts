import { CampaignType } from '../enums/campaign-type';
import { CampaignStatus } from '../enums/campaign-status';
import { MeetingPlan } from '../enums/meeting-plan';
import { SalesTrackingMethod } from '../enums/sales-tracking-method';
import { Deliverable } from '../enums/deliverable';
import { SocialPlatform } from '../enums/social-platform';
import { AdvertiserType } from 'src/enums/advertiser-type';
import { CampaignDeliverable } from './promoter-campaigns';
// Base Campaign interface - now abstract, not used directly
export interface BaseCampaign {
  title: string;
  description: string;
  advertiserTypes?: AdvertiserType[];
  isPublic: boolean;

  requirements?: string[];
  targetAudience?: string;
  preferredPlatforms?: SocialPlatform[];
  deadline: Date;
  startDate: Date;

  //set by server. All mandatory
  id?: string;
  status?: CampaignStatus;
  createdAt?: Date;
  updatedAt?: Date;
  advertiserId?: string;
  discordInviteLink?: string;
  discordThreadUrl?: string;
  budgetAllocated?: number; // Total budget allocated for the campaign
}

export interface VisibilityCampaign extends BaseCampaign {
  type: CampaignType.VISIBILITY;
  cpv: number;
  maxViews?: number;
  trackingLink: string;
  minFollowers?: number;
  currentViews?: number;
}

export interface ConsultantCampaign extends BaseCampaign {
  type: CampaignType.CONSULTANT;
  meetingPlan?: MeetingPlan;
  expertiseRequired?: string;
  expectedDeliverables: CampaignDeliverable[];
  meetingCount?: number;
  maxBudget: number;
  minBudget: number;
  isPublic: false;
}

export interface SellerCampaign extends BaseCampaign {
  type: CampaignType.SELLER;
  sellerRequirements?: Deliverable[];
  deliverables?: CampaignDeliverable[];
  meetingPlan?: MeetingPlan;
  maxBudget: number;
  minBudget: number;
  isPublic: false;
  minFollowers?: number;

  needMeeting?: boolean; // If true, the promoter needs to have a meeting with the advertiser before starting the campaign
  meetingCount?: number;
}

export interface SalesmanCampaign extends BaseCampaign {
  type: CampaignType.SALESMAN;
  commissionPerSale: number;
  trackSalesVia: SalesTrackingMethod;
  codePrefix?: string;
  isPublic: false;
  minFollowers?: number;
  currentSales?: number; // Number of sales made by the promoter so far
}

export type Campaign =
  | VisibilityCampaign
  | ConsultantCampaign
  | SellerCampaign
  | SalesmanCampaign;
