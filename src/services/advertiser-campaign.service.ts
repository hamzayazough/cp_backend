import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { CampaignApplicationEntity } from 'src/database/entities/campaign-applications.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignDeliverableEntity } from '../database/entities/campaign-deliverable.entity';
import { CampaignWorkEntity } from '../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../database/entities/campaign-work-comment.entity';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  CampaignFilters,
} from '../interfaces/advertiser-campaign';
import { AdvertiserActiveCampaign } from '../interfaces/advertiser-dashboard';
import { CampaignDeliverable } from '../interfaces/promoter-campaigns';
import { CampaignStatus, CampaignType } from '../enums/campaign-type';
import { transformUserToPromoter } from '../helpers/user-transformer.helper';

@Injectable()
export class AdvertiserCampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignDeliverableEntity)
    private deliverableRepository: Repository<CampaignDeliverableEntity>,
    @InjectRepository(CampaignWorkEntity)
    private workRepository: Repository<CampaignWorkEntity>,
    @InjectRepository(CampaignWorkCommentEntity)
    private commentRepository: Repository<CampaignWorkCommentEntity>,
  ) {}

  async getActiveCampaigns(
    advertiserId: string,
    limit: number,
  ): Promise<AdvertiserActiveCampaign[]> {
    const campaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status IN (:...statuses)', {
        statuses: [
          CampaignStatus.ACTIVE,
          CampaignStatus.PAUSED,
          CampaignStatus.ENDED,
        ],
      })
      .orderBy('campaign.updatedAt', 'DESC')
      .limit(limit)
      .getMany();

    const campaignData = await Promise.all(
      campaigns.map(async (campaign) => {
        const promoterCampaigns = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
          .getMany();

        const totalViews = promoterCampaigns.reduce(
          (sum, pc) => sum + pc.viewsGenerated,
          0,
        );
        const totalSpent = promoterCampaigns.reduce(
          (sum, pc) => sum + Number(pc.earnings),
          0,
        );
        const applications = promoterCampaigns.length;

        const conversions = await this.transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.campaignId = :campaignId', {
            campaignId: campaign.id,
          })
          .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
          .andWhere('transaction.status = :status', { status: 'COMPLETED' })
          .getCount();
        return {
          id: campaign.id,
          title: campaign.title,
          type: campaign.type,
          status: this.mapCampaignStatus(campaign.status),
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
      }),
    );
    return campaignData;
  }

  async getCampaignsList(
    advertiserId: string,
    request: AdvertiserCampaignListRequest,
  ): Promise<AdvertiserCampaignListResponse> {
    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;
    let query = this.campaignRepository
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
      .where('campaign.advertiserId = :advertiserId', { advertiserId });

    if (request.status && request.status.length > 0) {
      query = query.andWhere('campaign.status IN (:...statuses)', {
        statuses: request.status,
      });
    }

    if (request.type && request.type.length > 0) {
      query = query.andWhere('campaign.type IN (:...types)', {
        types: request.type,
      });
    }

    if (request.searchQuery) {
      query = query.andWhere(
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)',
        { search: `%${request.searchQuery}%` },
      );
    }
    const totalCount = await query.getCount();
    const totalPages = Math.ceil(totalCount / limit);
    const campaigns = await query.skip(skip).take(limit).getMany();

    // Transform CampaignEntity to CampaignAdvertiser with applicants and chosen promoters
    const transformedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        // Fetch applicants from campaign_applications table
        const applicants = await this.campaignApplicationRepository
          .createQueryBuilder('app')
          .leftJoinAndSelect('app.promoter', 'promoter')
          .leftJoinAndSelect('promoter.promoterDetails', 'promoterDetails')
          .where('app.campaignId = :campaignId', { campaignId: campaign.id })
          .getMany();

        // Fetch chosen promoters from promoter_campaigns table
        const chosenPromoters = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .leftJoinAndSelect('pc.promoter', 'promoter')
          .leftJoinAndSelect('promoter.promoterDetails', 'promoterDetails')
          .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
          .andWhere('pc.status IN (:...statuses)', {
            statuses: ['ONGOING', 'COMPLETED'],
          })
          .getMany(); // Transform applicants
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
          budgetAllocated: pc.budgetHeld,
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
      }),
    ); // Calculate summary statistics
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

  private mapCampaignStatus(
    status: CampaignStatus,
  ): 'ONGOING' | 'AWAITING_PROMOTER' | 'COMPLETED' | 'PAUSED' {
    switch (status) {
      case CampaignStatus.ACTIVE:
        return 'ONGOING';
      case CampaignStatus.PAUSED:
        return 'PAUSED';
      case CampaignStatus.ENDED:
        return 'COMPLETED';
      default:
        return 'AWAITING_PROMOTER';
    }
  }
  private mapCampaignDetails(campaign: CampaignEntity): any {
    const baseDetails = {
      budgetHeld: 0, // TODO: This should come from budget allocation
      spentBudget: 0, // TODO: This should come from transactions
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
      .andWhere('campaign.status = :status', { status: CampaignStatus.ENDED })
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
