import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { CampaignEntity } from '../database/entities/campaign.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignDeliverableEntity } from '../database/entities/campaign-deliverable.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { Wallet } from '../database/entities/wallet.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../database/entities/transaction.entity';
import { S3Service, S3FileType } from './s3.service';
import {
  Campaign,
  ConsultantCampaign,
  SellerCampaign,
} from '../interfaces/campaign';
import { CampaignType } from '../enums/campaign-type';
import { Deliverable } from '../enums/deliverable';
import { UserType } from '../enums/user-type';

// Helpers
import { FileValidationHelper } from '../helpers/file-validation.helper';
import { CampaignValidationHelper } from '../helpers/campaign-validation.helper';
import { CampaignEntityBuilder } from '../helpers/campaign-entity.builder';
import { CampaignEntityMapper } from '../helpers/campaign-entity.mapper';

// Constants
import {
  CAMPAIGN_SUCCESS_MESSAGES,
  CAMPAIGN_ERROR_MESSAGES,
} from '../constants/campaign-validation.constants';

export interface CreateCampaignResponse {
  success: boolean;
  message: string;
  campaign?: Campaign;
}

export interface UploadFileResponse {
  success: boolean;
  message: string;
  fileUrl?: string;
  campaign?: Campaign;
}

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

      // Verify user exists
      const user = await this.userRepository.findOne({
        where: { firebaseUid },
      });

      if (!user) {
        throw new NotFoundException(CAMPAIGN_ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Verify campaign exists and belongs to the user
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId, advertiserId: user.id },
      });

      if (!campaign) {
        throw new NotFoundException(CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND);
      }

      // Generate unique file key using helper
      const fileKey = FileValidationHelper.generateFileKey(
        firebaseUid,
        file.originalname,
        uuidv4(),
      );

      // Upload to S3
      const uploadResult = await this.s3Service.uploadFile(
        file.buffer,
        fileKey,
        file.mimetype,
        S3FileType.CAMPAIGN_PRODUCT,
        user.id,
        {
          campaignId: campaignId,
        },
      );

      // Update campaign with media URL
      campaign.mediaUrl = uploadResult.publicUrl;
      const updatedCampaign = await this.campaignRepository.save(campaign);

      // Convert entity to interface using helper
      const campaignResponse =
        CampaignEntityMapper.entityToInterface(updatedCampaign);

      return {
        success: true,
        message: CAMPAIGN_SUCCESS_MESSAGES.FILE_UPLOADED,
        fileUrl: uploadResult.publicUrl,
        campaign: campaignResponse,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to upload file',
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
      // Verify user exists and is an advertiser
      const user = await this.userRepository.findOne({
        where: { firebaseUid },
      });

      if (!user) {
        throw new NotFoundException(CAMPAIGN_ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Validate campaign data using helper
      CampaignValidationHelper.validateCampaignByType(campaignData as Campaign);

      // Build campaign entity using helper
      const campaign = CampaignEntityBuilder.buildCampaignEntity(
        campaignData,
        user.id,
      );

      // Financial validation and budget allocation
      if (campaign.budgetAllocated && campaign.budgetAllocated > 0) {
        await this.validateAndAllocateCampaignBudget(
          user.id,
          campaign.budgetAllocated,
        );
      }

      // Save campaign first to get its ID
      const savedCampaign = await this.campaignRepository.save(campaign);

      // Create budget tracking record if budget was allocated
      if (savedCampaign.budgetAllocated && savedCampaign.budgetAllocated > 0) {
        await this.createCampaignBudgetTracking(savedCampaign);
      }

      // Create deliverable entities based on campaign type
      if (campaignData.type === CampaignType.CONSULTANT) {
        const consultantData = campaignData as ConsultantCampaign;
        if (consultantData.expectedDeliverables?.length > 0) {
          // Extract deliverable enum values from CampaignDeliverable objects
          const deliverableEnums = consultantData.expectedDeliverables.map(
            (cd) => cd.deliverable,
          );
          const deliverableEntities = await this.createDeliverableEntities(
            savedCampaign.id,
            deliverableEnums,
          );

          // Update the campaign with deliverable IDs
          savedCampaign.expectedDeliverableIds = deliverableEntities.map(
            (d) => d.id,
          );
          await this.campaignRepository.save(savedCampaign);
        }
      }

      if (campaignData.type === CampaignType.SELLER) {
        const sellerData = campaignData as SellerCampaign;
        if (sellerData.deliverables && sellerData.deliverables.length > 0) {
          // Extract deliverable enum values from CampaignDeliverable objects
          const deliverableEnums = sellerData.deliverables.map(
            (cd) => cd.deliverable,
          );
          const deliverableEntities = await this.createDeliverableEntities(
            savedCampaign.id,
            deliverableEnums,
          );

          // Update the campaign with deliverable IDs
          savedCampaign.deliverableIds = deliverableEntities.map((d) => d.id);
          await this.campaignRepository.save(savedCampaign);
        }
      }

      // Convert entity to interface using helper
      const campaignResponse =
        CampaignEntityMapper.entityToInterface(savedCampaign);

      return {
        success: true,
        message: CAMPAIGN_SUCCESS_MESSAGES.CAMPAIGN_CREATED,
        campaign: campaignResponse,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_CREATION_FAILED,
      );
    }
  }

  /**
   * Creates deliverable entities from deliverable enum values
   */
  private async createDeliverableEntities(
    campaignId: string,
    deliverables: Deliverable[],
  ): Promise<CampaignDeliverableEntity[]> {
    const deliverableEntities = deliverables.map((deliverable) => {
      const entity = new CampaignDeliverableEntity();
      entity.campaignId = campaignId;
      entity.deliverable = deliverable;
      entity.isSubmitted = false;
      entity.isFinished = false;
      return entity;
    });

    return await this.deliverableRepository.save(deliverableEntities);
  }

  /**
   * Validates that advertiser has sufficient funds and allocates budget for campaign
   * Updates wallet to hold funds for the campaign
   */
  private async validateAndAllocateCampaignBudget(
    advertiserId: string,
    budgetDollars: number,
  ): Promise<void> {
    // Get or create advertiser wallet
    const wallet = await this.walletRepository.findOne({
      where: { userId: advertiserId, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      throw new BadRequestException(
        'Advertiser wallet not found. Please add funds to your wallet first.',
      );
    }

    // Calculate available balance (current balance minus already held amounts)
    const availableBalance =
      wallet.currentBalance - (wallet.heldForCampaigns || 0);

    if (availableBalance < budgetDollars) {
      const shortfall = budgetDollars - availableBalance;
      throw new BadRequestException(
        `Insufficient funds. You need an additional $${shortfall.toFixed(2)} to create this campaign. ` +
          `Available: $${availableBalance.toFixed(2)}, Required: $${budgetDollars.toFixed(2)}`,
      );
    }

    // Hold the budget amount for this campaign
    wallet.heldForCampaigns = (wallet.heldForCampaigns || 0) + budgetDollars;
    await this.walletRepository.save(wallet);

    // Create transaction record for audit trail
    const transaction = this.transactionRepository.create({
      userId: advertiserId,
      userType: UserType.ADVERTISER,
      type: TransactionType.CAMPAIGN_FUNDING,
      amount: -budgetDollars, // Negative for money held/allocated
      status: TransactionStatus.COMPLETED,
      description: `Budget allocated for campaign creation - $${budgetDollars.toFixed(2)}`,
      paymentMethod: PaymentMethod.WALLET, // Using wallet funds
    });

    await this.transactionRepository.save(transaction);
  }

  /**
   * Creates budget tracking record for campaign management
   */
  private async createCampaignBudgetTracking(
    campaign: CampaignEntity,
  ): Promise<void> {
    const budgetCents = Math.round((campaign.budgetAllocated || 0) * 100);

    const budgetTracking = this.campaignBudgetTrackingRepository.create({
      campaignId: campaign.id,
      advertiserId: campaign.advertiserId,
      allocatedBudgetCents: budgetCents,
      spentBudgetCents: 0,
      platformFeesCollectedCents: 0,
      // Set campaign-type specific rates
      cpvCents: campaign.cpv ? Math.round(campaign.cpv * 100) : null,
      commissionRate: campaign.commissionPerSale || null,
    });

    await this.campaignBudgetTrackingRepository.save(budgetTracking);
  }
}
