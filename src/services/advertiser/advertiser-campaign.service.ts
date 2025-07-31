import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from 'src/database/entities';
import { UserEntity } from 'src/database/entities';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  CampaignFilters,
  CampaignAdvertiser,
  AdvertiserCampaignDetailsUnion,
} from 'src/interfaces/advertiser-campaign';
import { AdvertiserActiveCampaign } from 'src/interfaces/advertiser-dashboard';
import { CampaignType } from 'src/enums/campaign-type';
import { CampaignStatus } from 'src/enums/campaign-status';
import { UserType } from 'src/enums/user-type';
import {
  ADVERTISER_CAMPAIGN_CONSTANTS,
  USER_CAMPAIGN_RELATIONS,
  CAMPAIGN_FILTERS,
  CAMPAIGN_TRANSFORMERS,
  CAMPAIGN_DETAIL_BUILDERS,
  CAMPAIGN_VALIDATORS,
  RESPONSE_BUILDERS,
  DATE_UTILITIES,
} from './advertiser-campaign-helper.constants';
import { TransactionType } from 'src/database/entities/transaction.entity';

@Injectable()
export class AdvertiserCampaignService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async getActiveCampaigns(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserActiveCampaign[]> {
    // Use UserEntity relations to get campaigns and related data
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: USER_CAMPAIGN_RELATIONS,
    });

    if (!advertiser?.campaigns) {
      return [];
    }

    const campaigns = advertiser.campaigns
      .filter((c) => c.status === CampaignStatus.ACTIVE)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    return campaigns.map((campaign) => {
      const promoterCampaigns = campaign.promoterCampaigns || [];
      const totalViews =
        CAMPAIGN_TRANSFORMERS.calculateTotalViews(promoterCampaigns);
      const totalSpent =
        CAMPAIGN_TRANSFORMERS.calculateTotalSpentFromTransactions(campaign);
      const applications = promoterCampaigns.length;
      //TODO: change this logic later
      const conversions = CAMPAIGN_TRANSFORMERS.calculateConversions(campaign);

      return {
        id: campaign.id,
        title: campaign.title,
        type: campaign.type,
        status: CAMPAIGN_TRANSFORMERS.mapCampaignStatus(
          campaign,
          promoterCampaigns,
        ),
        views: totalViews,
        spent: totalSpent,
        applications,
        conversions,
        deadline: campaign.deadline
          ? new Date(campaign.deadline).toISOString()
          : '',
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      };
    });
  }

  async getCampaignsList(
    advertiserId: string,
    request: AdvertiserCampaignListRequest,
  ): Promise<AdvertiserCampaignListResponse> {
    const page =
      request.page || ADVERTISER_CAMPAIGN_CONSTANTS.DEFAULT_PAGINATION.PAGE;
    const limit =
      request.limit || ADVERTISER_CAMPAIGN_CONSTANTS.DEFAULT_PAGINATION.LIMIT;

    // Load advertiser with all nested relations
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: USER_CAMPAIGN_RELATIONS,
    });

    if (!advertiser?.campaigns || !Array.isArray(advertiser.campaigns)) {
      return RESPONSE_BUILDERS.buildEmptyCampaignListResponse(page, limit);
    }

    // Apply filters using helper validators
    let campaigns = advertiser.campaigns;
    campaigns = CAMPAIGN_VALIDATORS.filterByStatus(campaigns, request.status);
    campaigns = CAMPAIGN_VALIDATORS.filterByType(campaigns, request.type);
    campaigns = CAMPAIGN_VALIDATORS.filterBySearch(
      campaigns,
      request.searchQuery,
    );

    const totalCount = campaigns.length;
    campaigns = CAMPAIGN_VALIDATORS.applyPagination(campaigns, page, limit);

    // Transform campaigns using helper transformers
    const transformedCampaigns = campaigns.map((campaign) => {
      return {
        id: campaign.id,
        title: campaign.title,
        type: campaign.type,
        mediaUrl: campaign.mediaUrl,
        status: CAMPAIGN_TRANSFORMERS.mapCampaignStatus(
          campaign,
          campaign.promoterCampaigns || [],
        ),
        description: campaign.description,

        campaign: this.buildCampaignDetails(campaign),
        performance: {
          totalViewsGained:
            campaign.type === CampaignType.VISIBILITY
              ? campaign.currentViews || 0
              : undefined,
          totalSalesMade:
            campaign.type === CampaignType.SALESMAN
              ? campaign.currentSales || 0
              : undefined,
        },
        tags: CAMPAIGN_TRANSFORMERS.extractAdvertiserTypes(campaign),
        applicants: CAMPAIGN_TRANSFORMERS.transformApplicants(campaign),
        chosenPromoters:
          CAMPAIGN_TRANSFORMERS.transformChosenPromoters(campaign),
      };
    });

    const summary = await this.calculateCampaignSummary(advertiserId);

    return {
      campaigns: transformedCampaigns,
      pagination: RESPONSE_BUILDERS.buildPaginationMeta(
        page,
        limit,
        totalCount,
      ),
      summary,
    };
  }

  async getCampaignById(
    advertiserId: string,
    campaignId: string,
  ): Promise<CampaignAdvertiser> {
    // Use UserEntity relations to get campaign and related data
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: USER_CAMPAIGN_RELATIONS,
    });

    if (!advertiser?.campaigns || !Array.isArray(advertiser.campaigns)) {
      throw new Error('Advertiser not found');
    }

    const campaign = advertiser.campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return {
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      mediaUrl: campaign.mediaUrl,
      status: CAMPAIGN_TRANSFORMERS.mapCampaignStatus(
        campaign,
        campaign.promoterCampaigns || [],
      ),
      description: campaign.description,

      campaign: this.buildCampaignDetails(campaign),
      performance: {
        totalViewsGained:
          campaign.type === CampaignType.VISIBILITY
            ? campaign.currentViews || 0
            : undefined,
        totalSalesMade:
          campaign.type === CampaignType.SALESMAN
            ? campaign.currentSales || 0
            : undefined,
      },
      tags: CAMPAIGN_TRANSFORMERS.extractAdvertiserTypes(campaign),
      applicants: CAMPAIGN_TRANSFORMERS.transformApplicants(campaign),
      chosenPromoters: CAMPAIGN_TRANSFORMERS.transformChosenPromoters(campaign),
    };
  }

  /**
   * Build campaign details using helper constants based on campaign type
   */
  private buildCampaignDetails(
    campaign: CampaignEntity,
  ): AdvertiserCampaignDetailsUnion {
    switch (campaign.type) {
      case CampaignType.VISIBILITY:
        return CAMPAIGN_DETAIL_BUILDERS.buildVisibilityCampaignDetails(
          campaign,
        );
      case CampaignType.CONSULTANT:
        return CAMPAIGN_DETAIL_BUILDERS.buildConsultantCampaignDetails(
          campaign,
        );
      case CampaignType.SELLER:
        return CAMPAIGN_DETAIL_BUILDERS.buildSellerCampaignDetails(campaign);
      case CampaignType.SALESMAN:
        return CAMPAIGN_DETAIL_BUILDERS.buildSalesmanCampaignDetails(campaign);
      default:
        return CAMPAIGN_DETAIL_BUILDERS.buildVisibilityCampaignDetails(
          campaign,
        );
    }
  }

  /**
   * Calculate campaign summary using entity relations and helper utilities
   */
  private async calculateCampaignSummary(advertiserId: string) {
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: [
        'campaigns',
        'campaigns.transactions',
        'campaigns.promoterCampaigns',
      ],
    });

    if (!advertiser?.campaigns || !Array.isArray(advertiser.campaigns)) {
      return {
        totalActiveCampaigns: 0,
        totalCompletedCampaigns: 0,
        totalSpentThisMonth: 0,
        totalAllocatedBudget: 0,
        totalRemainingBudget: 0,
      };
    }

    const campaigns = advertiser.campaigns;

    // Calculate summary metrics using campaigns
    const totalActiveCampaigns = campaigns.filter(
      (c) => c.status === CampaignStatus.ACTIVE,
    ).length;

    const totalCompletedCampaigns = campaigns.filter(
      (c) =>
        c.status === CampaignStatus.INACTIVE &&
        CAMPAIGN_TRANSFORMERS.hasCompletedPromoters(c),
    ).length;

    const totalAllocatedBudget = campaigns.reduce(
      (sum, c) => sum + (c.budgetAllocated || 0),
      0,
    );

    // Calculate total spent from transactions
    const totalSpent = campaigns.reduce((sum, campaign) => {
      return (
        sum +
        CAMPAIGN_TRANSFORMERS.calculateTotalSpentFromTransactions(campaign)
      );
    }, 0);

    // Calculate spent this month
    const startOfMonth = DATE_UTILITIES.getStartOfCurrentMonth();
    const endOfMonth = DATE_UTILITIES.getEndOfCurrentMonth();

    const totalSpentThisMonth = campaigns.reduce((sum, campaign) => {
      if (!campaign.transactions || !Array.isArray(campaign.transactions))
        return sum;

      return (
        sum +
        campaign.transactions
          .filter(
            (tx) =>
              tx.userType === UserType.ADVERTISER &&
              (
                ADVERTISER_CAMPAIGN_CONSTANTS.SPENDING_TRANSACTION_TYPES as readonly TransactionType[]
              ).includes(tx.type) &&
              tx.createdAt >= startOfMonth &&
              tx.createdAt <= endOfMonth,
          )
          .reduce((txSum, tx) => txSum + Math.abs(tx.amount), 0)
      );
    }, 0);

    const totalRemainingBudget = Math.max(0, totalAllocatedBudget - totalSpent);

    return {
      totalActiveCampaigns,
      totalCompletedCampaigns,
      totalSpentThisMonth,
      totalAllocatedBudget,
      totalRemainingBudget,
    };
  }

  getCampaignFilters(): CampaignFilters {
    return CAMPAIGN_FILTERS;
  }
}
