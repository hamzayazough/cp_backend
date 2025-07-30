import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../../database/entities/promoter-campaign.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../../database/entities/campaign-applications.entity';
import { CampaignWorkEntity } from '../../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../../database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from '../../database/entities/campaign-deliverable.entity';
import {
  SendApplicationRequest,
  SendApplicationResponse,
  AcceptContractRequest,
  AcceptContractResponse,
} from '../../interfaces/campaign-actions';
import { CampaignWork } from '../../interfaces/promoter-campaigns';
import {
  INTERACTION_ERROR_MESSAGES,
  INTERACTION_SUCCESS_MESSAGES,
  INTERACTION_DEFAULTS,
  CAMPAIGN_STATUS_VALIDATORS,
  ENTITY_TRANSFORMERS,
  RESPONSE_BUILDERS,
  QUERY_BUILDERS,
} from './promoter-helper.const';

@Injectable()
export class PromoterCampaignInteractionService {
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
    private workRepository: Repository<CampaignWorkEntity>,
    @InjectRepository(CampaignWorkCommentEntity)
    private commentRepository: Repository<CampaignWorkCommentEntity>,
    @InjectRepository(CampaignDeliverableEntity)
    private deliverableRepository: Repository<CampaignDeliverableEntity>,
  ) {}

  /**
   * Send a campaign application
   */
  async sendCampaignApplication(
    firebaseUid: string,
    request: SendApplicationRequest,
  ): Promise<SendApplicationResponse> {
    const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
    await this.findActiveCampaign(request.campaignId);

    await this.validateNoExistingApplication(promoter.id, request.campaignId);

    const savedApplication = await this.createCampaignApplication(
      promoter.id,
      request.campaignId,
      request.applicationMessage,
    );

    return RESPONSE_BUILDERS.buildApplicationResponse(savedApplication);
  }

  /**
   * Accept a contract for a public campaign
   */
  async acceptContract(
    firebaseUid: string,
    request: AcceptContractRequest,
  ): Promise<AcceptContractResponse> {
    const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
    const campaign = await this.findActiveCampaign(request.campaignId);

    this.validateCampaignIsPublic(campaign);
    await this.validateNoExistingContract(promoter.id, request.campaignId);

    const savedContract = await this.createPromoterCampaign(
      promoter.id,
      request.campaignId,
    );

    return RESPONSE_BUILDERS.buildContractResponse(savedContract);
  }

  /**
   * Add work to a deliverable
   */
  async addCampaignWorkToDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    promoterLink: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
      await this.validatePromoterCampaignAccess(promoter.id, campaignId);

      const deliverable = await this.findDeliverable(deliverableId, campaignId);
      await this.createWork(deliverableId, promoterLink, description);

      await this.markDeliverableAsSubmitted(deliverable);
      const allWork = await this.getAllWorkForDeliverable(deliverableId);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.WORK_ADDED,
        allWork.map((w) => ENTITY_TRANSFORMERS.workEntityToDto(w, campaignId)),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_ADD_WORK,
      );
    }
  }

  /**
   * Update work in a deliverable
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
      const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
      await this.validatePromoterCampaignAccess(promoter.id, campaignId);

      const existingWork = await this.findWorkWithValidation(
        workId,
        deliverableId,
        campaignId,
      );
      await this.updateWork(existingWork, promoterLink, description);

      const allWork = await this.getAllWorkForDeliverable(deliverableId);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.WORK_UPDATED,
        allWork.map((w) => ENTITY_TRANSFORMERS.workEntityToDto(w, campaignId)),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_UPDATE_WORK,
      );
    }
  }

  /**
   * Delete work from a deliverable
   */
  async deleteCampaignWorkFromDeliverable(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
      await this.validatePromoterCampaignAccess(promoter.id, campaignId);

      const existingWork = await this.findWorkWithValidation(
        workId,
        deliverableId,
        campaignId,
      );
      await this.deleteWork(existingWork);

      const remainingWork = await this.getAllWorkForDeliverable(deliverableId);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.WORK_DELETED,
        remainingWork.map((w) =>
          ENTITY_TRANSFORMERS.workEntityToDto(w, campaignId),
        ),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_DELETE_WORK,
      );
    }
  }

  /**
   * Add comment to work (promoter)
   */
  async addCommentToWork(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
      await this.validatePromoterCampaignAccess(promoter.id, campaignId);
      await this.validateDeliverableAndWork(deliverableId, campaignId, workId);

      await this.createComment(
        workId,
        commentMessage,
        promoter.id,
        promoter.name || promoter.email,
      );
      const allWorks = await this.getAllWorkForDeliverable(deliverableId);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.COMMENT_ADDED,
        allWorks.map((w) => ENTITY_TRANSFORMERS.workEntityToDto(w, campaignId)),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_ADD_COMMENT,
      );
    }
  }

  /**
   * Add comment to work (advertiser)
   */
  async addCommentToWorkAsAdvertiser(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
    workId: string,
    commentMessage: string,
  ): Promise<{ success: boolean; message: string; data?: CampaignWork[] }> {
    try {
      const advertiser = await this.findAdvertiserByFirebaseUid(firebaseUid);
      await this.validateAdvertiserCampaignAccess(advertiser.id, campaignId);
      await this.validateDeliverableAndWork(deliverableId, campaignId, workId);

      await this.createComment(
        workId,
        commentMessage,
        advertiser.id,
        advertiser.name || advertiser.email,
      );
      const allWorks = await this.getAllWorkForDeliverable(deliverableId);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.COMMENT_ADDED,
        allWorks.map((w) => ENTITY_TRANSFORMERS.workEntityToDto(w, campaignId)),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_ADD_COMMENT,
      );
    }
  }

  /**
   * Mark deliverable as finished (advertiser)
   */
  async markDeliverableAsFinished(
    firebaseUid: string,
    campaignId: string,
    deliverableId: string,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const advertiser = await this.findAdvertiserByFirebaseUid(firebaseUid);
      await this.validateAdvertiserCampaignAccess(advertiser.id, campaignId);

      const deliverable = await this.findDeliverable(deliverableId, campaignId);
      this.validateDeliverableNotFinished(deliverable);

      const updatedDeliverable =
        await this.markDeliverableFinished(deliverable);

      return RESPONSE_BUILDERS.buildSuccessResponse(
        INTERACTION_SUCCESS_MESSAGES.DELIVERABLE_FINISHED,
        ENTITY_TRANSFORMERS.deliverableEntityToDto(updatedDeliverable),
      );
    } catch (error) {
      return RESPONSE_BUILDERS.buildErrorResponse(
        error instanceof Error
          ? error.message
          : INTERACTION_ERROR_MESSAGES.FAILED_TO_MARK_FINISHED,
      );
    }
  }

  // Helper Methods

  private async findPromoterByFirebaseUid(
    firebaseUid: string,
  ): Promise<UserEntity> {
    const promoter = await this.userRepository.findOne(
      QUERY_BUILDERS.buildPromoterFindOptions(firebaseUid),
    );
    if (!promoter) {
      throw new NotFoundException(
        INTERACTION_ERROR_MESSAGES.PROMOTER_NOT_FOUND,
      );
    }
    return promoter;
  }

  private async findAdvertiserByFirebaseUid(
    firebaseUid: string,
  ): Promise<UserEntity> {
    const advertiser = await this.userRepository.findOne(
      QUERY_BUILDERS.buildAdvertiserFindOptions(firebaseUid),
    );
    if (!advertiser) {
      throw new NotFoundException(
        INTERACTION_ERROR_MESSAGES.ADVERTISER_NOT_FOUND,
      );
    }
    return advertiser;
  }

  private async findActiveCampaign(
    campaignId: string,
  ): Promise<CampaignEntity> {
    const campaign = await this.campaignRepository.findOne(
      QUERY_BUILDERS.buildCampaignFindOptions(campaignId),
    );
    if (!campaign) {
      throw new NotFoundException(
        INTERACTION_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND,
      );
    }
    return campaign;
  }

  private async validateNoExistingApplication(
    promoterId: string,
    campaignId: string,
  ): Promise<void> {
    const existingApplication =
      await this.campaignApplicationRepository.findOne(
        QUERY_BUILDERS.buildCampaignApplicationFindOptions(
          promoterId,
          campaignId,
        ),
      );
    if (existingApplication) {
      throw new Error(INTERACTION_ERROR_MESSAGES.ALREADY_APPLIED);
    }
  }

  private validateCampaignIsPublic(campaign: CampaignEntity): void {
    if (!campaign.isPublic) {
      throw new Error(INTERACTION_ERROR_MESSAGES.CAMPAIGN_NOT_PUBLIC);
    }
  }

  private async validateNoExistingContract(
    promoterId: string,
    campaignId: string,
  ): Promise<void> {
    const existingContract = await this.promoterCampaignRepository.findOne(
      QUERY_BUILDERS.buildPromoterCampaignFindOptions(promoterId, campaignId),
    );
    if (existingContract) {
      throw new Error(
        CAMPAIGN_STATUS_VALIDATORS.getStatusErrorMessage(
          existingContract.status,
        ),
      );
    }
  }

  private async createCampaignApplication(
    promoterId: string,
    campaignId: string,
    applicationMessage: string,
  ): Promise<CampaignApplicationEntity> {
    const campaignApplication = this.campaignApplicationRepository.create({
      promoterId,
      campaignId,
      applicationMessage,
      status: ApplicationStatus.PENDING,
    });
    return await this.campaignApplicationRepository.save(campaignApplication);
  }

  private async createPromoterCampaign(
    promoterId: string,
    campaignId: string,
  ): Promise<PromoterCampaign> {
    const promoterCampaign = this.promoterCampaignRepository.create({
      promoterId,
      campaignId,
      status: PromoterCampaignStatus.ONGOING,
      ...INTERACTION_DEFAULTS.INITIAL_CAMPAIGN_VALUES,
    });
    return await this.promoterCampaignRepository.save(promoterCampaign);
  }

  private async validatePromoterCampaignAccess(
    promoterId: string,
    campaignId: string,
  ): Promise<void> {
    const promoterCampaign = await this.promoterCampaignRepository.findOne(
      QUERY_BUILDERS.buildPromoterCampaignFindOptions(promoterId, campaignId),
    );
    if (!promoterCampaign) {
      throw new Error(INTERACTION_ERROR_MESSAGES.CAMPAIGN_ACCESS_DENIED);
    }
  }

  private async validateAdvertiserCampaignAccess(
    advertiserId: string,
    campaignId: string,
  ): Promise<void> {
    const campaign = await this.campaignRepository.findOne(
      QUERY_BUILDERS.buildAdvertiserCampaignFindOptions(
        campaignId,
        advertiserId,
      ),
    );
    if (!campaign) {
      throw new Error(INTERACTION_ERROR_MESSAGES.CAMPAIGN_ACCESS_DENIED);
    }
  }

  private async findDeliverable(
    deliverableId: string,
    campaignId: string,
  ): Promise<CampaignDeliverableEntity> {
    const deliverable = await this.deliverableRepository.findOne(
      QUERY_BUILDERS.buildDeliverableFindOptions(deliverableId, campaignId),
    );
    if (!deliverable) {
      throw new Error(INTERACTION_ERROR_MESSAGES.DELIVERABLE_NOT_FOUND);
    }
    return deliverable;
  }

  private async createWork(
    deliverableId: string,
    promoterLink: string,
    description?: string,
  ): Promise<CampaignWorkEntity> {
    const newWork = this.workRepository.create({
      deliverableId,
      promoterLink,
      description,
    });
    return await this.workRepository.save(newWork);
  }

  private async markDeliverableAsSubmitted(
    deliverable: CampaignDeliverableEntity,
  ): Promise<void> {
    deliverable.isSubmitted = true;
    await this.deliverableRepository.save(deliverable);
  }

  private async getAllWorkForDeliverable(
    deliverableId: string,
  ): Promise<CampaignWorkEntity[]> {
    return await this.workRepository.find(
      QUERY_BUILDERS.buildWorkListOptions(deliverableId),
    );
  }

  private async findWorkWithValidation(
    workId: string,
    deliverableId: string,
    campaignId: string,
  ): Promise<CampaignWorkEntity> {
    const existingWork = await this.workRepository.findOne(
      QUERY_BUILDERS.buildWorkFindOptions(workId, deliverableId),
    );
    if (!existingWork) {
      throw new Error(INTERACTION_ERROR_MESSAGES.WORK_NOT_FOUND);
    }
    if (existingWork.deliverable.campaignId !== campaignId) {
      throw new Error(INTERACTION_ERROR_MESSAGES.WORK_WRONG_CAMPAIGN);
    }
    return existingWork;
  }

  private async updateWork(
    work: CampaignWorkEntity,
    promoterLink: string,
    description?: string,
  ): Promise<void> {
    work.promoterLink = promoterLink;
    if (description !== undefined) {
      work.description = description;
    }
    await this.workRepository.save(work);
  }

  private async deleteWork(work: CampaignWorkEntity): Promise<void> {
    await this.workRepository.remove(work);
  }

  private async validateDeliverableAndWork(
    deliverableId: string,
    campaignId: string,
    workId: string,
  ): Promise<void> {
    await this.findDeliverable(deliverableId, campaignId);
    const work = await this.workRepository.findOne({
      where: { id: workId, deliverableId },
    });
    if (!work) {
      throw new Error(INTERACTION_ERROR_MESSAGES.WORK_NOT_FOUND);
    }
  }

  private async createComment(
    workId: string,
    commentMessage: string,
    commentatorId: string,
    commentatorName: string,
  ): Promise<void> {
    const comment = this.commentRepository.create({
      workId,
      commentMessage,
      commentatorId,
      commentatorName,
    });
    await this.commentRepository.save(comment);
  }

  private validateDeliverableNotFinished(
    deliverable: CampaignDeliverableEntity,
  ): void {
    if (deliverable.isFinished) {
      throw new Error(INTERACTION_ERROR_MESSAGES.DELIVERABLE_ALREADY_FINISHED);
    }
  }

  private async markDeliverableFinished(
    deliverable: CampaignDeliverableEntity,
  ): Promise<CampaignDeliverableEntity> {
    deliverable.isFinished = true;
    return await this.deliverableRepository.save(deliverable);
  }
}
