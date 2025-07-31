import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CampaignEntity } from 'src/database/entities/campaign.entity';
import { UserEntity } from 'src/database/entities';
import { CampaignDeliverableEntity } from 'src/database/entities/campaign-deliverable.entity';
import { CampaignBudgetTracking } from 'src/database/entities/campaign-budget-tracking.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { Transaction } from 'src/database/entities/transaction.entity';
import { S3Service, S3FileType } from '../s3.service';
import { Campaign } from 'src/interfaces/campaign';
import { CampaignType } from 'src/enums/campaign-type';
import { Deliverable } from 'src/enums/deliverable';
import { UserType } from 'src/enums/user-type';

// Helpers
import { FileValidationHelper } from 'src/helpers/file-validation.helper';
import { CampaignValidationHelper } from 'src/helpers/campaign-validation.helper';
import { CampaignEntityBuilder } from 'src/helpers/campaign-entity.builder';
import { CampaignEntityMapper } from 'src/helpers/campaign-entity.mapper';

// Constants
import {
  CAMPAIGN_CREATION_CONSTANTS,
  CAMPAIGN_CREATION_UTILITIES,
  CAMPAIGN_ENTITY_BUILDERS,
  CAMPAIGN_VALIDATORS,
  CAMPAIGN_RESPONSE_BUILDERS,
  CreateCampaignResponse,
  UploadFileResponse,
} from './campaign-creation-helper.constants';

