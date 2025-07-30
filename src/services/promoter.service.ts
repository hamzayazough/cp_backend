import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PromoterDashboardRequest,
  PromoterDashboardData,
} from '../interfaces/promoter-dashboard';
import {
  ExploreCampaignRequest,
  ExploreCampaignResponse,
  CampaignUnion,
} from '../interfaces/explore-campaign';
import {
  GetPromoterCampaignsRequest,
  PromoterCampaignsListResponse,
  CampaignPromoter,
  CampaignWork,
} from '../interfaces/promoter-campaigns';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from '../interfaces/campaign-actions';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../database/entities/promoter-campaign.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../database/entities/campaign-applications.entity';
import { CampaignStatus } from '../enums/campaign-type';
import { UserType } from 'src/enums/user-type';
import { CampaignWorkEntity } from 'src/database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from 'src/database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from 'src/database/entities/campaign-deliverable.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import {
  DASHBOARD_DATA_CONFIG,
  getLimitValue,
} from './promoter/promoter-helper.const';
import { PromoterDashboardService } from './promoter/promoter-dashboard.service';
import { PromoterCampaignService } from './promoter/promoter-campaign.service';
import { PromoterMyCampaignService } from './promoter/promoter-my-campaign.service';

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
    @InjectRepository(CampaignWorkEntity)
    private readonly workRepository: Repository<CampaignWorkEntity>,

    @InjectRepository(CampaignWorkCommentEntity)
    private readonly commentRepository: Repository<CampaignWorkCommentEntity>,

    @InjectRepository(CampaignDeliverableEntity)
    private readonly deliverableRepository: Repository<CampaignDeliverableEntity>,
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepository: Repository<UniqueViewEntity>,
    private readonly promoterDashboardService: PromoterDashboardService,
    private readonly promoterCampaignService: PromoterCampaignService,
    private readonly promoterMyCampaignService: PromoterMyCampaignService,
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
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
        'promoterCampaigns.campaign.campaignDeliverables',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork.comments',
        'campaignApplications',
        'campaignApplications.campaign',
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
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Check if campaign exists and is active
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId, status: CampaignStatus.ACTIVE },
      relations: ['advertiser'],
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found or not active');
    } // Check if promoter has already applied to this campaign
    const existingApplication =
      await this.campaignApplicationRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: request.campaignId,
        },
      });

    if (existingApplication) {
      throw new Error('You have already applied to this campaign');
    }

    // Create campaign application record with PENDING status
    const campaignApplication = this.campaignApplicationRepository.create({
      promoterId: promoter.id,
      campaignId: request.campaignId,
      applicationMessage: request.applicationMessage,
      status: ApplicationStatus.PENDING,
    });

    const savedApplication =
      await this.campaignApplicationRepository.save(campaignApplication);

    return {
      success: true,
      message: 'Application sent successfully',
      data: {
        applicationId: savedApplication.id,
        status: savedApplication.status,
      },
    };
  }

  async acceptContract(
    firebaseUid: string,
    request: AcceptContractRequest,
  ): Promise<AcceptContractResponse> {
    // Find promoter by Firebase UID
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.PROMOTER },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Check if campaign exists and is active
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId, status: CampaignStatus.ACTIVE },
      relations: ['advertiser'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or not active');
    }

    // Check if campaign is public (only public campaigns can be accepted directly)
    if (!campaign.isPublic) {
      throw new Error('This campaign is private and requires approval process');
    }

    // Check if promoter has already joined this campaign
    const existingContract = await this.promoterCampaignRepository.findOne({
      where: {
        promoterId: promoter.id,
        campaignId: request.campaignId,
      },
    });
    if (existingContract) {
      if (existingContract.status === PromoterCampaignStatus.ONGOING) {
        throw new Error('You have already joined this campaign');
      } else if (
        existingContract.status === PromoterCampaignStatus.AWAITING_REVIEW
      ) {
        throw new Error('Your application is pending review');
      } else if (existingContract.status === PromoterCampaignStatus.COMPLETED) {
        throw new Error('You have already completed this campaign');
      } else if (existingContract.status === PromoterCampaignStatus.REFUSED) {
        throw new Error('Your application was refused for this campaign');
      }
    }

    // Create promoter campaign record with ONGOING status for direct acceptance
    const promoterCampaign = this.promoterCampaignRepository.create({
      promoterId: promoter.id,
      campaignId: request.campaignId,
      status: PromoterCampaignStatus.ONGOING,
      viewsGenerated: 0,
      earnings: 0,
      budgetHeld: 0,
      spentBudget: 0,
      payoutExecuted: false,
    });
    const savedContract =
      await this.promoterCampaignRepository.save(promoterCampaign);

    return {
      success: true,
      message: 'Contract accepted successfully',
      data: {
        contractId: savedContract.id,
        campaignId: savedContract.campaignId,
        status: savedContract.status,
        acceptedAt: savedContract.joinedAt.toISOString(),
      },
    };
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
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found for this campaign',
        };
      }

      // Create the new work item
      const newWork = this.workRepository.create({
        deliverableId,
        promoterLink,
        description,
      });

      await this.workRepository.save(newWork);

      // Mark the deliverable as submitted since work has been added
      deliverable.isSubmitted = true;
      await this.deliverableRepository.save(deliverable);

      // Return all work items for this deliverable
      const allWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = allWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work added successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add work',
      };
    }
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
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the work item exists and belongs to the correct deliverable
      const existingWork = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
        relations: ['deliverable'],
      });

      if (!existingWork) {
        return {
          success: false,
          message: 'Work item not found',
        };
      }

      // Verify the deliverable belongs to this campaign
      if (existingWork.deliverable.campaignId !== campaignId) {
        return {
          success: false,
          message: 'Work item does not belong to this campaign',
        };
      }

      // Update the work item
      existingWork.promoterLink = promoterLink;
      if (description !== undefined) {
        existingWork.description = description;
      }

      await this.workRepository.save(existingWork);

      // Return all work items for this deliverable
      const allWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = allWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work updated successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update work',
      };
    }
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
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the work item exists and belongs to the correct deliverable
      const existingWork = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
        relations: ['deliverable'],
      });

      if (!existingWork) {
        return {
          success: false,
          message: 'Work item not found',
        };
      }

      // Verify the deliverable belongs to this campaign
      if (existingWork.deliverable.campaignId !== campaignId) {
        return {
          success: false,
          message: 'Work item does not belong to this campaign',
        };
      }

      // Delete the work item (this will also cascade delete comments if configured)
      await this.workRepository.remove(existingWork);

      // Return remaining work items for this deliverable
      const remainingWork = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'DESC' },
      });

      const workData = remainingWork.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Work deleted successfully',
        data: workData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete work',
      };
    }
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
    try {
      // Find promoter
      const promoter = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
      });

      if (!promoter) {
        return {
          success: false,
          message: 'Promoter not found',
        };
      }

      // Verify the promoter has access to this campaign
      const promoterCampaign = await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoter.id,
          campaignId: campaignId,
        },
      });

      if (!promoterCampaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Verify the work exists and belongs to this deliverable
      const work = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
      });

      if (!work) {
        return {
          success: false,
          message: 'Work not found',
        };
      }

      // Create the comment
      const comment = this.commentRepository.create({
        workId: workId,
        commentMessage: commentMessage,
        commentatorId: promoter.id,
        commentatorName: promoter.name || promoter.email,
      });

      await this.commentRepository.save(comment);

      // Return all works for this deliverable with updated comments
      const allWorks = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'ASC' },
      });

      const workDtos = allWorks.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Comment added successfully',
        data: workDtos,
      };
    } catch (error) {
      console.error('Error adding comment to work:', error);
      return {
        success: false,
        message: 'Failed to add comment to work',
      };
    }
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
    try {
      // Find advertiser
      const advertiser = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
      });

      if (!advertiser) {
        return {
          success: false,
          message: 'Advertiser not found',
        };
      }

      // Verify the campaign belongs to this advertiser
      const campaign = await this.campaignRepository.findOne({
        where: {
          id: campaignId,
          advertiserId: advertiser.id,
        },
      });

      if (!campaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Verify the work exists and belongs to this deliverable
      const work = await this.workRepository.findOne({
        where: {
          id: workId,
          deliverableId: deliverableId,
        },
      });

      if (!work) {
        return {
          success: false,
          message: 'Work not found',
        };
      }

      // Create the comment
      const comment = this.commentRepository.create({
        workId: workId,
        commentMessage: commentMessage,
        commentatorId: advertiser.id,
        commentatorName: advertiser.name || advertiser.email,
      });

      await this.commentRepository.save(comment);

      // Return all works for this deliverable with updated comments
      const allWorks = await this.workRepository.find({
        where: { deliverableId },
        relations: ['comments'],
        order: { createdAt: 'ASC' },
      });

      const workDtos = allWorks.map((w) =>
        this.campaignWorkToDto(w, campaignId),
      );

      return {
        success: true,
        message: 'Comment added successfully',
        data: workDtos,
      };
    } catch (error) {
      console.error('Error adding comment to work:', error);
      return {
        success: false,
        message: 'Failed to add comment to work',
      };
    }
  }

  /**
   * Mark a campaign deliverable as finished (for advertisers)
   */
  async markDeliverableAsFinished(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Find advertiser
      const advertiser = await this.userRepository.findOne({
        where: { firebaseUid: firebaseUid, role: 'ADVERTISER' },
      });

      if (!advertiser) {
        return {
          success: false,
          message: 'Advertiser not found',
        };
      }

      // Verify the campaign belongs to this advertiser
      const campaign = await this.campaignRepository.findOne({
        where: {
          id: campaignId,
          advertiserId: advertiser.id,
        },
      });

      if (!campaign) {
        return {
          success: false,
          message: 'You do not have access to this campaign',
        };
      }

      // Verify the deliverable exists and belongs to this campaign
      const deliverable = await this.deliverableRepository.findOne({
        where: {
          id: deliverableId,
          campaignId: campaignId,
        },
      });

      if (!deliverable) {
        return {
          success: false,
          message: 'Deliverable not found',
        };
      }

      // Check if deliverable is already finished
      if (deliverable.isFinished) {
        return {
          success: false,
          message: 'Deliverable is already marked as finished',
        };
      }

      // Mark the deliverable as finished
      deliverable.isFinished = true;
      await this.deliverableRepository.save(deliverable);

      // Return the updated deliverable
      return {
        success: true,
        message: 'Deliverable marked as finished successfully',
        data: {
          id: deliverable.id,
          campaignId: deliverable.campaignId,
          deliverable: deliverable.deliverable,
          isSubmitted: deliverable.isSubmitted,
          isFinished: deliverable.isFinished,
          createdAt: deliverable.createdAt,
          updatedAt: deliverable.updatedAt,
        },
      };
    } catch (error) {
      console.error('Error marking deliverable as finished:', error);
      return {
        success: false,
        message: 'Failed to mark deliverable as finished',
      };
    }
  }

  /** Convert entity → plain JSON shape matching your CampaignWork interface */
  private campaignWorkToDto(
    w: CampaignWorkEntity,
    campaignId: string,
  ): CampaignWork {
    return {
      id: w.id,
      campaignId: campaignId,
      promoterLink: w.promoterLink,
      description: w.description,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      comments:
        w.comments?.map((comment) => ({
          id: comment.id,
          workId: comment.workId,
          commentMessage: comment.commentMessage,
          commentatorId: comment.commentatorId,
          commentatorName: comment.commentatorName,
          createdAt: comment.createdAt,
        })) || [],
    };
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
        'promoterCampaigns.campaign.advertiser',
        'promoterCampaigns.campaign.advertiser.advertiserDetails',
        'promoterCampaigns.campaign.campaignDeliverables',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork',
        'promoterCampaigns.campaign.campaignDeliverables.promoterWork.comments',
        'campaignApplications',
        'campaignApplications.campaign',
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
