import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import {
  CampaignApplicationEntity,
  ApplicationStatus,
} from '../database/entities/campaign-applications.entity';
import { PromoterCampaignStatus } from '../database/entities/promoter-campaign.entity';
import {
  GetAdvertiserDashboardRequest,
  AdvertiserDashboardData,
} from '../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  AdvertiserDashboardSummary,
  CampaignFilters,
  CampaignAdvertiser,
} from '../interfaces/advertiser-campaign';
import { AdvertiserDashboardService } from './advertiser-dashboard.service';
import { AdvertiserCampaignService } from './advertiser-campaign.service';
import { AdvertiserWalletService } from './advertiser-wallet.service';
import { AdvertiserStatsService } from './advertiser-stats.service';
import { AdvertiserTransactionService } from './advertiser-transaction.service';
import { AdvertiserMessageService } from './advertiser-message.service';
import { UserType } from 'src/database/entities/billing-period-summary.entity';
import { ReviewCampaignApplicationResult } from '../interfaces/review-campaign-application-result';
import { S3Service } from './s3.service';

@Injectable()
export class AdvertiserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(MessageThread)
    private messageThreadRepository: Repository<MessageThread>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(CampaignApplicationEntity)
    private campaignApplicationRepository: Repository<CampaignApplicationEntity>,
    private dashboardService: AdvertiserDashboardService,
    private campaignService: AdvertiserCampaignService,
    private walletService: AdvertiserWalletService,
    private statsService: AdvertiserStatsService,
    private transactionService: AdvertiserTransactionService,
    private messageService: AdvertiserMessageService,
    private readonly s3Service: S3Service, // <-- Inject S3Service
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: GetAdvertiserDashboardRequest,
  ): Promise<AdvertiserDashboardData> {
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    const advertiserId = advertiser.id;
    const data: AdvertiserDashboardData = {
      stats: request.includeStats
        ? await this.statsService.getAdvertiserStats(parseInt(advertiserId))
        : {
            spendingThisWeek: 0,
            spendingLastWeek: 0,
            spendingPercentageChange: 0,
            viewsToday: 0,
            viewsYesterday: 0,
            viewsPercentageChange: 0,
            conversionsThisWeek: 0,
            conversionsLastWeek: 0,
            conversionsPercentageChange: 0,
            activeCampaigns: 0,
            pendingApprovalCampaigns: 0,
          },
      activeCampaigns: request.includeCampaigns
        ? await this.campaignService.getActiveCampaigns(
            advertiserId,
            request.activeCampaignLimit || 10,
          )
        : [],
      recentTransactions: request.includeTransactions
        ? await this.transactionService.getRecentTransactions(
            advertiserId,
            request.transactionLimit || 10,
          )
        : [],
      recentMessages: request.includeMessages
        ? await this.messageService.getRecentMessages(
            parseInt(advertiserId),
            request.messageLimit || 10,
          )
        : [],
      wallet: request.includeWallet
        ? await this.walletService.getWalletInfo(advertiserId)
        : {
            balance: {
              currentBalance: 0,
              pendingCharges: 0,
              totalSpent: 0,
              totalDeposited: 0,
              minimumBalance: 0,
            },
            campaignBudgets: {
              totalAllocated: 0,
              totalUsed: 0,
              pendingPayments: 0,
            },
            totalLifetimeSpent: 0,
            totalAvailableBalance: 0,
          },
    };

    return data;
  }

  async getCampaignsList(
    firebaseUid: string,
    request: AdvertiserCampaignListRequest,
  ): Promise<AdvertiserCampaignListResponse> {
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    return this.campaignService.getCampaignsList(advertiser.id, request);
  }

  async getDashboardSummary(
    firebaseUid: string,
  ): Promise<AdvertiserDashboardSummary> {
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    return this.dashboardService.getDashboardSummary(advertiser.id);
  }
  getCampaignFilters(): CampaignFilters {
    return this.campaignService.getCampaignFilters();
  }

  async reviewCampaignApplication(
    firebaseUid: string,
    campaignId: string,
    applicationId: string,
    status: 'ACCEPTED' | 'REJECTED',
  ): Promise<ReviewCampaignApplicationResult> {
    // Find advertiser by Firebase UID
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    // Verify that the campaign belongs to this advertiser
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, advertiserId: advertiser.id },
    });

    if (!campaign) {
      throw new Error('Campaign not found or access denied');
    } // Find the application - try by application ID first, then by promoter ID
    let application = await this.campaignApplicationRepository.findOne({
      where: { id: applicationId, campaignId: campaignId },
      relations: ['promoter'],
    });

    // If not found by application ID, try to find by promoter ID
    if (!application) {
      application = await this.campaignApplicationRepository.findOne({
        where: { promoterId: applicationId, campaignId: campaignId },
        relations: ['promoter'],
      });
    }

    if (!application) {
      throw new Error('Application not found');
    }

    // Update application status
    application.status =
      status === 'ACCEPTED'
        ? ApplicationStatus.ACCEPTED
        : ApplicationStatus.REJECTED;
    await this.campaignApplicationRepository.save(application);
    // If accepted, create a PromoterCampaign record
    if (status === 'ACCEPTED') {
      const existingPromoterCampaign =
        await this.promoterCampaignRepository.findOne({
          where: {
            promoterId: application.promoterId,
            campaignId: campaignId,
          },
        });

      if (!existingPromoterCampaign) {
        const promoterCampaign = this.promoterCampaignRepository.create({
          promoterId: application.promoterId,
          campaignId: campaignId,
          status: PromoterCampaignStatus.ONGOING,
          viewsGenerated: 0,
          earnings: 0,
          budgetHeld: 0,
          spentBudget: 0,
          payoutExecuted: false,
        });
        await this.promoterCampaignRepository.save(promoterCampaign);
      }
    }

    return {
      applicationId: application.id,
      status: application.status,
      campaignId: campaignId,
      promoterId: application.promoterId,
    };
  }

  async deleteCampaign(
    firebaseUid: string,
    campaignId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Find advertiser by Firebase UID
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });
    if (!advertiser) {
      return { success: false, message: 'Advertiser not found' };
    }
    // Verify campaign belongs to this advertiser
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, advertiserId: advertiser.id },
    });
    if (!campaign) {
      return { success: false, message: 'Campaign not found or access denied' };
    }
    // Check for any associated PromoterCampaigns
    const promoterCampaignCount = await this.promoterCampaignRepository.count({
      where: { campaignId },
    });
    if (promoterCampaignCount > 0) {
      return {
        success: false,
        message:
          'Cannot delete campaign: there are promoters associated with this campaign.',
      };
    }
    // Delete media from S3 if exists
    if (campaign.mediaUrl) {
      try {
        const key = this.s3Service.extractKeyFromUrl(campaign.mediaUrl);
        await this.s3Service.deleteObject(key);
      } catch (err) {
        // Log error but continue with campaign deletion
        console.error('Error deleting campaign media from S3:', err);
      }
    }
    // Delete campaign
    await this.campaignRepository.delete(campaignId);
    return { success: true, message: 'Campaign deleted successfully' };
  }

  async getCampaignById(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignAdvertiser> {
    const advertiser = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: UserType.ADVERTISER },
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

    return this.campaignService.getCampaignById(advertiser.id, campaignId);
  }
}
