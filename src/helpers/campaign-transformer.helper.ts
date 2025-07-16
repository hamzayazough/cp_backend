import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { AdvertiserActiveCampaign } from '../interfaces/advertiser-dashboard';

export const transformCampaignData = async (
  campaign: CampaignEntity,
  promoterCampaigns: PromoterCampaign[],
): Promise<AdvertiserActiveCampaign> => {
  const totalViews = promoterCampaigns.reduce(
    (sum, pc) => sum + pc.viewsGenerated,
    0,
  );
  const totalSpent = promoterCampaigns.reduce(
    (sum, pc) => sum + Number(pc.earnings),
    0,
  );
  const applications = promoterCampaigns.length;
  return {
    id: campaign.id,
    title: campaign.title,
    type: campaign.type,
    status: campaign.status as
      | 'ONGOING'
      | 'AWAITING_PROMOTER'
      | 'COMPLETED'
      | 'PAUSED',
    views: totalViews,
    spent: totalSpent,
    applications,
    conversions: await getConversions(campaign.id),
    deadline: campaign.deadline
      ? new Date(campaign.deadline).toISOString()
      : '',
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
};

const getConversions = async (campaignId: string): Promise<number> => {
  // Logic to fetch conversions for the campaign
  // This function should interact with the transaction repository to count conversions
  return 0; // Placeholder return value
};
