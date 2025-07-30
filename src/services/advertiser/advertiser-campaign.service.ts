import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from 'src/database/entities';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from 'src/database/entities/promoter-campaign.entity';
import { TransactionType } from 'src/database/entities/transaction.entity';
import { CampaignApplicationEntity } from 'src/database/entities/campaign-applications.entity';
import { UserEntity } from 'src/database/entities';
import { CampaignDeliverableEntity } from 'src/database/entities/campaign-deliverable.entity';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  CampaignFilters,
  CampaignAdvertiser,
} from 'src/interfaces/advertiser-campaign';
import {
  ADVERTISER_CAMPAIGN_STATUS,
  AdvertiserActiveCampaign,
} from 'src/interfaces/advertiser-dashboard';
import { CampaignDeliverable } from 'src/interfaces/promoter-campaigns';
import { CampaignType } from 'src/enums/campaign-type';
import { transformUserToPromoter } from 'src/helpers/user-transformer.helper';
import { TransactionStatus } from 'src/database/entities/transaction.entity';
import { CampaignStatus } from 'src/enums/campaign-status';
import { UserType } from 'src/enums/user-type';

@Injectable()
export class AdvertiserCampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
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
      relations: [
        'campaigns',
        'campaigns.promoterCampaigns',
        'campaigns.promoterCampaigns.promoter',
        'campaigns.promoterCampaigns.promoter.promoterDetails',
        'campaigns.campaignDeliverables',
        'campaigns.campaignApplications',
      ],
    });

    if (!advertiser) return [];

    const campaigns = (advertiser.campaigns || [])
      .filter((c) => c.status === CampaignStatus.ACTIVE)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    const campaignData = campaigns.map((campaign) => {
      const promoterCampaigns = campaign.promoterCampaigns || [];
      const totalViews = promoterCampaigns.reduce(
        (sum, pc) => sum + (pc.viewsGenerated || 0),
        0,
      );
      const totalSpent = promoterCampaigns.reduce(
        (sum, pc) => sum + Number(pc.earnings || 0),
        0,
      );
      const applications = promoterCampaigns.length;
      const conversions = (campaign.transactions || []).filter(
        // TODO: Adjust when sales tracking is implemented
        (tx) =>
          tx.type === TransactionType.SALESMAN_COMMISSION &&
          (tx.status === TransactionStatus.COMPLETED ||
            tx.status === TransactionStatus.PENDING),
      ).length;
      return {
        id: campaign.id,
        title: campaign.title,
        type: campaign.type,
        status: this.mapCampaignStatus(campaign, promoterCampaigns),
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
    return campaignData;
  }

  async getCampaignsList(
    advertiserId: string,
    request: AdvertiserCampaignListRequest,
  ): Promise<AdvertiserCampaignListResponse> {
    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;
    // Load advertiser with all nested relations
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: [
        'campaigns',
        'campaigns.advertiser',
        'campaigns.advertiser.advertiserDetails',
        'campaigns.advertiser.advertiserDetails.advertiserTypeMappings',
        'campaigns.campaignDeliverables',
        'campaigns.campaignDeliverables.promoterWork',
        'campaigns.campaignDeliverables.promoterWork.comments',
        'campaigns.campaignApplications',
        'campaigns.promoterCampaigns',
        'campaigns.promoterCampaigns.promoter',
        'campaigns.promoterCampaigns.promoter.promoterDetails',
      ],
    });

    if (!advertiser) {
      return {
        campaigns: [],
        pagination: {
          page,
          limit,
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false,
        },
        summary: {
          totalActiveCampaigns: 0,
          totalCompletedCampaigns: 0,
          totalSpentThisMonth: 0,
          totalAllocatedBudget: 0,
          totalRemainingBudget: 0,
        },
      };
    }

    let campaigns = advertiser.campaigns || [];
    // Filter by status
    if (Array.isArray(request.status) && request.status.length > 0) {
      campaigns = campaigns.filter((c) => request.status?.includes(c.status));
    }
    // Filter by type
    if (Array.isArray(request.type) && request.type.length > 0) {
      campaigns = campaigns.filter((c) => request.type?.includes(c.type));
    }
    // Filter by search query
    if (request.searchQuery) {
      const search = request.searchQuery.toLowerCase();
      campaigns = campaigns.filter(
        (c) =>
          c.title.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search),
      );
    }
    const totalCount = campaigns.length;
    const totalPages = Math.ceil(totalCount / limit);
    campaigns = campaigns.slice(skip, skip + limit);

    // Transform CampaignEntity to CampaignAdvertiser with applicants and chosen promoters
    const transformedCampaigns = campaigns.map((campaign) => {
      // Applicants from relation
      const applicants = (campaign.campaignApplications || []).map((app) => ({
        promoter: transformUserToPromoter(app.promoter),
        applicationStatus: app.status,
        applicationMessage: app.applicationMessage,
      }));
      // Chosen promoters from relation
      const chosenPromoters = (campaign.promoterCampaigns || []).filter((pc) =>
        ['ONGOING', 'COMPLETED'].includes(pc.status),
      );
      const chosenPromoterInfos = chosenPromoters.map((pc) => ({
        promoter: transformUserToPromoter(pc.promoter),
        status: pc.status,
        viewsGenerated: pc.viewsGenerated,
        joinedAt: pc.joinedAt,
        earnings: pc.earnings,
        budgetAllocated: pc.campaign.budgetAllocated,
      }));
      return {
        id: campaign.id,
        title: campaign.title,
        type: campaign.type,
        mediaUrl: campaign.mediaUrl,
        status: campaign.status,
        description: campaign.description,
        campaign: this.mapCampaignDetails(campaign) as CampaignAdvertiser,
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
        tags:
          campaign.advertiser?.advertiserDetails?.advertiserTypeMappings?.map(
            (mapping) => mapping.advertiserType,
          ) || [],
        applicants,
        chosenPromoters: chosenPromoterInfos,
      };
    });
    const summary = await this.calculateCampaignSummary(advertiserId);

    return {
      campaigns: transformedCampaigns,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      summary,
    };
  }

  async getCampaignById(
    advertiserId: string,
    campaignId: string,
  ): Promise<CampaignAdvertiser> {
    const campaign = await this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect(
        'advertiserDetails.advertiserTypeMappings',
        'advertiserTypeMappings',
      )
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('deliverables.promoterWork', 'work')
      .leftJoinAndSelect('work.comments', 'comments')
      .where('campaign.id = :campaignId', { campaignId })
      .andWhere('campaign.advertiserId = :advertiserId', { advertiserId })
      .getOne();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Fetch applicants from campaign_applications table
    const applicants = await this.campaignApplicationRepository
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.promoter', 'promoter')
      .leftJoinAndSelect('promoter.promoterDetails', 'promoterDetails')
      .leftJoinAndSelect(
        'promoterDetails.promoterLanguages',
        'promoterLanguages',
      )
      .leftJoinAndSelect('promoterDetails.promoterSkills', 'promoterSkills')
      .leftJoinAndSelect('promoterDetails.promoterWorks', 'promoterWorks')
      .leftJoinAndSelect(
        'promoterDetails.followerEstimates',
        'followerEstimates',
      )
      .where('app.campaignId = :campaignId', { campaignId: campaign.id })
      .getMany();

    // Fetch chosen promoters from promoter_campaigns table
    const chosenPromoters = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.promoter', 'promoter')
      .leftJoinAndSelect('promoter.promoterDetails', 'promoterDetails')
      .leftJoinAndSelect(
        'promoterDetails.promoterLanguages',
        'promoterLanguages',
      )
      .leftJoinAndSelect('promoterDetails.promoterSkills', 'promoterSkills')
      .leftJoinAndSelect('promoterDetails.promoterWorks', 'promoterWorks')
      .leftJoinAndSelect(
        'promoterDetails.followerEstimates',
        'followerEstimates',
      )
      .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
      .andWhere('pc.status IN (:...statuses)', {
        statuses: ['ONGOING', 'COMPLETED'],
      })
      .getMany();

    // Transform applicants
    const applicantInfos = applicants.map((app) => ({
      promoter: transformUserToPromoter(app.promoter),
      applicationStatus: app.status,
      applicationMessage: app.applicationMessage,
    }));

    // Transform chosen promoters
    const chosenPromoterInfos = chosenPromoters.map((pc) => ({
      promoter: transformUserToPromoter(pc.promoter),
      status: pc.status,
      viewsGenerated: pc.viewsGenerated,
      joinedAt: pc.joinedAt,
      earnings: pc.earnings,
      budgetAllocated: pc.campaign.budgetAllocated,
    }));

    return {
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      mediaUrl: campaign.mediaUrl,
      status: campaign.status,
      description: campaign.description,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      campaign: this.mapCampaignDetails(campaign),
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
      tags:
        campaign.advertiser?.advertiserDetails?.advertiserTypeMappings?.map(
          (mapping) => mapping.advertiserType,
        ) || [],
      applicants: applicantInfos,
      chosenPromoters: chosenPromoterInfos,
    };
  }

  private mapCampaignStatus(
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
  ): ADVERTISER_CAMPAIGN_STATUS {
    if (
      campaign.campaignApplications &&
      campaign.campaignApplications.length > 0
    ) {
      if (
        campaign.status === CampaignStatus.INACTIVE ||
        promoterCampaigns.some(
          (pc) => pc.status === PromoterCampaignStatus.COMPLETED,
        )
      ) {
        return ADVERTISER_CAMPAIGN_STATUS.COMPLETED;
      }
    }
    if (
      promoterCampaigns.some(
        (pc) =>
          pc.status === PromoterCampaignStatus.ONGOING ||
          pc.status === PromoterCampaignStatus.AWAITING_REVIEW,
      )
    ) {
      return ADVERTISER_CAMPAIGN_STATUS.COMPLETED;
    }
    if (
      promoterCampaigns.some(
        (pc) =>
          pc.status === PromoterCampaignStatus.ONGOING ||
          pc.status === PromoterCampaignStatus.AWAITING_REVIEW,
      )
    ) {
      return ADVERTISER_CAMPAIGN_STATUS.ONGOING;
    }
    if (
      campaign.campaignApplications &&
      campaign.campaignApplications.length > 0 &&
      promoterCampaigns.length === 0
    ) {
      return ADVERTISER_CAMPAIGN_STATUS.REVIEWING_APPLICATIONS;
    }
    return ADVERTISER_CAMPAIGN_STATUS.PENDING_PROMOTER;
  }
  private mapCampaignDetails(campaign: CampaignEntity): any {
    const baseDetails = {
      budgetHeld: campaign.budgetAllocated || 0,
      spentBudget:
        (campaign.transactions || [])
          .filter(
            (tx) =>
              tx.userType === UserType.ADVERTISER &&
              [
                TransactionType.VIEW_EARNING,
                TransactionType.SALESMAN_COMMISSION,
                TransactionType.MONTHLY_PAYOUT,
                TransactionType.DIRECT_PAYMENT,
              ].includes(tx.type),
          )
          .reduce((total, tx) => total + tx.amount, 0) || 0,
      targetAudience: campaign.targetAudience,
      preferredPlatforms: campaign.preferredPlatforms,
      requirements: campaign.requirements,
      createdAt: campaign.createdAt,
      deadline: campaign.deadline
        ? new Date(campaign.deadline).toISOString()
        : '',
      startDate: campaign.startDate
        ? new Date(campaign.startDate).toISOString()
        : '',
      isPublic: campaign.isPublic || false,
      discordInviteLink: campaign.discordInviteLink || '',
      type: campaign.type,
      budgetAllocated: campaign.budgetAllocated || 0,
    };

    switch (campaign.type) {
      case CampaignType.VISIBILITY:
        return {
          ...baseDetails,
          maxViews: campaign.maxViews || 0,
          currentViews: campaign.currentViews || 0,
          cpv: campaign.cpv || 0,
          minFollowers: campaign.minFollowers,
          trackingLink: campaign.trackingLink || '',
        };
      case CampaignType.CONSULTANT:
        return {
          ...baseDetails,
          meetingPlan: campaign.meetingPlan,
          expectedDeliverables: this.transformCampaignDeliverables(
            campaign.expectedDeliverables,
          ),
          expertiseRequired: campaign.expertiseRequired,
          meetingCount: campaign.meetingCount || 0,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
        };
      case CampaignType.SELLER:
        return {
          ...baseDetails,
          sellerRequirements: campaign.sellerRequirements,
          deliverables: this.transformCampaignDeliverables(
            campaign.deliverables,
          ),
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
          minFollowers: campaign.minFollowers,
          needMeeting: campaign.needMeeting || false,
          meetingPlan: campaign.meetingPlan,
          meetingCount: campaign.meetingCount || 0,
        };
      case CampaignType.SALESMAN:
        return {
          ...baseDetails,
          commissionPerSale: campaign.commissionPerSale || 0,
          trackSalesVia: campaign.trackSalesVia,
          codePrefix: campaign.codePrefix,
          minFollowers: campaign.minFollowers,
        };
      default:
        return baseDetails;
    }
  }

  private transformCampaignDeliverables(
    deliverableEntities: CampaignDeliverableEntity[] | undefined,
  ): CampaignDeliverable[] {
    if (!deliverableEntities || deliverableEntities.length === 0) {
      return [];
    }

    return deliverableEntities.map((entity) => ({
      id: entity.id,
      campaignId: entity.campaignId,
      deliverable: entity.deliverable,
      isSubmitted: entity.isSubmitted,
      isFinished: entity.isFinished,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      promoterWork:
        entity.promoterWork?.map((work) => ({
          id: work.id,
          campaignId: entity.campaignId, // Get campaign ID from the parent deliverable
          promoterLink: work.promoterLink,
          description: work.description,
          createdAt: work.createdAt,
          updatedAt: work.updatedAt,
          comments:
            work.comments?.map((comment) => ({
              id: comment.id,
              workId: comment.workId,
              commentMessage: comment.commentMessage,
              commentatorId: comment.commentatorId,
              commentatorName: comment.commentatorName,
              createdAt: comment.createdAt,
            })) || [],
        })) || [],
    }));
  }

  private async calculateCampaignSummary(advertiserId: string) {
    // Calculate total active campaigns
    const totalActiveCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: CampaignStatus.ACTIVE })
      .getCount();

    // Calculate total completed campaigns
    const totalCompletedCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', {
        status: CampaignStatus.INACTIVE,
      })
      .getCount(); // Calculate total allocated budget across all campaigns
    const budgetResult: { totalAllocated: string } | undefined =
      await this.campaignRepository
        .createQueryBuilder('campaign')
        .select('SUM(campaign.budgetAllocated)', 'totalAllocated')
        .where('campaign.advertiserId = :advertiserId', { advertiserId })
        .getRawOne();

    const totalAllocatedBudget = budgetResult
      ? Number(budgetResult.totalAllocated) || 0
      : 0;

    // Calculate total spent this month from promoter campaigns
    const currentMonth = new Date();
    const startOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    );
    const spentResult: { totalSpent: string } | undefined =
      await this.promoterCampaignRepository
        .createQueryBuilder('pc')
        .leftJoin('pc.campaign', 'campaign')
        .select('SUM(pc.spentBudget)', 'totalSpent')
        .where('campaign.advertiserId = :advertiserId', { advertiserId })
        .andWhere('pc.updatedAt >= :startOfMonth', { startOfMonth })
        .andWhere('pc.updatedAt <= :endOfMonth', { endOfMonth })
        .getRawOne();

    const totalSpentThisMonth = spentResult
      ? Number(spentResult.totalSpent) || 0
      : 0; // Calculate total remaining budget (allocated - spent across all campaigns)
    const totalSpentResult: { totalSpent: string } | undefined =
      await this.promoterCampaignRepository
        .createQueryBuilder('pc')
        .leftJoin('pc.campaign', 'campaign')
        .select('SUM(pc.spentBudget)', 'totalSpent')
        .where('campaign.advertiserId = :advertiserId', { advertiserId })
        .getRawOne();

    const totalSpent = totalSpentResult
      ? Number(totalSpentResult.totalSpent) || 0
      : 0;
    const totalRemainingBudget = totalAllocatedBudget - totalSpent;

    return {
      totalActiveCampaigns,
      totalCompletedCampaigns,
      totalSpentThisMonth,
      totalAllocatedBudget,
      totalRemainingBudget: Math.max(0, totalRemainingBudget), // Ensure non-negative
    };
  }

  getCampaignFilters(): CampaignFilters {
    return {
      statuses: Object.values(CampaignStatus),
      types: Object.values(CampaignType),
    };
  }
}
