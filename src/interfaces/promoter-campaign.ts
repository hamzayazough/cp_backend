export enum PromoterCampaignStatus {
  ONGOING = 'ONGOING',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export interface PromoterCampaign {
  id: string;
  campaignId: string;
  promoterId: string;
  status: PromoterCampaignStatus;
  viewsGenerated: number;
  earnings: number;
  joinedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

// Related DTOs for API responses
export interface PromoterCampaignDetails extends PromoterCampaign {
  campaignTitle: string;
  campaignType: string;
  advertiserName: string;
  deadline?: Date;
  estimatedEarnings?: number;
}

export interface CampaignParticipation {
  id: string;
  title: string;
  type: string;
  status: PromoterCampaignStatus;
  progress: {
    viewsGenerated: number;
    targetViews?: number;
    earnings: number;
    estimatedTotal?: number;
  };
  timeline: {
    joinedAt: Date;
    deadline?: Date;
    completedAt?: Date;
  };
  advertiser: {
    name: string;
    verified: boolean;
  };
}

export interface JoinCampaignRequest {
  campaignId: string;
  promoterId: string;
  applicationMessage?: string; // For campaigns requiring application
}

export interface UpdateCampaignProgressRequest {
  promoterCampaignId: string;
  viewsGenerated?: number;
  deliverableLinks?: string[]; // For seller campaigns
  status?: PromoterCampaignStatus;
}