// Export interfaces for use by controllers
export { CreateCampaignResponse, UploadFileResponse };

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignDeliverableEntity)
    private deliverableRepository: Repository<CampaignDeliverableEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private campaignBudgetTrackingRepository: Repository<CampaignBudgetTracking>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private s3Service: S3Service,
  ) {}

  async uploadCampaignFile(
    file: Express.Multer.File,
    campaignId: string,
    firebaseUid: string,
  ): Promise<UploadFileResponse> {
    try {
      // Validate file using helper
      FileValidationHelper.validateFile(file);

      // Get and validate user
      const user = await this.getUserByFirebaseUid(firebaseUid);
      const validatedUser = CAMPAIGN_VALIDATORS.validateUserExists(user);

      // Get and validate campaign ownership
      const campaign = await this.getCampaignByIdAndOwner(
        campaignId,
        validatedUser.id,
      );
      const validatedCampaign = CAMPAIGN_VALIDATORS.validateCampaignOwnership(
        campaign,
        validatedUser.id,
      );

      // Upload file to S3
      const fileUrl = await this.uploadFileToS3(
        file,
        firebaseUid,
        validatedUser.id,
        campaignId,
      );

      // Update campaign with media URL
      const updatedCampaign = await this.updateCampaignMediaUrl(
        validatedCampaign,
        fileUrl,
      );

      // Convert entity to interface using helper
      const campaignResponse =
        CampaignEntityMapper.entityToInterface(updatedCampaign);

      return CAMPAIGN_RESPONSE_BUILDERS.buildFileUploadSuccessResponse(
        fileUrl,
        campaignResponse,
      );
    } catch (error) {
      this.handleCampaignError(
        error,
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
      );
    }
  }

  async createCampaign(
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    > & {
      mediaUrl?: string;
    },
    firebaseUid: string,
  ): Promise<CreateCampaignResponse> {
    try {
      // Get and validate user
      const user = await this.getUserByFirebaseUid(firebaseUid);
      const validatedUser = CAMPAIGN_VALIDATORS.validateUserExists(user);

      // Validate campaign data using helper
      CampaignValidationHelper.validateCampaignByType(campaignData as Campaign);

      // Build campaign entity using helper
      const campaign = CampaignEntityBuilder.buildCampaignEntity(
        campaignData,
        validatedUser,
      );

      // Handle budget allocation if required
      if (campaign.budgetAllocated && campaign.budgetAllocated > 0) {
        await this.handleBudgetAllocation(
          validatedUser.id,
          campaign.budgetAllocated,
        );
      }

      // Save campaign
      const savedCampaign = await this.campaignRepository.save(campaign);

      // Create budget tracking record if budget was allocated
      if (savedCampaign.budgetAllocated && savedCampaign.budgetAllocated > 0) {
        await this.createBudgetTrackingRecord(savedCampaign);
      }

      // Handle deliverables for supported campaign types
      const updatedCampaign = await this.handleCampaignDeliverables(
        savedCampaign,
        campaignData as Campaign,
      );

      // Convert entity to interface using helper
      const campaignResponse =
        CampaignEntityMapper.entityToInterface(updatedCampaign);

      return CAMPAIGN_RESPONSE_BUILDERS.buildCampaignCreationSuccessResponse(
        campaignResponse,
      );
    } catch (error) {
      this.handleCampaignError(
        error,
        CAMPAIGN_CREATION_CONSTANTS.ERROR_MESSAGES.CAMPAIGN_CREATION_FAILED,
      );
    }
  }

  /**
   * Creates deliverable entities from deliverable enum values using helper
   */
  private async createDeliverableEntities(
    campaignId: string,
    deliverables: Deliverable[],
  ): Promise<CampaignDeliverableEntity[]> {
    const deliverableEntities = deliverables.map((deliverable) =>
      CAMPAIGN_ENTITY_BUILDERS.buildDeliverableEntity(campaignId, deliverable),
    );

    return await this.deliverableRepository.save(deliverableEntities);
  }

  /**
   * Handle budget allocation and validation
   */
  private async handleBudgetAllocation(
    advertiserId: string,
    budgetDollars: number,
  ): Promise<void> {
    // Get wallet and validate
    const wallet = await this.getAdvertiserWallet(advertiserId);
    const validatedWallet = CAMPAIGN_VALIDATORS.validateWalletExists(wallet);

    // Validate sufficient funds
    const validation = CAMPAIGN_VALIDATORS.validateSufficientFunds(
      validatedWallet,
      budgetDollars,
    );
    if (!validation.isValid) {
      const errorMessage = CAMPAIGN_VALIDATORS.buildInsufficientFundsMessage(
        validation.availableBalance,
        budgetDollars,
        validation.shortfall,
      );
      throw new BadRequestException(errorMessage);
    }

    // Update wallet to hold funds
    await this.holdFundsInWallet(validatedWallet, budgetDollars);

    // Create transaction record
    await this.createBudgetAllocationTransaction(advertiserId, budgetDollars);
  }

  /**
   * Get advertiser wallet
   */
  private async getAdvertiserWallet(
    advertiserId: string,
  ): Promise<Wallet | null> {
    return await this.walletRepository.findOne({
      where: { userId: advertiserId, userType: UserType.ADVERTISER },
    });
  }

  /**
   * Hold funds in wallet for campaign
   */
  private async holdFundsInWallet(
    wallet: Wallet,
    amount: number,
  ): Promise<void> {
    wallet.heldForCampaigns = (wallet.heldForCampaigns || 0) + amount;
    await this.walletRepository.save(wallet);
  }

  /**
   * Create budget allocation transaction
   */
  private async createBudgetAllocationTransaction(
    advertiserId: string,
    budgetDollars: number,
  ): Promise<void> {
    const transaction =
      CAMPAIGN_ENTITY_BUILDERS.buildBudgetAllocationTransaction(
        advertiserId,
        budgetDollars,
      );
    await this.transactionRepository.save(transaction);
  }

  /**
   * Create budget tracking record using helper
   */
  private async createBudgetTrackingRecord(
    campaign: CampaignEntity,
  ): Promise<void> {
    const budgetTracking =
      CAMPAIGN_ENTITY_BUILDERS.buildBudgetTrackingEntity(campaign);
    await this.campaignBudgetTrackingRepository.save(budgetTracking);
  }

  /**
   * Handle campaign deliverables creation
   */
  private async handleCampaignDeliverables(
    campaign: CampaignEntity,
    campaignData: Campaign,
  ): Promise<CampaignEntity> {
    if (!CAMPAIGN_CREATION_UTILITIES.supportsDeliverables(campaignData.type)) {
      return campaign;
    }

    const deliverableEnums =
      CAMPAIGN_CREATION_UTILITIES.extractDeliverablesFromCampaign(campaignData);
    if (deliverableEnums.length === 0) {
      return campaign;
    }

    const deliverableEntities = await this.createDeliverableEntities(
      campaign.id,
      deliverableEnums,
    );

    // Update campaign with deliverable IDs based on campaign type
    if (campaignData.type === CampaignType.CONSULTANT) {
      campaign.expectedDeliverableIds = deliverableEntities.map((d) => d.id);
    } else if (campaignData.type === CampaignType.SELLER) {
      campaign.deliverableIds = deliverableEntities.map((d) => d.id);
    }

    return await this.campaignRepository.save(campaign);
  }

  /**
   * Helper method to get user by Firebase UID
   */
  private async getUserByFirebaseUid(
    firebaseUid: string,
  ): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { firebaseUid },
    });
  }

  /**
   * Helper method to get campaign by ID and verify ownership
   */
  private async getCampaignByIdAndOwner(
    campaignId: string,
    userId: string,
  ): Promise<CampaignEntity | null> {
    return await this.campaignRepository.findOne({
      where: { id: campaignId, advertiserId: userId },
    });
  }

  /**
   * Helper method to upload file to S3
   */
  private async uploadFileToS3(
    file: Express.Multer.File,
    firebaseUid: string,
    userId: string,
    campaignId: string,
  ): Promise<string> {
    const fileKey = CAMPAIGN_CREATION_UTILITIES.generateFileKey(
      firebaseUid,
      file.originalname,
    );

    const uploadResult = await this.s3Service.uploadFile(
      file.buffer,
      fileKey,
      file.mimetype,
      S3FileType.CAMPAIGN_PRODUCT,
      userId,
      { campaignId },
    );

    return uploadResult.publicUrl;
  }

  /**
   * Helper method to update campaign media URL
   */
  private async updateCampaignMediaUrl(
    campaign: CampaignEntity,
    mediaUrl: string,
  ): Promise<CampaignEntity> {
    campaign.mediaUrl = mediaUrl;
    return await this.campaignRepository.save(campaign);
  }

  /**
   * Helper method to handle campaign errors
   */
  private handleCampaignError(error: unknown, defaultMessage: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    throw new BadRequestException(
      error instanceof Error ? error.message : defaultMessage,
    );
  }
}
