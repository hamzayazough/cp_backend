import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../../database/entities/promoter-campaign.entity';
import { CampaignApplicationEntity } from '../../database/entities/campaign-applications.entity';
import {
  PromoterActiveCampaign,
  PromoterSuggestedCampaign,
} from '../../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
  CampaignUnion,
  Advertiser,
  BaseCampaignDetails,
  VisibilityCampaign,
  ConsultantCampaign,
  SellerCampaign,
  SalesmanCampaign,
} from '../../interfaces/explore-campaign';
import { CampaignStatus, CampaignType } from '../../enums/campaign-type';
import { getCachedFxRate } from '../../helpers/currency.helper';
import { AmountAfterApplicationFee } from 'src/constants/application-fees';

@Injectable()
export class PromoterCampaignService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
  ) {}

  /**
   * Convert amount from campaign currency to promoter currency
   * @param amount Amount in campaign currency
   * @param campaignCurrency Campaign's currency (USD or CAD)
   * @param promoterCurrency Promoter's currency (USD or CAD)
   * @returns Amount converted to promoter's currency
   */
  private convertCurrencyAmount(
    amount: number,
    campaignCurrency: string,
    promoterCurrency: 'USD' | 'CAD',
  ): number {
    // Ensure amount is a valid number
    const safeAmount = Number(amount) || 0;
    if (!isFinite(safeAmount)) {
      return 0;
    }

    if (campaignCurrency === promoterCurrency) {
      return Number(safeAmount.toFixed(2));
    }

    const fxRate = getCachedFxRate(
      campaignCurrency as 'USD' | 'CAD',
      promoterCurrency,
    );
    return Number(
      AmountAfterApplicationFee(
        Number((safeAmount * fxRate).toFixed(2)),
      ).toFixed(2),
    );
  }

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
    userCurrency: 'USD' | 'CAD',
    promoterCampaigns: PromoterCampaign[],
  ): PromoterActiveCampaign[] {
    return promoterCampaigns.map((pc) => {
      const baseCampaign = this.createBaseCampaignDto(
        userCurrency,
        pc.campaign,
      );

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
      .leftJoinAndSelect('campaign.media', 'media')
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
    promoterCurrency: 'USD' | 'CAD',
    campaigns: CampaignEntity[],
  ): PromoterSuggestedCampaign[] {
    return campaigns.map((campaign) => {
      const baseCampaign = this.createBaseCampaignDto(
        promoterCurrency,
        campaign,
      );

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
  private createBaseCampaignDto(
    promoterCurrency: 'USD' | 'CAD',
    campaign: CampaignEntity,
  ) {
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
      mediaUrls:
        campaign.media?.map((m) => ({
          id: m.id,
          campaignId: m.campaignId,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType as 'image' | 'video' | 'document' | undefined,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          displayOrder: m.displayOrder,
          isPrimary: m.isPrimary,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })) || [],
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
      case CampaignType.SELLER: {
        // Convert budget amounts from campaign currency to promoter currency
        const campaignCurrency = campaign.currency || 'USD';
        const minBudgetConverted = this.convertCurrencyAmount(
          campaign.minBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );
        const maxBudgetConverted = this.convertCurrencyAmount(
          campaign.maxBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          minBudget: minBudgetConverted,
          maxBudget: maxBudgetConverted,
          meetingPlan: campaign.meetingPlan,
          meetingCount: campaign.meetingCount,
        };
      }
      case CampaignType.VISIBILITY: {
        // Convert CPV from campaign currency to promoter currency
        const visibilityCampaignCurrency = campaign.currency || 'USD';
        const cpvConverted = this.convertCurrencyAmount(
          campaign.cpv || 0,
          visibilityCampaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          cpv: cpvConverted,
          maxViews: campaign.maxViews,
        };
      }
      case CampaignType.SALESMAN: {
        return {
          ...baseCampaign,
          commissionPerSale: campaign.commissionPerSale || 0,
        };
      }
      default:
        return baseCampaign;
    }
  }

  /**
   * Get explore campaigns for a promoter with all necessary filtering and sorting
   */
  async getExploreCampaigns(
    promoter: UserEntity,
    request: ExploreCampaignRequest,
  ): Promise<ExploreCampaignResponse> {
    const page = request.page || 1;
    const limit = request.limit || 10;
    const skip = (page - 1) * limit;
    const searchTerm = request.searchTerm || '';
    const sortBy = request.sortBy || 'newest';

    // Get excluded campaign IDs from promoter relations
    const excludedCampaignIds = await this.getExcludedCampaignIds(promoter);

    // Get additional private campaigns taken by others
    const takenPrivateIds = await this.getTakenPrivateCampaignIds(promoter.id);

    // Combine all exclusions
    const allExcludedCampaignIds = [
      ...new Set([...excludedCampaignIds, ...takenPrivateIds]),
    ];

    // Build and execute query
    const query = this.buildExploreCampaignsQuery(
      request,
      allExcludedCampaignIds,
      sortBy,
    );

    const totalCount = await query.getCount();
    const totalPages = Math.ceil(totalCount / limit);
    const campaigns = await query.skip(skip).take(limit).getMany();

    // Transform campaigns to the required format
    const transformedCampaigns: CampaignUnion[] = campaigns.map((campaign) =>
      this.transformCampaignToUnion(
        campaign,
        promoter.id,
        promoter.usedCurrency || 'USD',
      ),
    );

    return {
      campaigns: transformedCampaigns,
      page,
      totalPages,
      totalCount,
      sortBy,
      searchTerm,
      typeFilter: request.typeFilter || [],
      advertiserTypes: request.advertiserTypes || [],
    };
  }

  /**
   * Get campaign IDs that should be excluded from explore results
   */
  private async getExcludedCampaignIds(
    promoter: UserEntity,
  ): Promise<string[]> {
    const joinedIds = (promoter.promoterCampaigns || []).map(
      (pc) => pc.campaignId,
    );

    // Get applied campaign IDs separately since it's not a direct relation on UserEntity
    const appliedCampaignIds = await this.campaignApplicationRepository
      .createQueryBuilder('ca')
      .select('ca.campaignId', 'campaignId')
      .where('ca.promoterId = :promoterId', { promoterId: promoter.id })
      .getRawMany();

    const appliedIds = appliedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );

    return [...new Set([...joinedIds, ...appliedIds])];
  }

  /**
   * Get private campaigns that are already taken by other promoters
   */
  private async getTakenPrivateCampaignIds(
    promoterId: string,
  ): Promise<string[]> {
    const takenPrivateCampaignIds = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .innerJoin('pc.campaign', 'campaign')
      .select('pc.campaignId', 'campaignId')
      .where('campaign.isPublic = :isPublic', { isPublic: false })
      .andWhere('pc.promoterId != :promoterId', { promoterId })
      .getRawMany();

    return takenPrivateCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );
  }

  /**
   * Build the explore campaigns query with all filters and sorting
   */
  private buildExploreCampaignsQuery(
    request: ExploreCampaignRequest,
    excludedCampaignIds: string[],
    sortBy: string,
  ): SelectQueryBuilder<CampaignEntity> {
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.media', 'media')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('campaign.promoterCampaigns', 'promoterCampaigns')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE });

    // Exclude campaigns
    if (excludedCampaignIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...excludedCampaignIds)', {
        excludedCampaignIds,
      });
    }

    // Apply search filter
    if (request.searchTerm) {
      query = query.andWhere(
        '(campaign.title ILIKE :search OR campaign.description ILIKE :search)',
        { search: `%${request.searchTerm}%` },
      );
    }

    // Apply type filter
    if (request.typeFilter && request.typeFilter.length > 0) {
      query = query.andWhere('campaign.type IN (:...types)', {
        types: request.typeFilter,
      });
    }

    // Apply advertiser type filter
    if (request.advertiserTypes && request.advertiserTypes.length > 0) {
      query = query.andWhere('campaign.advertiserTypes && :advertiserTypes', {
        advertiserTypes: request.advertiserTypes,
      });
    }

    // Apply sorting
    return this.applySortingToQuery(query, sortBy);
  }

  /**
   * Apply sorting to the explore campaigns query
   */
  private applySortingToQuery(
    query: SelectQueryBuilder<CampaignEntity>,
    sortBy: string,
  ): SelectQueryBuilder<CampaignEntity> {
    switch (sortBy) {
      case 'newest':
        return query.orderBy('campaign.createdAt', 'DESC');
      case 'deadline':
        return query.orderBy('campaign.deadline', 'ASC');
      case 'budget':
        return query.orderBy('campaign.budgetAllocated', 'DESC');
      case 'applicants':
        // TODO: This would require a subquery to count applications
        return query.orderBy('campaign.createdAt', 'DESC');
      default:
        return query.orderBy('campaign.createdAt', 'DESC');
    }
  }

  /**
   * Transform campaign entity to union type for explore results
   */
  transformCampaignToUnion(
    campaign: CampaignEntity,
    promoterId: string,
    promoterCurrency: 'USD' | 'CAD' = 'USD',
  ): CampaignUnion {
    const advertiser: Advertiser = {
      id: campaign.advertiser.id,
      companyName:
        campaign.advertiser.advertiserDetails?.companyName || 'Unknown Company',
      profileUrl: campaign.advertiser.avatarUrl,
      rating: campaign.advertiser.rating || 0,
      verified: campaign.advertiser.advertiserDetails?.verified || false,
      description: campaign.advertiser.bio || '',
      website: campaign.advertiser.websiteUrl || '',
      advertiserTypes: campaign.advertiserTypes || [],
    };

    const baseCampaign: BaseCampaignDetails = {
      id: campaign.id,
      advertiser,
      title: campaign.title,
      type: campaign.type,
      mediaUrls:
        campaign.media?.map((m) => ({
          id: m.id,
          campaignId: m.campaignId,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType as 'image' | 'video' | 'document' | undefined,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          displayOrder: m.displayOrder,
          isPrimary: m.isPrimary,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })) || [],
      status:
        campaign.promoterCampaigns?.find((pm) => pm.promoterId === promoterId)
          ?.status || PromoterCampaignStatus.ONGOING,
      description: campaign.description,
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
      tags: campaign.advertiserTypes || [],
      campaignStatus: campaign.status,
    };

    switch (campaign.type) {
      case CampaignType.VISIBILITY: {
        // Convert CPV from campaign currency to promoter currency
        const campaignCurrency = campaign.currency || 'USD';
        const cpvConverted = this.convertCurrencyAmount(
          campaign.cpv || 0,
          campaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          type: CampaignType.VISIBILITY,
          maxViews: campaign.maxViews || 0,
          currentViews: campaign.currentViews || 0,
          cpv: cpvConverted,
          minFollowers: campaign.minFollowers,
        } as VisibilityCampaign;
      }

      case CampaignType.CONSULTANT: {
        // Convert budget amounts from campaign currency to promoter currency
        const campaignCurrency = campaign.currency || 'USD';
        const minBudgetConverted = this.convertCurrencyAmount(
          campaign.minBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );
        const maxBudgetConverted = this.convertCurrencyAmount(
          campaign.maxBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          type: CampaignType.CONSULTANT,
          meetingPlan: campaign.meetingPlan!,
          expectedDeliverables: campaign.expectedDeliverables.map(
            (cd) => cd.deliverable,
          ),
          expertiseRequired: campaign.expertiseRequired,
          meetingCount: campaign.meetingCount || 0,
          maxBudget: maxBudgetConverted,
          minBudget: minBudgetConverted,
        } as ConsultantCampaign;
      }

      case CampaignType.SELLER: {
        // Convert budget amounts from campaign currency to promoter currency
        const campaignCurrency = campaign.currency || 'USD';
        const minBudgetConverted = this.convertCurrencyAmount(
          campaign.minBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );
        const maxBudgetConverted = this.convertCurrencyAmount(
          campaign.maxBudget || 0,
          campaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          type: CampaignType.SELLER,
          sellerRequirements: campaign.sellerRequirements,
          deliverables: campaign.deliverables.map((cd) => cd.deliverable),
          maxBudget: maxBudgetConverted,
          minBudget: minBudgetConverted,
          minFollowers: campaign.minFollowers,
          needMeeting: campaign.needMeeting || false,
          meetingPlan: campaign.meetingPlan!,
          meetingCount: campaign.meetingCount || 0,
        } as SellerCampaign;
      }

      case CampaignType.SALESMAN: {
        // Convert commission from campaign currency to promoter currency
        const campaignCurrency = campaign.currency || 'USD';
        const commissionConverted = this.convertCurrencyAmount(
          campaign.commissionPerSale || 0,
          campaignCurrency,
          promoterCurrency,
        );

        return {
          ...baseCampaign,
          type: CampaignType.SALESMAN,
          commissionPerSale: commissionConverted,
          trackSalesVia: campaign.trackSalesVia!,
          codePrefix: campaign.codePrefix,
          refLink: campaign.trackingLink,
          minFollowers: campaign.minFollowers,
        } as SalesmanCampaign;
      }
      default: {
        // This should never happen
        const exhaustiveCheck: never = campaign.type;
        throw new Error(
          `Unsupported campaign type: ${String(exhaustiveCheck)}`,
        );
      }
    }
  }

  /**
   * Get a campaign by ID with all necessary relations for transformation
   */
  async getCampaignByIdWithRelations(
    campaignId: string,
  ): Promise<CampaignEntity | null> {
    return await this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.media', 'media')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('advertiser.advertiserDetails', 'advertiserDetails')
      .leftJoinAndSelect('campaign.campaignDeliverables', 'deliverables')
      .leftJoinAndSelect('campaign.promoterCampaigns', 'promoterCampaigns')
      .where('campaign.id = :campaignId', { campaignId })
      .getOne();
  }
}
