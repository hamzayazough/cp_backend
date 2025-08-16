import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from 'src/database/entities/campaign.entity';
import { PromoterCampaign } from '../../database/entities/promoter-campaign.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../../database/entities/campaign-applications.entity';
import {
  GetAdvertiserDashboardRequest,
  AdvertiserDashboardData,
} from '../../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  CampaignFilters,
  CampaignAdvertiser,
} from '../../interfaces/advertiser-campaign';
import { AdvertiserCampaignService } from './advertiser-campaign.service';
import { AdvertiserWalletService } from './advertiser-wallet.service';
import { AdvertiserStatsService } from './advertiser-stats.service';
import { AdvertiserTransactionService } from './advertiser-transaction.service';
import { AdvertiserMessageService } from './advertiser-message.service';
import { ReviewCampaignApplicationResult } from '../../interfaces/review-campaign-application-result';
import { S3Service } from '../s3.service';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../notification-delivery.service';
import { NotificationHelperService } from '../notifications/notification-helper.service';
import { NotificationType } from '../../enums/notification-type';
import { NotificationDeliveryMethod } from '../../enums/notification-delivery-method';
import { CAMPAIGN_MANAGEMENT_BUILDERS } from './advertiser-campaign-helper.constants';
import {
  ADVERTISER_RELATIONS,
  ADVERTISER_SERVICE_MESSAGES,
  ADVERTISER_SERVICE_VALIDATORS,
  ADVERTISER_SERVICE_UTILS,
  ADVERTISER_SERVICE_TRANSFORMERS,
  ADVERTISER_SERVICE_BUILDERS,
} from './advertiser-service-helper.constants';

