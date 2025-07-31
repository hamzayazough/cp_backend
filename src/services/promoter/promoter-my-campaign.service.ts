import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../../database/entities/promoter-campaign.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../../database/entities/campaign-applications.entity';
import {
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
  CampaignPromoter,
  CampaignDetailsUnion,
  Earnings,
} from '../../interfaces/promoter-campaigns';
import { CampaignType } from '../../enums/campaign-type';
import { UserType } from '../../enums/user-type';
import { Advertiser } from '../../interfaces/explore-campaign';

@Injectable()
export class PromoterMyCampaignService {
  constructor() {}

  /**
   * Get promoter's campaigns with filtering, sorting, and pagination
   * Uses entity relations instead of repositories
   */
  getPromoterCampaigns(
    promoter: UserEntity,
    request: GetPromoterCampaignsRequest,
  ): PromoterCampaignsListResponse {
    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;

    // Get joined and applied campaigns from relations
    const joinedCampaigns = this.getJoinedCampaigns(promoter, request);
    const appliedCampaigns = this.getAppliedCampaigns(promoter, request);

    // Combine and sort results
    const allCampaigns = this.combineAndSortCampaigns(
      joinedCampaigns,
      appliedCampaigns,
      request.sortBy || 'newest',
      request.sortOrder || 'desc',
    );

    // Apply pagination
    const totalCount = allCampaigns.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedCampaigns = allCampaigns.slice(skip, skip + limit);

    // Transform campaigns to the required format
    const transformedCampaigns: CampaignPromoter[] = paginatedCampaigns.map(
      (item) => {
        if (item.source === 'joined') {
          return this.transformPromoterCampaignToInterface(
            item.data,
            promoter.id,
          );
        } else {
          return this.transformCampaignApplicationToInterface(
            item.data,
            promoter.id,
          );
        }
      },
    );

    // Calculate summary
    const summary = this.calculateCampaignsSummary(promoter);

    return {
      campaigns: transformedCampaigns,
      page,
      totalPages,
      totalCount,
      summary,
    };
  }

  /**
   * Get joined campaigns from promoter relations
   */
  private getJoinedCampaigns(
    promoter: UserEntity,
    request: GetPromoterCampaignsRequest,
  ): PromoterCampaign[] {
    let campaigns = promoter.promoterCampaigns || [];

    // Apply status filter
    if (request.status && request.status.length > 0) {
      campaigns = campaigns.filter((pc) => request.status!.includes(pc.status));
    }

    // Apply campaign type filter
    if (request.type && request.type.length > 0) {
      campaigns = campaigns.filter((pc) =>
        request.type!.includes(pc.campaign.type),
      );
    }

    // Apply search filter
    if (request.searchTerm) {
      const searchTerm = request.searchTerm.toLowerCase();
      campaigns = campaigns.filter(
        (pc) =>
          pc.campaign.title.toLowerCase().includes(searchTerm) ||
          pc.campaign.description?.toLowerCase().includes(searchTerm),
      );
    }

    return campaigns;
  }

  /**
   * Get applied campaigns from promoter relations
   */
  private getAppliedCampaigns(
    promoter: UserEntity,
    request: GetPromoterCampaignsRequest,
  ): CampaignApplicationEntity[] {
    let applications = promoter.campaignApplications || [];
    // When no status filter is applied, exclude ACCEPTED applications to avoid duplicates
    applications = applications.filter(
      (ca) => ca.status !== ApplicationStatus.ACCEPTED,
    );

    // Apply campaign type filter
    if (request.type && request.type.length > 0) {
      applications = applications.filter((ca) =>
        request.type!.includes(ca.campaign.type),
      );
    }

    // Apply search filter
    if (request.searchTerm) {
      const searchTerm = request.searchTerm.toLowerCase();
      applications = applications.filter(
        (ca) =>
          ca.campaign.title.toLowerCase().includes(searchTerm) ||
          ca.campaign.description?.toLowerCase().includes(searchTerm),
      );
    }

    return applications;
  }

