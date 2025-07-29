export enum PromoterCampaignStatus {
  ONGOING = 'ONGOING',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  COMPLETED = 'COMPLETED',
  REFUSED = 'REFUSED',
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

  // Payment tracking fields
  budgetHeld: number; // Amount currently reserved/held from advertiser
  spentBudget: number; // Amount spent so far in the campaign
  finalPayoutAmount?: number; // Actual amount to pay to promoter (negotiated/agreed)
  payoutExecuted: boolean; // Indicates if transfer to promoter completed
  payoutDate?: Date; // When payout was executed
  stripeChargeId?: string; // Stripe charge ID for funds collection
  stripeTransferId?: string; // Stripe transfer ID for payout to promoter
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
