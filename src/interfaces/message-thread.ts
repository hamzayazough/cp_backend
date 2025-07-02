export interface MessageThread {
  id: string;
  campaignId: string; // Optional: if linked to a campaign
  advertiserId: string;
  promoterId: string;
  createdAt: string;
  lastMessageAt: string;
  isArchivedByAdvertiser?: boolean;
  isArchivedByPromoter?: boolean;
}