@Injectable()
export class AdvertiserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    private campaignService: AdvertiserCampaignService,
    private walletService: AdvertiserWalletService,
    private statsService: AdvertiserStatsService,
    private transactionService: AdvertiserTransactionService,
    private messageService: AdvertiserMessageService,
    private readonly s3Service: S3Service,
    private readonly notificationDeliveryService: NotificationDeliveryService,
    private readonly notificationHelperService: NotificationHelperService,
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: GetAdvertiserDashboardRequest,
  ): Promise<AdvertiserDashboardData> {
    const advertiser = await this.userRepository.findOne(
      ADVERTISER_SERVICE_TRANSFORMERS.createAdvertiserLookupWithRelations(
        firebaseUid,
        ADVERTISER_RELATIONS.DASHBOARD,
      ),
    );

    const validatedAdvertiser =
      ADVERTISER_SERVICE_VALIDATORS.validateAdvertiserExists(advertiser);

    const data: AdvertiserDashboardData = {
      stats: await this.statsService.getAdvertiserStats(validatedAdvertiser.id),
      activeCampaigns: await this.campaignService.getActiveCampaigns(
        validatedAdvertiser.id,
        request.activeCampaignLimit || 10,
      ),
      recentTransactions: await this.transactionService.getRecentTransactions(
        validatedAdvertiser,
        request.transactionLimit || 10,
      ),
      recentMessages: await this.messageService.getRecentMessages(
        validatedAdvertiser.id,
        request.messageLimit || 10,
      ),
      wallet: await this.walletService.getWalletInfo(validatedAdvertiser.id),
    };

    return data;
  }

  async getCampaignsList(
    firebaseUid: string,
    request: AdvertiserCampaignListRequest,
  ): Promise<AdvertiserCampaignListResponse> {
    const advertiser = await this.userRepository.findOne(
      ADVERTISER_SERVICE_TRANSFORMERS.createAdvertiserLookup(firebaseUid),
    );

    const validatedAdvertiser =
      ADVERTISER_SERVICE_VALIDATORS.validateAdvertiserExists(advertiser);

    return this.campaignService.getCampaignsList(
      validatedAdvertiser.id,
      request,
    );
  }

  getCampaignFilters(): CampaignFilters {
    return this.campaignService.getCampaignFilters();
  }

  async reviewCampaignApplication(
    firebaseUid: string,
    campaignId: string,
    applicationId: string,
    status: ApplicationStatus.ACCEPTED | ApplicationStatus.REJECTED,
  ): Promise<ReviewCampaignApplicationResult> {
    // Get advertiser with campaigns and applications
    const advertiser = await this.userRepository.findOne(
      ADVERTISER_SERVICE_TRANSFORMERS.createAdvertiserLookupWithRelations(
        firebaseUid,
        ADVERTISER_RELATIONS.CAMPAIGN_MANAGEMENT,
      ),
    );
    const validatedAdvertiser =
      ADVERTISER_SERVICE_VALIDATORS.validateAdvertiserExists(advertiser);

    // Find campaign within advertiser's campaigns
    const campaign = ADVERTISER_SERVICE_UTILS.findCampaignById(
      validatedAdvertiser,
      campaignId,
    );
    const validatedCampaign =
      ADVERTISER_SERVICE_VALIDATORS.validateCampaignExists(campaign);

    // Find application within campaign's applications
    const application = ADVERTISER_SERVICE_UTILS.findApplicationInCampaign(
      validatedCampaign,
      applicationId,
    );
    const validatedApplication =
      ADVERTISER_SERVICE_VALIDATORS.validateApplicationExists(application);

    // Update application status
    await this.updateApplicationStatus(validatedApplication, status);

    // Create promoter campaign if accepted
    // Note: updateApplicationStatus automatically deletes other pending applications when accepting
    if (status === ApplicationStatus.ACCEPTED) {
      await this.createPromoterCampaignIfNotExists(
        validatedApplication.promoterId,
        campaignId,
      );
    }

    // Send notifications about the application review
    await this.sendApplicationReviewNotification(
      validatedCampaign,
      validatedApplication,
      status,
    );

    return CAMPAIGN_MANAGEMENT_BUILDERS.buildApplicationReviewResult(
      validatedApplication.id,
      status,
      campaignId,
      validatedApplication.promoterId,
    );
  }

  async deleteCampaign(
    firebaseUid: string,
    campaignId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get advertiser with campaigns and applications
      const advertiser = await this.userRepository.findOne(
        ADVERTISER_SERVICE_TRANSFORMERS.createAdvertiserLookupWithRelations(
          firebaseUid,
          ADVERTISER_RELATIONS.CAMPAIGN_MANAGEMENT,
        ),
      );
      const validatedAdvertiser =
        ADVERTISER_SERVICE_VALIDATORS.validateAdvertiserExists(advertiser);

      // Find campaign within advertiser's campaigns
      const campaign = ADVERTISER_SERVICE_UTILS.findCampaignById(
        validatedAdvertiser,
        campaignId,
      );
      const validatedCampaign =
        ADVERTISER_SERVICE_VALIDATORS.validateCampaignExists(campaign);

      // Check if campaign can be deleted (no accepted applications)
      const acceptedApplicationCount =
        ADVERTISER_SERVICE_UTILS.countPromoterCampaignsFromApplications(
          validatedCampaign,
        );
      ADVERTISER_SERVICE_VALIDATORS.validateCampaignCanBeDeleted(
        acceptedApplicationCount,
      );

      // Delete media from S3 if exists
      if (validatedCampaign.media && validatedCampaign.media.length > 0) {
        for (const media of validatedCampaign.media) {
          await this.deleteCampaignMediaFromS3(media.mediaUrl);
        }
      }

      // Delete campaign using userRepository to maintain entity relationships
      await this.userRepository.manager.transaction(async (manager) => {
        await manager.delete('campaigns', campaignId);
      });

      // Send notification to advertiser about campaign deletion
      await this.sendCampaignDeletedNotification(
        validatedCampaign,
        validatedAdvertiser,
      );

      return ADVERTISER_SERVICE_BUILDERS.buildCampaignDeletionResponse(
        true,
        ADVERTISER_SERVICE_MESSAGES.CAMPAIGN_DELETION_SUCCESS,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : ADVERTISER_SERVICE_MESSAGES.CAMPAIGN_NOT_FOUND;
      return ADVERTISER_SERVICE_BUILDERS.buildCampaignDeletionResponse(
        false,
        errorMessage,
      );
    }
  }

  async getCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignAdvertiser> {
    const advertiser = await this.userRepository.findOne(
      ADVERTISER_SERVICE_TRANSFORMERS.createAdvertiserLookup(firebaseUid),
    );

    const validatedAdvertiser =
      ADVERTISER_SERVICE_VALIDATORS.validateAdvertiserExists(advertiser);

    return this.campaignService.getCampaignById(
      validatedAdvertiser.id,
      campaignId,
    );
  }

  /**
   * Helper method to update application status using entity manager
   */
  private async updateApplicationStatus(
    application: CampaignApplicationEntity,
    status: ApplicationStatus.ACCEPTED | ApplicationStatus.REJECTED,
  ): Promise<void> {
    await this.userRepository.manager.transaction(async (manager) => {
      // Update the current application status
      application.status = status;
      await manager.save(application);

      // If accepted, delete all other pending applications for this campaign
      if (status === ApplicationStatus.ACCEPTED) {
        await manager
          .createQueryBuilder()
          .delete()
          .from('campaign_applications')
          .where('campaign_id = :campaignId', {
            campaignId: application.campaignId,
          })
          .andWhere('status = :status', { status: ApplicationStatus.PENDING })
          .execute();
      }
    });
  }

  /**
   * Helper method to create promoter campaign if it doesn't exist
   */
  private async createPromoterCampaignIfNotExists(
    promoterId: string,
    campaignId: string,
  ): Promise<void> {
    const existingPromoterCampaign =
      await this.promoterCampaignRepository.findOne({
        where: {
          promoterId: promoterId,
          campaignId: campaignId,
        },
      });

    if (!existingPromoterCampaign) {
      const promoterCampaign =
        CAMPAIGN_MANAGEMENT_BUILDERS.buildPromoterCampaignFromApplication(
          promoterId,
          campaignId,
        );
      await this.promoterCampaignRepository.save(promoterCampaign);
    }
  }

  /**
   * Helper method to delete campaign media from S3
   */
  private async deleteCampaignMediaFromS3(mediaUrl: string): Promise<void> {
    try {
      const key = this.s3Service.extractKeyFromUrl(mediaUrl);
      await this.s3Service.deleteObject(key);
    } catch (err) {
      // Log error but continue with campaign deletion
      console.error(ADVERTISER_SERVICE_MESSAGES.S3_DELETION_ERROR, err);
    }
  }

  // ============================================================================
  // NOTIFICATION HELPER METHODS
  // ============================================================================

  /**
   * Send notification when a campaign is deleted
   */
  private async sendCampaignDeletedNotification(
    campaign: CampaignEntity,
    advertiser: UserEntity,
  ): Promise<void> {
    try {
      // Get delivery methods first
      const deliveryMethods = await this.getNotificationMethods(
        advertiser.id,
        NotificationType.CAMPAIGN_ENDED,
      );

      const notificationData: NotificationDeliveryData = {
        userId: advertiser.id,
        notificationType: NotificationType.CAMPAIGN_ENDED,
        title: 'Campaign Deleted',
        message: `Your campaign "${campaign.title}" has been successfully deleted. All associated data has been removed from the system.`,
        deliveryMethods,
        metadata: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          campaignType: campaign.type,
          deletedAt: new Date().toISOString(),
        },
        campaignId: campaign.id,
      };

      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to send campaign deletion notification:', error);
    }
  }

  /**
   * Send notification when a campaign application is reviewed
   */
  private async sendApplicationReviewNotification(
    campaign: CampaignEntity,
    application: CampaignApplicationEntity,
    status: ApplicationStatus.ACCEPTED | ApplicationStatus.REJECTED,
  ): Promise<void> {
    try {
      // Get the promoter who applied
      const promoter = await this.userRepository.findOne({
        where: { id: application.promoterId },
      });

      if (!promoter) {
        console.error(
          'Promoter not found for notification:',
          application.promoterId,
        );
        return;
      }

      // Determine notification type and message based on status
      const notificationType =
        status === ApplicationStatus.ACCEPTED
          ? NotificationType.CAMPAIGN_APPLICATION_ACCEPTED
          : NotificationType.CAMPAIGN_APPLICATION_REJECTED;

      const title =
        status === ApplicationStatus.ACCEPTED
          ? '🎉 Application Accepted!'
          : '📋 Application Update';

      const message =
        status === ApplicationStatus.ACCEPTED
          ? `Congratulations! Your application for "${campaign.title}" has been accepted. You can now start working on this campaign.`
          : `Your application for "${campaign.title}" was not selected this time. Don't worry, there are many other opportunities available!`;

      // Get delivery methods
      const deliveryMethods = await this.getNotificationMethods(
        promoter.id,
        notificationType,
      );

      const notificationData: NotificationDeliveryData = {
        userId: promoter.id,
        notificationType,
        title,
        message,
        deliveryMethods,
        metadata: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          campaignType: campaign.type,
          applicationId: application.id,
          applicationStatus: status,
          reviewedAt: new Date().toISOString(),
        },
        campaignId: campaign.id,
      };

      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to send application review notification:', error);
    }
  }

  /**
   * Get user's preferred notification delivery methods for a specific notification type
   */
  private async getNotificationMethods(
    userId: string,
    notificationType: NotificationType,
  ): Promise<NotificationDeliveryMethod[]> {
    return this.notificationHelperService.getNotificationMethods(
      userId,
      notificationType,
    );
  }
}
