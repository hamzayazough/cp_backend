import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { PromoterCampaign } from '../../database/entities/promoter-campaign.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { PromoterDetailsEntity } from '../../database/entities/promoter-details.entity';
import { CampaignBudgetTracking } from '../../database/entities/campaign-budget-tracking.entity';
import { UniqueViewEntity } from '../../database/entities/unique-view.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { CampaignStatus } from '../../enums/campaign-status';
import { PromoterCampaignStatus } from '../../database/entities/promoter-campaign.entity';
import { CampaignType } from '../../enums/campaign-type';
import {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../../database/entities/transaction.entity';
import { UserType } from '../../enums/user-type';
import {
  CampaignCompletionResult,
  PromoterCampaignStatsUpdate,
} from '../../interfaces/campaign-management';
import { PromoterPaymentService } from '../promoter/promoter-payment.service';
import {
  CAMPAIGN_COMPLETION_MESSAGES,
  TRANSACTION_DESCRIPTIONS,
  CampaignBudgetCalculator,
  CampaignTypeValidator,
  CampaignValidator,
  CAMPAIGN_MANAGEMENT_ERROR_MESSAGES,
  CAMPAIGN_COMPLETION_STATUS,
} from './campaign-management-helper.constants';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../notification-delivery.service';
import { NotificationHelperService } from '../notification-helper.service';
import { NotificationType } from '../../enums/notification-type';

/**
 * Service responsible for completing campaigns and updating related entities
 */
@Injectable()
export class CampaignCompletionService {
  private readonly logger = new Logger(CampaignCompletionService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private readonly campaignBudgetTrackingRepository: Repository<CampaignBudgetTracking>,
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepository: Repository<UniqueViewEntity>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly promoterPaymentService: PromoterPaymentService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {}

  /**
   * Complete a single campaign and update all related entities
   * @param campaignId - ID of the campaign to complete
   * @param isExpiration - Whether this completion is due to campaign expiration (default: false)
   */
  async completeCampaign(
    campaignId: string,
    isExpiration: boolean = false,
  ): Promise<CampaignCompletionResult> {
    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.GENERAL.COMPLETION_STARTING(campaignId),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Update campaign status to INACTIVE
      const campaign = await queryRunner.manager.findOne(CampaignEntity, {
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error(CAMPAIGN_MANAGEMENT_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND);
      }

      campaign.status = CampaignStatus.INACTIVE;
      await queryRunner.manager.save(campaign);

      // 2. Get all promoter campaigns for this campaign
      const promoterCampaigns = await queryRunner.manager.find(
        PromoterCampaign,
        {
          where: { campaignId },
          relations: ['promoter'],
        },
      );

      // 3. Update promoter campaign statuses
      const completedAt = new Date();
      const promoterCampaignUpdates = promoterCampaigns.map((pc) => ({
        ...pc,
        status: PromoterCampaignStatus.COMPLETED,
        completedAt,
      }));

      await queryRunner.manager.save(PromoterCampaign, promoterCampaignUpdates);

      // 4. Update promoter details and user statistics
      const statsUpdates: PromoterCampaignStatsUpdate[] = [];

      for (const promoterCampaign of promoterCampaigns) {
        const statsUpdate = await this.updatePromoterStatistics(
          queryRunner.manager,
          promoterCampaign.promoterId,
          campaign.type,
        );
        statsUpdates.push(statsUpdate);
      }

      await queryRunner.commitTransaction();

      // 5. Process budget reconciliation for CONSULTANT and SELLER campaigns
      // This is done after transaction commit to avoid payment failures affecting campaign completion
      await this.processBudgetReconciliation(campaign, promoterCampaigns);

      // 6. Send notifications to all campaign participants about completion
      try {
        await this.notifyCampaignParticipants(
          campaign,
          promoterCampaigns,
          isExpiration,
        );
      } catch (notificationError) {
        this.logger.error(
          `Failed to send campaign completion notifications for campaign ${campaignId}:`,
          notificationError,
        );
        // Don't throw error - campaign completion was successful, notifications are a bonus feature
      }

      const result: CampaignCompletionResult = {
        campaignId,
        completedAt,
        affectedPromoterCampaigns: promoterCampaigns.length,
        updatedPromoterDetails: statsUpdates.length,
        updatedUserStats: statsUpdates.length,
      };

      this.logger.log(
        CAMPAIGN_COMPLETION_MESSAGES.GENERAL.COMPLETION_SUCCESS(
          campaignId,
          result.affectedPromoterCampaigns,
          true, // Budget reconciliation was processed
        ),
      );

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        CAMPAIGN_COMPLETION_MESSAGES.GENERAL.COMPLETION_FAILED(campaignId),
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Complete multiple campaigns in batch
   * @param campaignIds - Array of campaign IDs to complete
   * @param isExpiration - Whether these completions are due to campaign expiration (default: false)
   */
  async completeCampaignsBatch(
    campaignIds: string[],
    isExpiration: boolean = false,
  ): Promise<CampaignCompletionResult[]> {
    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.GENERAL.BATCH_STARTING(campaignIds.length),
    );

    const results: CampaignCompletionResult[] = [];

    for (const campaignId of campaignIds) {
      try {
        const result = await this.completeCampaign(campaignId, isExpiration);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to complete campaign ${campaignId} in batch:`,
          error,
        );
      }
    }

    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.GENERAL.BATCH_RESULTS(
        results.length,
        campaignIds.length,
      ),
    );

    return results;
  }

  /**
   * Update promoter statistics for campaign completion
   * @param manager - Transaction manager
   * @param promoterId - ID of the promoter
   * @param campaignType - Type of the completed campaign
   */
  private async updatePromoterStatistics(
    manager: EntityManager,
    promoterId: string,
    campaignType: CampaignType,
  ): Promise<PromoterCampaignStatsUpdate> {
    // Update promoter details
    const promoterDetails = await manager.findOne(PromoterDetailsEntity, {
      where: { userId: promoterId },
    });

    if (!promoterDetails) {
      throw new Error(
        CAMPAIGN_MANAGEMENT_ERROR_MESSAGES.PROMOTER_DETAILS_NOT_FOUND,
      );
    }

    promoterDetails.numberOfCampaignDone += 1;
    await manager.save(promoterDetails);

    // Update user entity campaign type statistics
    const user = await manager.findOne(UserEntity, {
      where: { id: promoterId },
    });

    if (!user) {
      throw new Error(CAMPAIGN_MANAGEMENT_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    this.updateUserCampaignTypeStatistics(user, campaignType);
    await manager.save(user);

    return {
      promoterId,
      campaignType,
      numberOfCampaignDone: promoterDetails.numberOfCampaignDone,
      userNumberOfCampaignDone: this.getUserCampaignTypeCount(
        user,
        campaignType,
      ),
    };
  }

  /**
   * Process budget reconciliation for campaigns
   * - VISIBILITY: Release unused heldForCampaigns funds back to advertiser
   * - CONSULTANT/SELLER: Pay remaining minBudget to promoters
   */
  private async processBudgetReconciliation(
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
  ): Promise<void> {
    if (!CampaignTypeValidator.requiresReconciliation(campaign.type)) {
      return;
    }

    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.GENERAL.STARTING(campaign.type, campaign.id),
    );

    try {
      if (CampaignTypeValidator.isVisibilityCampaign(campaign.type)) {
        await this.processVisibilityBudgetReconciliation(campaign);
      } else if (
        CampaignTypeValidator.isConsultantOrSellerCampaign(campaign.type)
      ) {
        await this.processConsultantSellerBudgetReconciliation(
          campaign,
          promoterCampaigns,
        );
      }
    } catch (error) {
      this.logger.error(
        CAMPAIGN_COMPLETION_MESSAGES.GENERAL.RECONCILIATION_FAILED(campaign.id),
        error,
      );
      // Don't throw error to avoid failing the entire campaign completion
    }
  }

  /**
   * Process budget reconciliation for VISIBILITY campaigns
   * Releases unused heldForCampaigns funds back to advertiser wallet
   */
  private async processVisibilityBudgetReconciliation(
    campaign: CampaignEntity,
  ): Promise<void> {
    // Validate campaign has CPV set
    const validation = CampaignValidator.validateVisibilityCampaign(campaign);
    if (!validation.isValid) {
      this.logger.warn(validation.reason);
      return;
    }

    // Calculate actual money used based on unique views
    const totalUniqueViews = await this.getTotalUniqueViewsForCampaign(
      campaign.id,
    );
    const actualSpentDollars =
      CampaignBudgetCalculator.calculateVisibilityActualSpent(
        totalUniqueViews,
        campaign.cpv!,
      );

    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.ANALYSIS(
        campaign.id,
        totalUniqueViews,
        campaign.cpv!,
        actualSpentDollars,
      ),
    );

    // Get advertiser wallet and calculate funds to release
    const advertiserWallet = await this.getAdvertiserWallet(
      campaign.advertiserId,
    );
    if (!advertiserWallet) {
      this.logger.error(
        CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.NO_WALLET(campaign.id),
      );
      return;
    }

    const currentHeldFunds = advertiserWallet.heldForCampaigns || 0;
    const fundsToRelease = CampaignBudgetCalculator.calculateFundsToRelease(
      currentHeldFunds,
      actualSpentDollars,
    );

    if (!CampaignValidator.shouldReleaseFunds(fundsToRelease)) {
      this.logger.log(
        CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.NO_FUNDS_TO_RELEASE(
          campaign.id,
        ),
      );
      return;
    }

    // Release the unused funds
    await this.releaseUnusedHeldFunds(
      campaign,
      advertiserWallet,
      fundsToRelease,
      actualSpentDollars,
    );
  }

  /**
   * Process budget reconciliation for CONSULTANT and SELLER campaigns
   * Pays remaining minBudget amount to promoters if not fully spent
   */
  private async processConsultantSellerBudgetReconciliation(
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
  ): Promise<void> {
    // Validate campaign has minBudget set
    const validation =
      CampaignValidator.validateConsultantSellerCampaign(campaign);
    if (!validation.isValid) {
      this.logger.warn(validation.reason);
      return;
    }

    try {
      // Get budget tracking for this campaign
      const budgetTracking = await this.getBudgetTracking(campaign.id);
      if (!budgetTracking) {
        this.logger.warn(
          CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.NO_BUDGET_TRACKING(
            campaign.id,
          ),
        );
        return;
      }

      // Calculate remaining budget using helper
      const minBudgetCents = CampaignBudgetCalculator.convertMinBudgetToCents(
        campaign.minBudget!,
      );
      const spentBudgetCents = budgetTracking.spentBudgetCents;
      const remainingBudgetCents =
        CampaignBudgetCalculator.calculateRemainingBudgetCents(
          minBudgetCents,
          spentBudgetCents,
        );

      this.logger.log(
        CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.ANALYSIS(
          campaign.id,
          campaign.minBudget!,
          CampaignBudgetCalculator.centsToDollars(spentBudgetCents),
          CampaignBudgetCalculator.centsToDollars(remainingBudgetCents),
        ),
      );

      if (
        !CampaignValidator.shouldDistributeRemainingBudget(remainingBudgetCents)
      ) {
        this.logger.log(
          CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.FULLY_UTILIZED(
            campaign.id,
          ),
        );
        return;
      }

      // Process payments to promoters
      await this.payRemainingBudgetToPromoters(
        campaign,
        promoterCampaigns,
        remainingBudgetCents,
      );
    } catch (error) {
      this.logger.error(
        CAMPAIGN_COMPLETION_MESSAGES.GENERAL.RECONCILIATION_FAILED(campaign.id),
        error,
      );
      // Don't throw error to avoid failing the entire campaign completion
    }
  }

  /**
   * Get budget tracking for a campaign
   */
  private async getBudgetTracking(
    campaignId: string,
  ): Promise<CampaignBudgetTracking | null> {
    return await this.campaignBudgetTrackingRepository.findOne({
      where: { campaignId },
    });
  }

  /**
   * Get total unique views for a campaign
   */
  private async getTotalUniqueViewsForCampaign(
    campaignId: string,
  ): Promise<number> {
    const result: { count: string } | undefined =
      await this.uniqueViewRepository
        .createQueryBuilder('unique_view')
        .select('COUNT(*)', 'count')
        .where('unique_view.campaignId = :campaignId', { campaignId })
        .getRawOne();

    return parseInt(result?.count || '0', 10);
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
   * Release unused held funds back to advertiser wallet
   */
  private async releaseUnusedHeldFunds(
    campaign: CampaignEntity,
    advertiserWallet: Wallet,
    fundsToRelease: number,
    actualSpentDollars: number,
  ): Promise<void> {
    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.RELEASING_FUNDS(
        fundsToRelease,
        campaign.id,
      ),
    );

    // Update wallet balances
    advertiserWallet.heldForCampaigns =
      (advertiserWallet.heldForCampaigns || 0) - fundsToRelease;

    await this.walletRepository.save(advertiserWallet);

    // Create transaction record for the fund release
    await this.createFundReleaseTransaction(
      campaign,
      fundsToRelease,
      actualSpentDollars,
    );

    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.VISIBILITY.FUNDS_RELEASED(
        fundsToRelease,
        campaign.id,
      ),
    );
  }

  /**
   * Create transaction record for fund release
   */
  private async createFundReleaseTransaction(
    campaign: CampaignEntity,
    releasedAmount: number,
    actualSpentAmount: number,
  ): Promise<void> {
    const transaction = this.transactionRepository.create({
      userId: campaign.advertiserId,
      userType: UserType.ADVERTISER,
      campaignId: campaign.id,
      type: TransactionType.CAMPAIGN_FUNDING, // Positive transaction for released funds
      amount: releasedAmount,
      grossAmountCents: Math.round(releasedAmount * 100),
      platformFeeCents: 0,
      status: TransactionStatus.COMPLETED,
      description: TRANSACTION_DESCRIPTIONS.FUND_RELEASE(actualSpentAmount),
      paymentMethod: PaymentMethod.WALLET,
    });

    await this.transactionRepository.save(transaction);
  }

  /**
   * Pay remaining budget to promoters equally
   */
  private async payRemainingBudgetToPromoters(
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
    remainingBudgetCents: number,
  ): Promise<void> {
    if (promoterCampaigns.length === 0) {
      this.logger.warn(
        CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.NO_PROMOTERS(
          campaign.id,
        ),
      );
      return;
    }

    // Get advertiser user for payment processing
    const advertiser = await this.userRepository.findOne({
      where: { id: campaign.advertiserId },
    });

    if (!advertiser) {
      this.logger.error(
        CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.NO_ADVERTISER(
          campaign.id,
        ),
      );
      return;
    }

    // Calculate payment per promoter (split equally)
    const paymentPerPromoterCents =
      CampaignBudgetCalculator.calculatePaymentPerPromoter(
        remainingBudgetCents,
        promoterCampaigns.length,
      );

    if (!CampaignValidator.isPaymentAmountValid(paymentPerPromoterCents)) {
      this.logger.log(
        CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.AMOUNT_TOO_SMALL(
          promoterCampaigns.length,
        ),
      );
      return;
    }

    this.logger.log(
      CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.DISTRIBUTING(
        CampaignBudgetCalculator.centsToDollars(paymentPerPromoterCents),
        promoterCampaigns.length,
      ),
    );

    // Process payments to each promoter
    for (const promoterCampaign of promoterCampaigns) {
      try {
        await this.processPromoterReconciliationPayment(
          advertiser.firebaseUid,
          campaign.id,
          promoterCampaign.promoterId,
          paymentPerPromoterCents,
        );

        this.logger.log(
          CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.PAYMENT_SUCCESS(
            promoterCampaign.promoterId,
          ),
        );
      } catch (error) {
        this.logger.error(
          CAMPAIGN_COMPLETION_MESSAGES.CONSULTANT_SELLER.PAYMENT_FAILED(
            promoterCampaign.promoterId,
          ),
          error,
        );
      }
    }
  }

  /**
   * Process a single reconciliation payment to a promoter
   */
  private async processPromoterReconciliationPayment(
    advertiserFirebaseUid: string,
    campaignId: string,
    promoterId: string,
    amountCents: number,
  ): Promise<void> {
    const payPromoterDto = {
      campaignId,
      promoterId,
      amount: amountCents,
      transactionType: TransactionType.DIRECT_PAYMENT,
    };

    await this.promoterPaymentService.payPromoter(
      advertiserFirebaseUid,
      payPromoterDto,
    );
  }

  /**
   * Update user campaign type specific statistics
   * @param user - User entity to update
   * @param campaignType - Type of the completed campaign
   */
  private updateUserCampaignTypeStatistics(
    user: UserEntity,
    campaignType: CampaignType,
  ): void {
    switch (campaignType) {
      case CampaignType.VISIBILITY:
        user.numberOfVisibilityCampaignDone =
          (user.numberOfVisibilityCampaignDone || 0) + 1;
        break;
      case CampaignType.CONSULTANT:
        user.numberOfConsultantCampaignDone =
          (user.numberOfConsultantCampaignDone || 0) + 1;
        break;
      case CampaignType.SELLER:
        user.numberOfSellerCampaignDone =
          (user.numberOfSellerCampaignDone || 0) + 1;
        break;
      case CampaignType.SALESMAN:
        user.numberOfSalesmanCampaignDone =
          (user.numberOfSalesmanCampaignDone || 0) + 1;
        break;
    }
  }

  /**
   * Get user campaign type specific count
   * @param user - User entity
   * @param campaignType - Type of campaign
   */
  private getUserCampaignTypeCount(
    user: UserEntity,
    campaignType: CampaignType,
  ): number {
    switch (campaignType) {
      case CampaignType.VISIBILITY:
        return user.numberOfVisibilityCampaignDone || 0;
      case CampaignType.CONSULTANT:
        return user.numberOfConsultantCampaignDone || 0;
      case CampaignType.SELLER:
        return user.numberOfSellerCampaignDone || 0;
      case CampaignType.SALESMAN:
        return user.numberOfSalesmanCampaignDone || 0;
      default:
        return 0;
    }
  }

  /**
   * Get campaigns that should be completed today
   */
  async getCampaignsToCompleteToday(): Promise<CampaignEntity[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    return await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', {
        status: CAMPAIGN_COMPLETION_STATUS.ACTIVE,
      })
      .andWhere('campaign.deadline IS NOT NULL')
      .andWhere('campaign.deadline <= :today', { today })
      .getMany();
  }

  /**
   * Notify all campaign participants about campaign completion and request reviews
   * @param campaign - The completed campaign
   * @param promoterCampaigns - Array of promoter campaigns
   * @param isExpiration - Whether this completion is due to campaign expiration
   */
  private async notifyCampaignParticipants(
    campaign: CampaignEntity,
    promoterCampaigns: PromoterCampaign[],
    isExpiration: boolean = false,
  ): Promise<void> {
    this.logger.log(
      `Notifying participants for completed campaign: ${campaign.id}`,
    );

    // Collect all participant IDs
    const participants: Array<{ id: string; isAdvertiser: boolean }> = [];

    // Add advertiser
    participants.push({
      id: campaign.advertiserId,
      isAdvertiser: true,
    });

    // Add all promoters who participated in the campaign
    promoterCampaigns.forEach((promoterCampaign) => {
      participants.push({
        id: promoterCampaign.promoterId,
        isAdvertiser: false,
      });
    });

    this.logger.log(
      `Found ${participants.length} participants to notify for campaign: ${campaign.id}`,
    );

    // Send notifications to all participants
    for (const participant of participants) {
      try {
        // Get notification delivery methods for this participant
        const notificationType = isExpiration
          ? NotificationType.CAMPAIGN_EXPIRED
          : NotificationType.CAMPAIGN_ENDED;

        const deliveryMethods =
          await this.notificationHelperService.getNotificationMethods(
            participant.id,
            notificationType,
          );

        if (deliveryMethods.length === 0) {
          this.logger.log(
            `User ${participant.id} has disabled ${isExpiration ? 'campaign expiration' : 'campaign completion'} notifications`,
          );
          continue; // User has disabled notifications for campaign endings/expirations
        }

        // Prepare notification data
        const notificationData: NotificationDeliveryData = {
          userId: participant.id,
          notificationType,
          title: isExpiration
            ? '⏰ Campaign Expired'
            : '🎉 Campaign Completed!',
          message: participant.isAdvertiser
            ? isExpiration
              ? `Your campaign "${campaign.title}" has expired and been automatically completed. Please review your promoters' work and leave feedback.`
              : `Your campaign "${campaign.title}" has been completed! Please review your promoters' work and leave feedback.`
            : isExpiration
              ? `The campaign "${campaign.title}" you participated in has expired and been completed. Please leave a review about your experience.`
              : `The campaign "${campaign.title}" you participated in has been completed! Please leave a review about your experience.`,
          deliveryMethods,
          metadata: {
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            campaignType: campaign.type,
            completedAt: new Date().toISOString(),
            participantRole: participant.isAdvertiser
              ? 'advertiser'
              : 'promoter',
            totalPromoters: promoterCampaigns.length,
            requestAction: 'leave_review',
            reviewUrl: participant.isAdvertiser
              ? `/advertiser/campaigns/${campaign.id}/reviews`
              : `/promoter/campaigns/${campaign.id}/review`,
            completionReason: isExpiration ? 'expired' : 'manual',
            isExpiration,
          },
          campaignId: campaign.id,
        };

        // Send notification
        await this.notificationDeliveryService.deliverNotification(
          notificationData,
        );

        this.logger.log(
          `Campaign completion notification sent to ${participant.isAdvertiser ? 'advertiser' : 'promoter'}: ${participant.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send notification to participant ${participant.id}:`,
          error,
        );
        // Continue with other participants even if one fails
      }
    }

    this.logger.log(
      `Completed sending campaign completion notifications for campaign: ${campaign.id}`,
    );
  }
}
