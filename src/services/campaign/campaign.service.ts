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
import { PromoterCampaign } from 'src/database/entities/promoter-campaign.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { Transaction } from 'src/database/entities/transaction.entity';
import { S3Service, S3FileType } from '../s3.service';
import { Campaign } from 'src/interfaces/campaign';
import { CampaignType } from 'src/enums/campaign-type';
import { Deliverable } from 'src/enums/deliverable';
import { UserType } from 'src/enums/user-type';
import { NotificationType } from 'src/enums/notification-type';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../notification-delivery.service';
import { NotificationHelperService } from '../notification-helper.service';

// Helpers
import { FileValidationHelper } from 'src/helpers/file-validation.helper';
import { CampaignValidationHelper } from 'src/helpers/campaign-validation.helper';
import { CampaignEntityBuilder } from 'src/helpers/campaign-entity.builder';
import { CampaignEntityMapper } from 'src/helpers/campaign-entity.mapper';
import { CampaignMediaService } from './campaign-media.service';
import { DiscordService } from '../discord.service';

// Constants
import {
  CAMPAIGN_CREATION_CONSTANTS,
  CAMPAIGN_CREATION_UTILITIES,
  CAMPAIGN_ENTITY_BUILDERS,
  CAMPAIGN_VALIDATORS,
  CAMPAIGN_RESPONSE_BUILDERS,
  CreateCampaignResponse,
  UploadFileResponse,
  UploadMultipleFilesResponse,
  DeleteMediaResponse,
} from './campaign-creation-helper.constants';

