import { CampaignType } from '../enums/campaign-type';
import { CampaignStatus } from '../enums/campaign-status';
import { MeetingPlan } from '../enums/meeting-plan';
import { SalesTrackingMethod } from '../enums/sales-tracking-method';
import { Deliverable } from '../enums/deliverable';
import { SocialPlatform } from '../enums/social-platform';
import { AdvertiserType } from 'src/enums/advertiser-type';
// Base Campaign interface - now abstract, not used directly
export interface BaseCampaign {
  title: string;
  description: string;
  advertiserTypes?: AdvertiserType[];
  isPublic: boolean;
  mediaUrl?: string;

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
  expectedDeliverables: Deliverable[];
  meetingCount?: number;
  maxBudget: number;
  minBudget: number;
  isPublic: false;
  promoterLinks?: string[];
}

export interface SellerCampaign extends BaseCampaign {
  type: CampaignType.SELLER;
  sellerRequirements?: Deliverable[];
  deliverables?: Deliverable[];
  meetingPlan?: MeetingPlan;
  maxBudget: number;
  minBudget: number;
  isPublic: false;
  minFollowers?: number;
  promoterLinks?: string[];

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
}

export type Campaign =
  | VisibilityCampaign
  | ConsultantCampaign
  | SellerCampaign
  | SalesmanCampaign;