  /**
   * Combine and sort campaigns from different sources
   */
  private combineAndSortCampaigns(
    joinedCampaigns: PromoterCampaign[],
    appliedCampaigns: CampaignApplicationEntity[],
    sortBy: string,
    sortOrder: string,
  ): CombinedCampaign[] {
    type CombinedCampaign =
      | {
          source: 'joined';
          data: PromoterCampaign;
          sortDate: Date;
        }
      | {
          source: 'applied';
          data: CampaignApplicationEntity & { campaign: CampaignEntity };
          sortDate: Date;
        };

    const allCampaigns: CombinedCampaign[] = [
      ...joinedCampaigns.map((pc) => ({
        source: 'joined' as const,
        data: pc,
        sortDate: pc.joinedAt,
      })),
      ...appliedCampaigns.map((ca) => ({
        source: 'applied' as const,
        data: ca as CampaignApplicationEntity & { campaign: CampaignEntity },
        sortDate: ca.appliedAt,
      })),
    ];

    // Apply sorting
    allCampaigns.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'newest':
          aValue = a.sortDate;
          bValue = b.sortDate;
          break;
        case 'deadline':
          aValue = a.data.campaign.deadline;
          bValue = b.data.campaign.deadline;
          break;
        case 'earnings':
          aValue = a.source === 'joined' ? a.data.earnings : 0;
          bValue = b.source === 'joined' ? b.data.earnings : 0;
          break;
        case 'title':
          aValue = a.data.campaign.title;
          bValue = b.data.campaign.title;
          break;
        default:
          aValue = a.sortDate;
          bValue = b.sortDate;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return allCampaigns;
  }

  /**
   * Transform PromoterCampaign to CampaignPromoter interface
   */
  private transformPromoterCampaignToInterface(
    pc: PromoterCampaign,
    promoterId: string,
  ): CampaignPromoter {
    const advertiser: Advertiser = {
      id: pc.campaign.advertiser.id,
      companyName:
        pc.campaign.advertiser.advertiserDetails?.companyName ||
        'Unknown Company',
      profileUrl: pc.campaign.advertiser.avatarUrl,
      rating: pc.campaign.advertiser.rating || 0,
      verified: pc.campaign.advertiser.advertiserDetails?.verified || false,
      description: pc.campaign.advertiser.bio || '',
      website: pc.campaign.advertiser.websiteUrl || '',
      advertiserTypes:
        pc.campaign.advertiser.advertiserDetails?.advertiserTypeMappings?.map(
          (mapping) => mapping.advertiserType,
        ) || [],
    };

    const earnings: Earnings = {
      totalEarned: Number(pc.earnings),
      viewsGenerated: pc.viewsGenerated,
      projectedTotal: this.calculateProjectedEarnings(pc),
    };

    const campaignDetails = this.createCampaignDetails(
      pc.campaign,
      pc,
      promoterId,
    );

    return {
      id: pc.campaign.id,
      title: pc.campaign.title,
      type: pc.campaign.type,
      mediaUrl: pc.campaign.mediaUrl,
      status: pc.status,
      description: pc.campaign.description,
      advertiser,
      campaign: campaignDetails,
      earnings,
      tags: pc.campaign.advertiserTypes || [],
      meetingDone: false,
    };
  }

  /**
   * Transform CampaignApplication to CampaignPromoter interface
   */
  private transformCampaignApplicationToInterface(
    ca: CampaignApplicationEntity & { campaign: CampaignEntity },
    promoterId: string,
  ): CampaignPromoter {
    const advertiser: Advertiser = {
      id: ca.campaign.advertiser.id,
      companyName:
        ca.campaign.advertiser.advertiserDetails?.companyName ||
        ca.campaign.advertiser.name,
      profileUrl: ca.campaign.advertiser.avatarUrl,
      rating: ca.campaign.advertiser.rating || 0,
      verified: ca.campaign.advertiser.advertiserDetails?.verified || false,
      description: ca.campaign.advertiser.bio || '',
      website: ca.campaign.advertiser.websiteUrl || '',
      advertiserTypes: ca.campaign.advertiserTypes || [],
    };

    const earnings: Earnings = {
      totalEarned: 0,
      viewsGenerated: 0,
      projectedTotal: this.calculateProjectedEarningsFromCampaign(ca.campaign),
    };

    const campaignDetails = this.createCampaignDetails(
      ca.campaign,
      null,
      promoterId,
    );

    // Map application status to promoter campaign status
    const status = this.mapApplicationStatusToPromoterStatus(ca.status);

    return {
      id: ca.campaign.id,
      title: ca.campaign.title,
      type: ca.campaign.type,
      mediaUrl: ca.campaign.mediaUrl,
      status,
      description: ca.campaign.description,
      advertiser,
      campaign: campaignDetails,
      earnings,
      tags: ca.campaign.advertiserTypes || [],
      meetingDone: false,
    };
  }

