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
  GetAdvertiserDashboardRequest,
  AdvertiserDashboardData,
} from '../interfaces/advertiser-dashboard';
import {
  AdvertiserCampaignListRequest,
  AdvertiserCampaignListResponse,
  AdvertiserDashboardSummary,
  CampaignFilters,
} from '../interfaces/advertiser-campaign';
import { AdvertiserDashboardService } from './advertiser-dashboard.service';
import { AdvertiserCampaignService } from './advertiser-campaign.service';
import { AdvertiserWalletService } from './advertiser-wallet.service';
import { AdvertiserStatsService } from './advertiser-stats.service';
import { AdvertiserTransactionService } from './advertiser-transaction.service';
import { AdvertiserMessageService } from './advertiser-message.service';
import { UserType } from 'src/database/entities/billing-period-summary.entity';

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
    private dashboardService: AdvertiserDashboardService,
    private campaignService: AdvertiserCampaignService,
    private walletService: AdvertiserWalletService,
    private statsService: AdvertiserStatsService,
    private transactionService: AdvertiserTransactionService,
    private messageService: AdvertiserMessageService,
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
}
