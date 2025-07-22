import { UserEntity } from '../database/entities/user.entity';
import { Promoter } from '../interfaces/user';

export function transformUserToPromoter(user: UserEntity): Promoter {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    backgroundUrl: user.backgroundUrl,
    bio: user.bio,
    rating: user.rating,
    tiktokUrl: user.tiktokUrl,
    instagramUrl: user.instagramUrl,
    snapchatUrl: user.snapchatUrl,
    youtubeUrl: user.youtubeUrl,
    twitterUrl: user.twitterUrl,
    websiteUrl: user.websiteUrl,
    works: [], // Would need to fetch from promoter works
    location: user.promoterDetails?.location,
    languagesSpoken: [], // Would need to fetch from promoter languages
    followersEstimate: [], // Would need to fetch from follower estimates
    skills: [], // Would need to fetch from promoter skills
    verified: user.promoterDetails?.verified,
    totalSales: user.promoterDetails?.totalSales,
    numberOfCampaignDone: user.promoterDetails?.numberOfCampaignDone,
    numberOfVisibilityCampaignDone: user.numberOfVisibilityCampaignDone,
    numberOfSellerCampaignDone: user.numberOfSellerCampaignDone,
    numberOfSalesmanCampaignDone: user.numberOfSalesmanCampaignDone,
    numberOfConsultantCampaignDone: user.numberOfConsultantCampaignDone,
    totalViewsGenerated: user.promoterDetails?.totalViewsGenerated,
  };
}
