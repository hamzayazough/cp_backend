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
    works: user.promoterDetails?.promoterWorks || [],
    location: user.promoterDetails?.location,
    languagesSpoken:
      user.promoterDetails?.promoterLanguages?.map((l) => l.language) || [],
    followersEstimate: user.promoterDetails?.followerEstimates || [],
    skills: user.promoterDetails?.promoterSkills?.map((s) => s.skill) || [],
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
