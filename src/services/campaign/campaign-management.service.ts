import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { PromoterCampaign } from '../../database/entities/promoter-campaign.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { PromoterDetailsEntity } from '../../database/entities/promoter-details.entity';
import { CampaignStatus } from '../../enums/campaign-status';
import { PromoterCampaignStatus } from '../../database/entities/promoter-campaign.entity';
import { CampaignType } from '../../enums/campaign-type';
import { CAMPAIGN_MANAGEMENT_CONSTANTS } from '../../constants/campaign-management.constants';
import {
  CampaignCompletionResult,
  PromoterCampaignStatsUpdate,
} from '../../interfaces/campaign-management';

/**
 * Service responsible for completing campaigns and updating related entities
 */
@Injectable()
export class CampaignCompletionService {
  private readonly logger = new Logger(CampaignCompletionService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PromoterDetailsEntity)
    private readonly promoterDetailsRepository: Repository<PromoterDetailsEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Complete a single campaign and update all related entities
   * @param campaignId - ID of the campaign to complete
   */
  async completeCampaign(
    campaignId: string,
  ): Promise<CampaignCompletionResult> {
    this.logger.log(
      `🏁 Starting completion process for campaign ${campaignId}`,
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
        throw new Error(
          CAMPAIGN_MANAGEMENT_CONSTANTS.ERROR_MESSAGES.CAMPAIGN_NOT_FOUND,
        );
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

      const result: CampaignCompletionResult = {
        campaignId,
        completedAt,
        affectedPromoterCampaigns: promoterCampaigns.length,
        updatedPromoterDetails: statsUpdates.length,
        updatedUserStats: statsUpdates.length,
      };

      this.logger.log(
        `✅ Campaign ${campaignId} completed successfully. ` +
          `Affected: ${result.affectedPromoterCampaigns} promoter campaigns, ` +
          `${result.updatedPromoterDetails} promoter details, ` +
          `${result.updatedUserStats} user stats`,
      );

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Failed to complete campaign ${campaignId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Complete multiple campaigns in batch
   * @param campaignIds - Array of campaign IDs to complete
   */
  async completeCampaignsBatch(
    campaignIds: string[],
  ): Promise<CampaignCompletionResult[]> {
    this.logger.log(
      `🏁 Starting batch completion for ${campaignIds.length} campaigns`,
    );

    const results: CampaignCompletionResult[] = [];

    for (const campaignId of campaignIds) {
      try {
        const result = await this.completeCampaign(campaignId);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to complete campaign ${campaignId} in batch:`,
          error,
        );
        // Continue with other campaigns even if one fails
      }
    }

    this.logger.log(
      `📊 Batch completion results: ${results.length}/${campaignIds.length} campaigns completed successfully`,
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
        CAMPAIGN_MANAGEMENT_CONSTANTS.ERROR_MESSAGES.PROMOTER_DETAILS_NOT_FOUND,
      );
    }

    promoterDetails.numberOfCampaignDone += 1;
    await manager.save(promoterDetails);

    // Update user entity campaign type statistics
    const user = await manager.findOne(UserEntity, {
      where: { id: promoterId },
    });

    if (!user) {
      throw new Error(
        CAMPAIGN_MANAGEMENT_CONSTANTS.ERROR_MESSAGES.USER_NOT_FOUND,
      );
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
        status: CAMPAIGN_MANAGEMENT_CONSTANTS.COMPLETION_STATUS.ACTIVE,
      })
      .andWhere('campaign.deadline IS NOT NULL')
      .andWhere('campaign.deadline <= :today', { today })
      .getMany();
  }
}
