import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { AdvertiserStats } from '../interfaces/advertiser-dashboard';

// Type for raw query results
interface RawQueryResult {
  total: string | number;
}

@Injectable()
export class AdvertiserStatsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
  ) {}

  async getAdvertiserStats(advertiserId: number): Promise<AdvertiserStats> {
    // Calculate date ranges
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
    ); // Get spending data
    const spendingThisWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as RawQueryResult | undefined;

    const spendingLastWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as RawQueryResult | undefined; // Get views data
    const viewsToday = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select('COALESCE(SUM(pc.viewsGenerated), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.updatedAt >= :startOfToday', { startOfToday })
      .getRawOne()) as RawQueryResult | undefined;

    const viewsYesterday = (await this.promoterCampaignRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.campaign', 'campaign')
      .select('COALESCE(SUM(pc.viewsGenerated), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('pc.updatedAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('pc.updatedAt < :startOfToday', { startOfToday })
      .getRawOne()) as RawQueryResult | undefined;

    // Get conversions data
    const conversionsThisWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as RawQueryResult | undefined;

    const conversionsLastWeek = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.type = :type', { type: 'SALESMAN_COMMISSION' })
      .andWhere('transaction.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('transaction.createdAt < :weekAgo', { weekAgo })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .getRawOne()) as RawQueryResult | undefined;

    // Get campaign counts
    const activeCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'ACTIVE' })
      .getCount();

    const pendingApprovalCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'PENDING_APPROVAL' })
      .getCount();

    // Calculate percentage changes with safe value extraction
    const spendingThisWeekNum = Number(spendingThisWeek?.total || 0);
    const spendingLastWeekNum = Number(spendingLastWeek?.total || 0);
    const spendingPercentageChange =
      spendingLastWeekNum > 0
        ? ((spendingThisWeekNum - spendingLastWeekNum) / spendingLastWeekNum) *
          100
        : 0;

    const viewsTodayNum = Number(viewsToday?.total || 0);
    const viewsYesterdayNum = Number(viewsYesterday?.total || 0);
    const viewsPercentageChange =
      viewsYesterdayNum > 0
        ? ((viewsTodayNum - viewsYesterdayNum) / viewsYesterdayNum) * 100
        : 0;

    const conversionsThisWeekNum = Number(conversionsThisWeek?.total || 0);
    const conversionsLastWeekNum = Number(conversionsLastWeek?.total || 0);
    const conversionsPercentageChange =
      conversionsLastWeekNum > 0
        ? ((conversionsThisWeekNum - conversionsLastWeekNum) /
            conversionsLastWeekNum) *
          100
        : 0;

    return {
      spendingThisWeek: spendingThisWeekNum,
      spendingLastWeek: spendingLastWeekNum,
      spendingPercentageChange,
      viewsToday: viewsTodayNum,
      viewsYesterday: viewsYesterdayNum,
      viewsPercentageChange,
      conversionsThisWeek: conversionsThisWeekNum,
      conversionsLastWeek: conversionsLastWeekNum,
      conversionsPercentageChange,
      activeCampaigns,
      pendingApprovalCampaigns,
    };
  }
}
