import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PromoterDashboardRequest,
  PromoterDashboardData,
  PromoterStats,
  PromoterActiveCampaign,
  PromoterSuggestedCampaign,
  PromoterTransaction,
  PromoterMessage,
  PromoterWallet,
  PromoterWalletViewEarnings,
  PromoterWalletDirectEarnings,
} from '../interfaces/promoter-dashboard';
import { UserEntity } from '../database/entities/user.entity';
import { Campaign } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { CampaignType } from '../enums/campaign-type';

@Injectable()
export class PromoterService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
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
  ) {}

  async getDashboardData(
    firebaseUid: string,
    request: PromoterDashboardRequest,
  ): Promise<PromoterDashboardData> {
    const data: PromoterDashboardData = {};

    // Find promoter by Firebase UID
    console.log('Looking for user with Firebase UID:', firebaseUid);
    const promoter = await this.userRepository.findOne({
      where: { firebaseUid: firebaseUid, role: 'PROMOTER' },
    });

    console.log('Found promoter:', promoter);

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    const promoterId = promoter.id;
    console.log('Promoter ID:', promoterId);

    // Get actual data from database
    if (request.includeStats) {
      data.stats = await this.getPromoterStats(promoterId);
    }

    if (request.includeCampaigns) {
      data.activeCampaigns = await this.getActiveCampaigns(
        promoterId,
        request.activeCampaignLimit || 10,
      );
    }

    if (request.includeSuggestions) {
      data.suggestedCampaigns = await this.getSuggestedCampaigns(
        promoterId,
        request.suggestedCampaignLimit || 5,
      );
    }

    if (request.includeTransactions) {
      data.recentTransactions = await this.getRecentTransactions(
        promoterId,
        request.transactionLimit || 5,
      );
    }

    if (request.includeMessages) {
      data.recentMessages = await this.getRecentMessages(
        promoterId,
        request.messageLimit || 5,
      );
    }

    if (request.includeWallet) {
      data.wallet = await this.getWalletInfo(promoterId);
    }

    return data;
  }

  private async getPromoterStats(promoterId: string): Promise<PromoterStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
    );

    // Get earnings this week vs last week
    const earningsThisWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const earningsLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    // Get views today vs yesterday
    const viewsToday = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.updatedAt >= :startOfToday', { startOfToday })
      .getRawOne();

    const viewsYesterday = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('SUM(pc.viewsGenerated)', 'total')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.updatedAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('pc.updatedAt < :startOfToday', { startOfToday })
      .getRawOne();

    // Get sales this week vs last week (assuming salesman commission transactions)
    const salesThisWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    const salesLastWeek = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'total')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    // Get active campaigns count
    const activeCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'ONGOING' })
      .getCount();

    // Get pending review campaigns count
    const pendingReviewCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
      .getCount();

    const earningsThisWeekNum = parseFloat(earningsThisWeek?.total || '0');
    const earningsLastWeekNum = parseFloat(earningsLastWeek?.total || '0');
    const viewsTodayNum = parseInt(viewsToday?.total || '0');
    const viewsYesterdayNum = parseInt(viewsYesterday?.total || '0');
    const salesThisWeekNum = parseInt(salesThisWeek?.total || '0');
    const salesLastWeekNum = parseInt(salesLastWeek?.total || '0');

    return {
      earningsThisWeek: earningsThisWeekNum,
      earningsLastWeek: earningsLastWeekNum,
      earningsPercentageChange:
        earningsLastWeekNum > 0
          ? ((earningsThisWeekNum - earningsLastWeekNum) /
              earningsLastWeekNum) *
            100
          : 0,
      viewsToday: viewsTodayNum,
      viewsYesterday: viewsYesterdayNum,
      viewsPercentageChange:
        viewsYesterdayNum > 0
          ? ((viewsTodayNum - viewsYesterdayNum) / viewsYesterdayNum) * 100
          : 0,
      salesThisWeek: salesThisWeekNum,
      salesLastWeek: salesLastWeekNum,
      salesPercentageChange:
        salesLastWeekNum > 0
          ? ((salesThisWeekNum - salesLastWeekNum) / salesLastWeekNum) * 100
          : 0,
      activeCampaigns,
      pendingReviewCampaigns,
    };
  }

  private async getActiveCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<PromoterActiveCampaign[]> {
    const promoterCampaigns = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.campaign', 'campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('pc.promoterId = :promoterId', { promoterId })
      .andWhere('pc.status = :status', { status: 'ONGOING' })
      .orderBy('pc.updatedAt', 'DESC')
      .limit(limit)
      .getMany();

    return promoterCampaigns.map((pc) => ({
      id: pc.campaign.id,
      title: pc.campaign.title,
      type: pc.campaign.type,
      status: pc.status,
      views: pc.viewsGenerated,
      earnings: pc.earnings,
      advertiser: pc.campaign.advertiser?.name || 'Unknown',
      deadline: pc.campaign.deadline?.toISOString(),
      createdAt: pc.campaign.createdAt.toISOString(),
      updatedAt: pc.updatedAt.toISOString(),
    }));
  }

  private async getSuggestedCampaigns(
    promoterId: string,
    limit: number,
  ): Promise<PromoterSuggestedCampaign[]> {
    // First, get campaign IDs that the promoter has already joined
    const joinedCampaignIds = await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .select('pc.campaignId')
      .where('pc.promoterId = :promoterId', { promoterId })
      .getRawMany();

    const joinedIds = joinedCampaignIds.map(
      (row: { campaignId: string }) => row.campaignId,
    );

    // Get campaigns that are active and public, not already joined by the promoter
    let query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .where('campaign.status = :status', { status: 'ACTIVE' })
      .andWhere('campaign.isPublic = :isPublic', { isPublic: true });

    // Exclude campaigns the promoter has already joined
    if (joinedIds.length > 0) {
      query = query.andWhere('campaign.id NOT IN (:...joinedIds)', {
        joinedIds,
      });
    }

    const campaigns = await query
      .orderBy('campaign.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      cpv: campaign.cpv,
      budget: this.getCampaignBudget(campaign),
      advertiser: campaign.advertiser?.name || 'Unknown',
      tags: this.getCampaignTags(campaign),
      description: campaign.description,
      requirements: this.getCampaignRequirements(campaign),
      estimatedEarnings: this.calculateEstimatedEarnings(campaign),
      applicationDeadline: campaign.deadline?.toISOString(),
    }));
  }

  private async getRecentTransactions(
    promoterId: string,
    limit: number,
  ): Promise<PromoterTransaction[]> {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.campaign', 'campaign')
      .where('transaction.promoterId = :promoterId', { promoterId })
      .orderBy('transaction.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      status: transaction.status,
      date: transaction.createdAt.toISOString(),
      campaign: transaction.campaign?.title || 'N/A',
      campaignId: transaction.campaignId,
      type: transaction.type,
      paymentMethod: transaction.paymentMethod,
      description: transaction.description,
      estimatedPaymentDate: transaction.estimatedPaymentDate?.toISOString(),
    }));
  }

  private async getRecentMessages(
    promoterId: string,
    limit: number,
  ): Promise<PromoterMessage[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('thread.promoterId = :promoterId', { promoterId })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return messages.map((message) => ({
      id: message.id,
      name: message.sender?.name || 'Unknown',
      message: message.content,
      time: message.createdAt.toISOString(),
      avatar: message.sender?.avatarUrl,
      isRead: message.isRead,
      threadId: message.threadId,
      senderType: message.senderType,
      campaignId: message.thread?.campaignId || '',
    }));
  }

  private async getWalletInfo(promoterId: string): Promise<PromoterWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { promoterId },
    });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = this.walletRepository.create({
        promoterId,
        currentBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        minimumThreshold: 20,
        directTotalEarned: 0,
        directTotalPaid: 0,
        directPendingPayments: 0,
      });
      await this.walletRepository.save(wallet);
    }

    const viewEarnings: PromoterWalletViewEarnings = {
      currentBalance: wallet.currentBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      lastPayoutDate: wallet.lastPayoutDate?.toISOString(),
      nextPayoutDate: wallet.nextPayoutDate?.toISOString(),
      minimumThreshold: wallet.minimumThreshold,
    };

    const directEarnings: PromoterWalletDirectEarnings = {
      totalEarned: wallet.directTotalEarned,
      totalPaid: wallet.directTotalPaid,
      pendingPayments: wallet.directPendingPayments,
      lastPaymentDate: wallet.directLastPaymentDate?.toISOString(),
    };

    return {
      viewEarnings,
      directEarnings,
      totalLifetimeEarnings:
        Number(wallet.totalEarned) + Number(wallet.directTotalEarned),
      totalAvailableBalance: wallet.currentBalance,
    };
  }

  private getCampaignTags(campaign: Campaign): string[] {
    const tags: string[] = [];

    if (campaign.type === CampaignType.VISIBILITY) {
      tags.push('Views', 'Promotion');
    } else if (campaign.type === CampaignType.CONSULTANT) {
      tags.push('Consulting', 'Expert');
    } else if (campaign.type === CampaignType.SALESMAN) {
      tags.push('Sales', 'Commission');
    }

    return tags;
  }

  private getCampaignRequirements(campaign: Campaign): string[] {
    const requirements: string[] = [];

    if (campaign.type === CampaignType.VISIBILITY) {
      requirements.push('Active social media presence');
    } else if (campaign.type === CampaignType.CONSULTANT) {
      requirements.push('Relevant expertise');
    } else if (campaign.type === CampaignType.SALESMAN) {
      requirements.push('Sales experience');
    }

    return requirements;
  }

  private calculateEstimatedEarnings(campaign: Campaign): number {
    if (campaign.type === CampaignType.VISIBILITY && campaign.cpv) {
      return campaign.cpv * 100; // Assuming 100 views as baseline
    }
    return 0;
  }

  private getCampaignBudget(campaign: Campaign): number | undefined {
    if (
      campaign.type === CampaignType.CONSULTANT ||
      campaign.type === CampaignType.SELLER
    ) {
      return campaign.maxBudget;
    }
    // For VISIBILITY and SALESMAN campaigns, calculate budget based on their specific fields
    if (
      campaign.type === CampaignType.VISIBILITY &&
      campaign.cpv &&
      campaign.maxViews
    ) {
      return (campaign.cpv * campaign.maxViews) / 100; // Convert per 100 views to total budget
    }
    return undefined;
  }
}
