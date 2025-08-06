import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PromoterDashboardRequest,
  PromoterDashboardData,
} from 'src/interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
  CampaignUnion,
} from 'src/interfaces/explore-campaign';
import {
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
  CampaignPromoter,
  CampaignWork,
} from 'src/interfaces/promoter-campaigns';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from 'src/interfaces/campaign-actions';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from 'src/database/entities/campaign.entity';
import { PromoterCampaign } from 'src/database/entities/promoter-campaign.entity';
import { CampaignApplicationEntity } from 'src/database/entities/campaign-applications.entity';
import { UserType } from 'src/enums/user-type';
import { UniqueViewEntity } from 'src/database/entities';
import { DASHBOARD_DATA_CONFIG, getLimitValue } from './promoter-helper.const';
import { PromoterDashboardService } from './promoter-dashboard.service';
import { PromoterCampaignService } from './promoter-campaign.service';
import { PromoterMyCampaignService } from './promoter-my-campaign.service';
import { PromoterCampaignInteractionService } from './promoter-campaign-interaction.service';

@Injectable()
export class PromoterService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepository: Repository<UniqueViewEntity>,
    private readonly promoterDashboardService: PromoterDashboardService,
    private readonly promoterCampaignService: PromoterCampaignService,
    private readonly promoterMyCampaignService: PromoterMyCampaignService,
    private readonly promoterCampaignInteractionService: PromoterCampaignInteractionService,
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: PromoterDashboardRequest,
  ): Promise<PromoterDashboardData> {
    const data: PromoterDashboardData = {};

    // Load user with all required relations once
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
      relations: [
        'transactions',
        'transactions.campaign',
        'promoterCampaigns',
        'promoterCampaigns.campaign',
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
        'uniqueViews',
        'wallet',
      ],
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    for (const config of DASHBOARD_DATA_CONFIG) {
      if (request[config.property]) {
        switch (config.method) {
          case 'getPromoterStats': {
            data[config.dataKey] =
              this.promoterDashboardService.getPromoterStatsSummary(promoter);
            break;
          }
          case 'getActiveCampaigns': {
            const limit = getLimitValue(
              request,
              config.limitProperty,
              config.defaultLimit,
            );
            data[config.dataKey] =
              this.promoterDashboardService.getActiveCampaigns(promoter, limit);
            break;
          }
          case 'getSuggestedCampaigns': {
            const limit = getLimitValue(
              request,
              config.limitProperty,
              config.defaultLimit,
            );
            data[config.dataKey] =
              await this.promoterDashboardService.getSuggestedCampaigns(
                promoter,
                limit,
              );
            break;
          }
          case 'getRecentTransactions': {
            const limit = getLimitValue(
              request,
              config.limitProperty,
              config.defaultLimit,
            );
            data[config.dataKey] =
              this.promoterDashboardService.getRecentTransactions(
                promoter,
                limit,
              );
            break;
          }
          case 'getRecentMessages': {
            const limit = getLimitValue(
              request,
              config.limitProperty,
              config.defaultLimit,
            );
            data[config.dataKey] =
              await this.promoterDashboardService.getRecentMessages(
                promoter,
                limit,
              );
            break;
          }
          case 'getWalletInfo': {
            data[config.dataKey] =
              await this.promoterDashboardService.getWalletInfo(promoter);
            break;
          }
        }
      }
    }

    return data;
  }

  async getExploreCampaigns(
    firebaseUid: string,
    request: ExploreCampaignRequest,
  ): Promise<ExploreCampaignResponse> {
    // Load promoter with necessary relations for explore campaigns
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
      relations: ['promoterCampaigns'],
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    return this.promoterCampaignService.getExploreCampaigns(promoter, request);
  }

  async getCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignUnion> {
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }
    const campaign =
      await this.promoterCampaignService.getCampaignByIdWithRelations(
        campaignId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.promoterCampaignService.transformCampaignToUnion(
      campaign,
      promoter.id,
      promoter.usedCurrency || 'USD',
    );
  }

  async getPromoterCampaigns(
    firebaseUid: string,
    request: GetPromoterCampaignsRequest,
  ): Promise<PromoterCampaignsListResponse> {
    // Find promoter by Firebase UID with necessary relations
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
      relations: [
        'promoterCampaigns',
        'promoterCampaigns.campaign',
        'promoterCampaigns.campaign.media',
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
        'promoterCampaigns.campaign.campaignDeliverables',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork.comments',
        'campaignApplications',
        'campaignApplications.campaign',
        'campaignApplications.campaign.media',
        'campaignApplications.campaign.advertiser',
        'campaignApplications.campaign.advertiser.advertiserDetails',
        'campaignApplications.campaign.campaignDeliverables',
        'campaignApplications.campaign.campaignDeliverables.promoterWork',
        'campaignApplications.campaign.campaignDeliverables.promoterWork.comments',
      ],
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Delegate to the specialized service (no longer async)
    return this.promoterMyCampaignService.getPromoterCampaigns(
      promoter,
      request,
    );
  }

  async sendCampaignApplication(
    firebaseUid: string,
    request: SendApplicationRequest,
  ): Promise<SendApplicationResponse> {
    return this.promoterCampaignInteractionService.sendCampaignApplication(
      firebaseUid,
      request,
    );
  }

  async acceptContract(
    firebaseUid: string,
    request: AcceptContractRequest,
  ): Promise<AcceptContractResponse> {
    return this.promoterCampaignInteractionService.acceptContract(
      firebaseUid,
      request,
    );
  }

  /**
   * Add a new work item to a specific deliverable
   */
  async addCampaignWorkToDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    promoterLink: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    return this.promoterCampaignInteractionService.addCampaignWorkToDeliverable(
      firebaseUid,
      campaignId,
      deliverableId,
      promoterLink,
      description,
    );
  }

  /**
   * Update an existing work item in a specific deliverable
   */
  async updateCampaignWorkInDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    promoterLink: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    return this.promoterCampaignInteractionService.updateCampaignWorkInDeliverable(
      firebaseUid,
      campaignId,
      deliverableId,
      workId,
      promoterLink,
      description,
    );
  }

  /**
   * Delete a work item from a specific deliverable
   */
  async deleteCampaignWorkFromDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    return this.promoterCampaignInteractionService.deleteCampaignWorkFromDeliverable(
      firebaseUid,
      campaignId,
      deliverableId,
      workId,
    );
  }

  /**
   * Add a comment to a work item in a specific deliverable
   */
  async addCommentToWork(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    return this.promoterCampaignInteractionService.addCommentToWork(
      firebaseUid,
      campaignId,
      deliverableId,
      workId,
      commentMessage,
    );
  }

  /**
   * Add a comment to a work item in a specific deliverable (for advertisers)
   */
  async addCommentToWorkAsAdvertiser(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    return this.promoterCampaignInteractionService.addCommentToWorkAsAdvertiser(
      firebaseUid,
      campaignId,
      deliverableId,
      workId,
      commentMessage,
    );
  }

  /**
   * Mark a campaign deliverable as finished (for advertisers)
   */
  async markDeliverableAsFinished(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    return this.promoterCampaignInteractionService.markDeliverableAsFinished(
      firebaseUid,
      campaignId,
      deliverableId,
    );
  }

  async getPromoterCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignPromoter> {
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
      relations: [
        'promoterCampaigns',
        'promoterCampaigns.campaign',
        'promoterCampaigns.campaign.media',
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
        'promoterCampaigns.campaign.campaignDeliverables',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork.comments',
        'campaignApplications',
        'campaignApplications.campaign',
        'campaignApplications.campaign.media',
        'campaignApplications.campaign.advertiser',
        'campaignApplications.campaign.advertiser.advertiserDetails',
        'campaignApplications.campaign.campaignDeliverables',
        'campaignApplications.campaign.campaignDeliverables.promoterWork',
        'campaignApplications.campaign.campaignDeliverables.promoterWork.comments',
      ],
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    try {
      return this.promoterMyCampaignService.getPromoterCampaignById(
        promoter,
        campaignId,
      );
    } catch {
      throw new NotFoundException('Campaign not found for this promoter');
    }
  }
}