  /**
   * Create campaign details based on campaign type
   */
  private createCampaignDetails(
    campaign: CampaignEntity,
    promoterCampaign: PromoterCampaign | null,
    promoterId: string,
  ): CampaignDetailsUnion {
    const baseCampaign = {
      budgetHeld: Number(campaign.budgetAllocated) || 0,
      spentBudget: this.calculateSpentBudget(campaign, promoterId),
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
      isPublic: campaign.isPublic,
      discordInviteLink: campaign.discordInviteLink || '',
    };

    switch (campaign.type) {
      case CampaignType.VISIBILITY:
        return {
          ...baseCampaign,
          type: CampaignType.VISIBILITY,
          maxViews: campaign.maxViews || 0,
          currentViews: promoterCampaign ? promoterCampaign.viewsGenerated : 0,
          cpv: campaign.cpv || 0,
          minFollowers: campaign.minFollowers,
          trackingLink: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/visit/${campaign.id}/${promoterId}`,
        };

      case CampaignType.CONSULTANT:
        return {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: campaign.meetingPlan!,
          expectedDeliverables:
            campaign.expectedDeliverables?.map((cd) => ({
              id: cd.id,
              campaignId: cd.campaignId,
              deliverable: cd.deliverable,
              isSubmitted: cd.isSubmitted,
              isFinished: cd.isFinished,
              createdAt: cd.createdAt,
              updatedAt: cd.updatedAt,
              promoterWork:
                cd.promoterWork?.map((work) => ({
                  id: work.id,
                  deliverableId: work.deliverableId,
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
            })) || [],
          expertiseRequired: campaign.expertiseRequired,
          meetingCount: campaign.meetingCount || 0,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
        };

      case CampaignType.SELLER:
        return {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: campaign.sellerRequirements,
          deliverables:
            campaign.deliverables?.map((cd) => ({
              id: cd.id,
              campaignId: cd.campaignId,
              deliverable: cd.deliverable,
              isSubmitted: cd.isSubmitted,
              isFinished: cd.isFinished,
              createdAt: cd.createdAt,
              updatedAt: cd.updatedAt,
              promoterWork:
                cd.promoterWork?.map((work) => ({
                  id: work.id,
                  deliverableId: work.deliverableId,
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
            })) || [],
          fixedPrice: undefined,
          maxBudget: campaign.maxBudget || 0,
          minBudget: campaign.minBudget || 0,
          minFollowers: campaign.minFollowers,
          needMeeting: campaign.needMeeting || false,
          meetingPlan: campaign.meetingPlan!,
          meetingCount: campaign.meetingCount || 0,
        };

      case CampaignType.SALESMAN:
        return {
          ...baseCampaign,
          type: CampaignType.SALESMAN,
          commissionPerSale: campaign.commissionPerSale || 0,
          trackSalesVia: campaign.trackSalesVia!,
          codePrefix: campaign.codePrefix,
          refLink: campaign.trackingLink,
          minFollowers: campaign.minFollowers,
        };

      default:
        throw new Error(`Unsupported campaign type: ${String(campaign.type)}`);
    }
  }

  /**
   * Calculate projected earnings for a PromoterCampaign
   */
  private calculateProjectedEarnings(pc: PromoterCampaign): number {
    if (
      pc.campaign.type === CampaignType.VISIBILITY &&
      pc.campaign.maxViews &&
      pc.campaign.cpv
    ) {
      const maxPossibleEarnings =
        (pc.campaign.maxViews / 100) * pc.campaign.cpv;
      return maxPossibleEarnings;
    }

    if (
      pc.campaign.type === CampaignType.CONSULTANT ||
      pc.campaign.type === CampaignType.SELLER
    ) {
      return pc.campaign.maxBudget || Number(pc.earnings);
    }

    return Number(pc.earnings);
  }

  /**
   * Calculate projected earnings from a campaign (for applications)
   */
  private calculateProjectedEarningsFromCampaign(
    campaign: CampaignEntity,
  ): number {
    if (
      campaign.type === CampaignType.VISIBILITY &&
      campaign.maxViews &&
      campaign.cpv
    ) {
      const maxPossibleEarnings = (campaign.maxViews / 100) * campaign.cpv;
      return maxPossibleEarnings;
    }

    if (
      campaign.type === CampaignType.CONSULTANT ||
      campaign.type === CampaignType.SELLER
    ) {
      return campaign.maxBudget || 0;
    }

    return 0;
  }

  /**
   * Map application status to promoter campaign status
   */
  private mapApplicationStatusToPromoterStatus(
    status: ApplicationStatus,
  ): PromoterCampaignStatus {
    switch (status) {
      case ApplicationStatus.PENDING:
        return PromoterCampaignStatus.AWAITING_REVIEW;
      case ApplicationStatus.ACCEPTED:
        return PromoterCampaignStatus.AWAITING_REVIEW;
      default:
        return PromoterCampaignStatus.AWAITING_REVIEW;
    }
  }

  /**
   * Calculate campaigns summary including both joined and applied campaigns
   * Uses entity relations instead of repositories
   */
  private calculateCampaignsSummary(promoter: UserEntity) {
    const joinedCampaigns =
      (promoter.promoterCampaigns as PromoterCampaign[]) || [];
    const appliedCampaigns =
      (promoter.campaignApplications as CampaignApplicationEntity[]) || [];

    // Count joined campaigns by status
    const totalActive = joinedCampaigns.filter(
      (pc) => pc.status === PromoterCampaignStatus.ONGOING,
    ).length;

    const totalCompleted = joinedCampaigns.filter(
      (pc) => pc.status === PromoterCampaignStatus.COMPLETED,
    ).length;

    // Count pending campaigns (both joined awaiting review and pending applications)
    const promoterPending = joinedCampaigns.filter(
      (pc) => pc.status === PromoterCampaignStatus.AWAITING_REVIEW,
    ).length;

    const applicationPending = appliedCampaigns.filter(
      (ca) => ca.status === ApplicationStatus.PENDING,
    ).length;

    const totalPending = promoterPending + applicationPending;

    // Calculate earnings and views from joined campaigns only
    const totalEarnings = joinedCampaigns.reduce(
      (sum, pc) => sum + (pc.earnings || 0),
      0,
    );

    const totalViews = joinedCampaigns.reduce(
      (sum, pc) => sum + (pc.viewsGenerated || 0),
      0,
    );

    return {
      totalActive,
      totalPending,
      totalCompleted,
      totalEarnings,
      totalViews,
    };
  }

  /**
   * Get a specific campaign by ID for a promoter
   * Uses entity relations instead of repositories
   */
  getPromoterCampaignById(
    promoter: UserEntity,
    campaignId: string,
  ): CampaignPromoter {
    // First, try to find in joined campaigns
    const joinedCampaign = (promoter.promoterCampaigns || []).find(
      (pc) => pc.campaign.id === campaignId,
    );

    if (joinedCampaign) {
      return this.transformPromoterCampaignToInterface(
        joinedCampaign,
        promoter.id,
      );
    }

    // If not found in joined campaigns, try to find in applications
    const appliedCampaign = (promoter.campaignApplications || []).find(
      (ca) => ca.campaign.id === campaignId,
    );

    if (appliedCampaign) {
      return this.transformCampaignApplicationToInterface(
        appliedCampaign as CampaignApplicationEntity & {
          campaign: CampaignEntity;
        },
        promoter.id,
      );
    }

    throw new Error('Campaign not found for this promoter');
  }

  /**
   * Calculate spent budget by summing transaction amounts for a specific promoter and campaign
   */
  private calculateSpentBudget(
    campaign: CampaignEntity,
    promoterId: string,
  ): number {
    if (!campaign.transactions) {
      return 0;
    }

    return campaign.transactions
      .filter(
        (transaction) =>
          transaction.userId === promoterId &&
          transaction.userType === UserType.PROMOTER,
      )
      .reduce((total, transaction) => total + Number(transaction.amount), 0);
  }
}

// Type definition for combined campaigns
type CombinedCampaign =
  | {
      source: 'joined';
      data: PromoterCampaign;
      sortDate: Date;
    }
  | {
      source: 'applied';
      data: CampaignApplicationEntity & { campaign: CampaignEntity };
      sortDate: Date;
    };