// Export interfaces for use by controllers
export {
  CreateCampaignResponse,
  UploadFileResponse,
  UploadMultipleFilesResponse,
  DeleteMediaResponse,
};

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
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private s3Service: S3Service,
    private campaignMediaService: CampaignMediaService,
    private discordService: DiscordService,
    private notificationDeliveryService: NotificationDeliveryService,
    private notificationHelperService: NotificationHelperService,
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

      // Add media to campaign using the new media service
      await this.addMediaToCampaign(validatedCampaign.id, fileUrl, file);

      // Reload campaign with media relationship
      const updatedCampaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
        relations: ['media'],
      });

      if (!updatedCampaign) {
        throw new NotFoundException('Campaign not found after media upload');
      }

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

  async uploadCampaignFiles(
    files: Express.Multer.File[],
    campaignId: string,
    firebaseUid: string,
  ): Promise<UploadMultipleFilesResponse> {
    try {
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

      const uploadedFiles: string[] = [];
      const failedFiles: string[] = [];

      // Process each file
      for (const file of files) {
        try {
          // Validate file using helper
          FileValidationHelper.validateFile(file);

          // Upload file to S3
          const fileUrl = await this.uploadFileToS3(
            file,
            firebaseUid,
            validatedUser.id,
            campaignId,
          );

          // Add media to campaign using the new media service
          await this.addMediaToCampaign(validatedCampaign.id, fileUrl, file);

          uploadedFiles.push(fileUrl);
        } catch (fileError) {
          console.error(
            `Failed to upload file ${file.originalname}:`,
            fileError,
          );
          failedFiles.push(file.originalname);
        }
      }

      // Reload campaign with media relationship
      const updatedCampaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
        relations: ['media'],
      });

      if (!updatedCampaign) {
        throw new NotFoundException('Campaign not found after media upload');
      }

      // Convert entity to interface using helper
      const campaignResponse =
        CampaignEntityMapper.entityToInterface(updatedCampaign);

      return {
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} files${
          failedFiles.length > 0 ? `, ${failedFiles.length} failed` : ''
        }`,
        uploadedFiles,
        failedFiles,
        campaign: campaignResponse,
      };
    } catch (error) {
      this.handleCampaignError(error, 'Failed to upload campaign files');
    }
  }

  async createCampaign(
    campaignData: Omit<
      Campaign,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'advertiserId'
    >,
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

      // Create Discord thread for the campaign
      await this.createDiscordThreadForCampaign(updatedCampaign, validatedUser);

      // Send notification for campaign creation
      await this.sendCampaignCreatedNotification(
        updatedCampaign,
        validatedUser,
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
   * Update campaign budget by adding additional funding
   */
  async updateCampaignBudget(
    firebaseUid: string,
    campaignId: string,
    additionalBudgetCents: number,
  ): Promise<{
    campaignId: string;
    previousBudgetCents: number;
    additionalBudgetCents: number;
    newBudgetCents: number;
  }> {
    try {
      // Convert cents to dollars for internal calculations
      const additionalBudgetDollars = additionalBudgetCents / 100;

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

      // Store previous budget values and ensure they are numbers
      const previousBudgetDollars = Number(validatedCampaign.budgetAllocated);
      const previousMaxBudget = Number(validatedCampaign.maxBudget || 0);

      // Handle budget allocation (wallet validation and fund holding)
      await this.handleBudgetAllocation(
        validatedUser.id,
        additionalBudgetDollars,
      );

      // Calculate new budget values (ensure numeric addition)
      const newBudgetDollars = previousBudgetDollars + additionalBudgetDollars;
      let newMaxBudget = previousMaxBudget;

      // Update campaign budget fields
      validatedCampaign.budgetAllocated = newBudgetDollars;

      // For CONSULTANT and SELLER campaigns, also update maxBudget
      if (
        validatedCampaign.type === CampaignType.CONSULTANT ||
        validatedCampaign.type === CampaignType.SELLER
      ) {
        newMaxBudget = previousMaxBudget + additionalBudgetDollars;
        validatedCampaign.maxBudget = newMaxBudget;
      }

      // Save updated campaign
      const updatedCampaign =
        await this.campaignRepository.save(validatedCampaign);

      // Update budget tracking record
      await this.updateBudgetTrackingRecord(campaignId, additionalBudgetCents);

      // Create additional budget allocation transaction
      await this.createAdditionalBudgetTransaction(
        validatedUser.id,
        campaignId,
        additionalBudgetDollars,
      );

      // Send budget update notifications to associated promoters
      await this.sendBudgetUpdateNotifications(
        campaignId,
        validatedCampaign.title,
        additionalBudgetCents,
        validatedUser,
      );

      return {
        campaignId: updatedCampaign.id,
        previousBudgetCents: Math.round(previousBudgetDollars * 100),
        additionalBudgetCents,
        newBudgetCents: Math.round(newBudgetDollars * 100),
      };
    } catch (error) {
      this.handleCampaignError(error, 'Failed to update campaign budget');
    }
  }

  /**
   * Update budget tracking record with additional allocation
   */
  private async updateBudgetTrackingRecord(
    campaignId: string,
    additionalBudgetCents: number,
  ): Promise<void> {
    const budgetTracking = await this.campaignBudgetTrackingRepository.findOne({
      where: { campaignId },
    });

    if (!budgetTracking) {
      throw new NotFoundException(
        'Budget tracking record not found for campaign',
      );
    }

    // Add to allocated budget
    budgetTracking.allocatedBudgetCents += additionalBudgetCents;

    await this.campaignBudgetTrackingRepository.save(budgetTracking);
  }

  /**
   * Create transaction record for additional budget allocation
   */
  private async createAdditionalBudgetTransaction(
    advertiserId: string,
    campaignId: string,
    budgetDollars: number,
  ): Promise<void> {
    const transaction =
      CAMPAIGN_ENTITY_BUILDERS.buildBudgetAllocationTransaction(
        advertiserId,
        budgetDollars,
      );

    // Add campaign ID to the transaction for additional budget allocation
    transaction.campaignId = campaignId;
    transaction.description = `Additional budget allocation for campaign`;

    await this.transactionRepository.save(transaction);
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
   * Helper method to add media to a campaign
   */
  private async addMediaToCampaign(
    campaignId: string,
    fileUrl: string,
    file: Express.Multer.File,
  ): Promise<void> {
    // Determine media type based on file mimetype
    let mediaType = 'document';
    if (file.mimetype.startsWith('image/')) {
      mediaType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    }

    // Check if this is the first media for this campaign
    const existingMedia =
      await this.campaignMediaService.getCampaignMedia(campaignId);
    const isPrimary = existingMedia.length === 0; // First media becomes primary

    await this.campaignMediaService.addMediaToCampaign(campaignId, {
      mediaUrl: fileUrl,
      mediaType,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      isPrimary,
    });
  }

  /**
   * Delete campaign media file (from both database and S3)
   */
  async deleteCampaignMedia(
    campaignId: string,
    mediaUrl: string,
    firebaseUid: string,
  ): Promise<DeleteMediaResponse> {
    try {
      // Get and validate user
      const user = await this.userRepository.findOne({
        where: { firebaseUid },
      });
      const validatedUser = CAMPAIGN_VALIDATORS.validateUserExists(user);

      // Get and validate campaign ownership
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
        relations: ['media'],
      });
      CAMPAIGN_VALIDATORS.validateCampaignOwnership(campaign, validatedUser.id);

      // Find and delete the media from database
      const deletedMedia = await this.campaignMediaService.deleteMediaByUrl(
        campaignId,
        mediaUrl,
      );

      if (!deletedMedia) {
        return {
          success: false,
          message: 'Media file not found for this campaign',
        };
      }

      // Delete file from S3
      try {
        const key = this.s3Service.extractKeyFromUrl(mediaUrl);
        await this.s3Service.deleteFile(key);
      } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error);
        // Continue even if S3 deletion fails - the database record is already deleted
      }

      return {
        success: true,
        message: 'Media file deleted successfully',
      };
    } catch (error) {
      this.handleCampaignError(error, 'Failed to delete media file');
    }
  }

  /**
   * Creates a Discord thread for the campaign
   */
  private async createDiscordThreadForCampaign(
    campaign: CampaignEntity,
    user: UserEntity,
  ): Promise<void> {
    try {
      // Get advertiser details to find the Discord channel
      const advertiserDetails = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['advertiserDetails'],
      });

      if (!advertiserDetails?.advertiserDetails?.discordChannelId) {
        // No Discord channel available, skip thread creation
        return;
      }

      // Create Discord thread
      const threadResult = await this.discordService.createCampaignThread(
        campaign.title,
        advertiserDetails.advertiserDetails.discordChannelId,
      );

      if (threadResult) {
        // Update campaign with Discord thread information
        campaign.discordThreadId = threadResult.threadId;
        campaign.discordInviteLink = threadResult.inviteUrl;
        await this.campaignRepository.save(campaign);
      }
    } catch (error) {
      // Log error but don't fail campaign creation
      console.error('Failed to create Discord thread for campaign:', error);
    }
  }

  // ============================================================================
  // NOTIFICATION HELPER METHODS
  // ============================================================================

  /**
   * Send notification when a campaign is created
   */
  private async sendCampaignCreatedNotification(
    campaign: CampaignEntity,
    advertiser: UserEntity,
  ): Promise<void> {
    try {
      // Get delivery methods using helper service
      const deliveryMethods =
        await this.notificationHelperService.getNotificationMethods(
          advertiser.id,
          NotificationType.CAMPAIGN_CREATED,
        );

      const notificationData: NotificationDeliveryData = {
        userId: advertiser.id,
        notificationType: NotificationType.CAMPAIGN_CREATED,
        title: 'Campaign Created Successfully',
        message: `Your campaign "${campaign.title}" has been created successfully and is now ${campaign.status.toLowerCase()}. You can start receiving applications from promoters.`,
        deliveryMethods,
        metadata: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          campaignType: campaign.type,
          campaignStatus: campaign.status,
          budgetAllocated: campaign.budgetAllocated,
          createdAt: campaign.createdAt.toISOString(),
        },
        campaignId: campaign.id,
      };

      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to send campaign creation notification:', error);
    }
  }

  /**
   * Send budget update notifications to all promoters associated with a campaign
   */
  private async sendBudgetUpdateNotifications(
    campaignId: string,
    campaignTitle: string,
    additionalBudgetCents: number,
    advertiser: UserEntity,
  ): Promise<void> {
    try {
      // Get all promoters associated with this campaign
      const promoterCampaigns = await this.promoterCampaignRepository.find({
        where: { campaignId },
        relations: ['promoter'],
      });

      if (promoterCampaigns.length === 0) {
        return; // No promoters to notify
      }

      const additionalBudgetDollars = additionalBudgetCents / 100;

      // Send notification to each promoter using helper service
      const notificationPromises = promoterCampaigns.map(
        async (promoterCampaign) => {
          if (!promoterCampaign.promoter) {
            return; // Skip if promoter relation is not loaded
          }

          const promoter = promoterCampaign.promoter;

          // Get delivery methods using helper service
          const deliveryMethods =
            await this.notificationHelperService.getNotificationMethods(
              promoter.id,
              NotificationType.CAMPAIGN_BUDGET_INCREASED,
            );

          const notificationData: NotificationDeliveryData = {
            userId: promoter.id,
            notificationType: NotificationType.CAMPAIGN_BUDGET_INCREASED,
            title: '💰 Campaign Budget Increased!',
            message: `Great news! The budget for campaign "${campaignTitle}" has been increased by $${additionalBudgetDollars.toFixed(2)}. This means more opportunities and potential earnings for this campaign.`,
            deliveryMethods,
            metadata: {
              campaignId,
              campaignTitle,
              additionalBudgetCents,
              additionalBudgetDollars,
              advertiserName: advertiser.name || advertiser.email,
              advertiserId: advertiser.id,
              updatedAt: new Date().toISOString(),
            },
            campaignId,
          };

          await this.notificationDeliveryService.deliverNotification(
            notificationData,
          );
        },
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to send budget update notifications:', error);
    }
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

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
