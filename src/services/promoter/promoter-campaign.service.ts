import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../../database/entities/promoter-campaign.entity';
import {
  PromoterActiveCampaign,
  PromoterSuggestedCampaign,
} from '../../interfaces/promoter-dashboard';
import { CampaignStatus, CampaignType } from '../../enums/campaign-type';
import { Advertiser } from '../../interfaces/explore-campaign';

@Injectable()
export class PromoterCampaignService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
  ) {}

  /**
   * Get promoter's active campaigns using UserEntity relations
   */
  async getPromoterActiveCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<PromoterCampaign[]> {
    const userWithCampaigns = await this.userRepository.findOne({
      where: { id: promoterId },
      relations: [
        'promoterCampaigns',
        'promoterCampaigns.campaign',
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
      ],
    });

    if (!userWithCampaigns) {
      return [];
    }

    const activeCampaigns = (userWithCampaigns.promoterCampaigns || [])
      .filter((pc) => pc.status === PromoterCampaignStatus.ONGOING)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    return activeCampaigns;
  }

  /**
   * Convert PromoterCampaign entities to PromoterActiveCampaign DTOs
   */
  convertToPromoterActiveCampaignDto(
    promoterCampaigns: PromoterCampaign[],
  ): PromoterActiveCampaign[] {
    return promoterCampaigns.map((pc) => {
      const baseCampaign = this.createBaseCampaignDto(pc.campaign);

      return {
        ...baseCampaign,
        status: pc.status, // Use PromoterCampaign status for active campaigns
        views: pc.viewsGenerated,
        earnings: pc.earnings,
        updatedAt: pc.updatedAt
          ? new Date(pc.updatedAt).toISOString()
          : new Date().toISOString(),
        meetingDone: false, // TODO: change logic later
      } as PromoterActiveCampaign;
    });
  }

  /**
   * Get suggested campaigns for a promoter using campaignRepository
   * This gets campaigns that the promoter hasn't joined yet
   */
  async getPromoterSuggestedCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<CampaignEntity[]> {
    const currentPromoter = await this.userRepository.findOne({
      where: { id: promoterId },
      relations: ['promoterCampaigns'],
    });

    const relatedCampaignIds =
      currentPromoter?.promoterCampaigns?.map((pc) => pc.campaignId) || [];

    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE });

    if (relatedCampaignIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...relatedCampaignIds)', {
        relatedCampaignIds,
      });
    }

    return await query
      .orderBy('campaign.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Convert CampaignEntity to PromoterSuggestedCampaign DTOs
   */
  convertToPromoterSuggestedCampaignDto(
    campaigns: CampaignEntity[],
  ): PromoterSuggestedCampaign[] {
    return campaigns.map((campaign) => {
      const baseCampaign = this.createBaseCampaignDto(campaign);

      return {
        ...baseCampaign,
        status: campaign.status, // Use Campaign status for suggested campaigns
        updatedAt: campaign.updatedAt
          ? new Date(campaign.updatedAt).toISOString()
          : new Date().toISOString(),
      } as PromoterSuggestedCampaign;
    });
  }

  /**
   * Common method to create base campaign DTO from CampaignEntity
   */
  private createBaseCampaignDto(campaign: CampaignEntity) {
    const advertiser: Advertiser = {
      id: campaign.advertiser.id,
      companyName:
        campaign.advertiser.advertiserDetails?.companyName || 'Unknown',
      profileUrl: campaign.advertiser.avatarUrl,
      rating: campaign.advertiser.rating || 0,
      verified: campaign.advertiser.advertiserDetails?.verified || false,
      description: campaign.advertiser.bio || '',
      website: campaign.advertiser.websiteUrl || '',
      advertiserTypes: campaign.advertiserTypes || [],
    };

    const baseCampaign = {
      id: campaign.id,
      title: campaign.title,
      mediaUrl: campaign.mediaUrl,
      type: campaign.type,
      advertiser,
      deadline: campaign.deadline
        ? new Date(campaign.deadline).toISOString()
        : new Date().toISOString(),
      createdAt: campaign.createdAt
        ? new Date(campaign.createdAt).toISOString()
        : new Date().toISOString(),
      isPublic: campaign.isPublic,
      requirements: campaign.requirements,
    };

    // Add type-specific fields
    switch (campaign.type) {
      case CampaignType.CONSULTANT:
      case CampaignType.SELLER:
        return {
          ...baseCampaign,
          minBudget: campaign.minBudget,
          maxBudget: campaign.maxBudget,
          meetingPlan: campaign.meetingPlan,
          meetingCount: campaign.meetingCount,
        };
      case CampaignType.VISIBILITY:
        return {
          ...baseCampaign,
          cpv: campaign.cpv,
          maxViews: campaign.maxViews,
        };
      case CampaignType.SALESMAN:
        return {
          ...baseCampaign,
          commissionPerSale: campaign.commissionPerSale,
        };
      default:
        return baseCampaign;
    }
  }
}
