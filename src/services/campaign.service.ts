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
import { S3Service, S3FileType } from './s3.service';
import { Campaign } from '../interfaces/campaign';

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

      // Save campaign
      const savedCampaign = await this.campaignRepository.save(campaign);

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
}
