import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { UniqueViewEntity } from '../../database/entities/unique-view.entity';
import { SalesRecordEntity } from '../../database/entities/sales-record.entity';
import { AdvertiserStats } from '../../interfaces/advertiser-dashboard';
import { PromoterCampaign } from '../../database/entities/promoter-campaign.entity';

// Type for raw query results
interface QueryResult {
  total: string;
}

@Injectable()
export class AdvertiserStatsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(UniqueViewEntity)
    private uniqueViewRepository: Repository<UniqueViewEntity>,
    @InjectRepository(SalesRecordEntity)
    private salesRecordRepository: Repository<SalesRecordEntity>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PromoterCampaign)
    private promoterCampaignRepository: Repository<PromoterCampaign>,
  ) {}

  async getAdvertiserStats(advertiserId: string): Promise<AdvertiserStats> {
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
    );

    // Get spending data from transactions for specific types
    const transactionTypes = [
      'DIRECT_PAYMENT',
      'VIEW_EARNING',
      'SALESMAN_COMMISSION',
      'MONTHLY_PAYOUT',
    ];

    // This week
    const spendingThisWeek = (await this.transactionRepository
      .createQueryBuilder('txn')
      .select('COALESCE(SUM(txn.amount), 0)', 'total')
      .where('txn.userId = :advertiserId', { advertiserId })
      .andWhere('txn.type IN (:...types)', { types: transactionTypes })
      .andWhere('txn.createdAt >= :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    // Last week
    const spendingLastWeek = (await this.transactionRepository
      .createQueryBuilder('txn')
      .select('COALESCE(SUM(txn.amount), 0)', 'total')
      .where('txn.userId = :advertiserId', { advertiserId })
      .andWhere('txn.type IN (:...types)', { types: transactionTypes })
      .andWhere('txn.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('txn.createdAt < :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    // Get views data from unique_views table (unique views per campaign/promoter/fingerprint)
    const viewsToday = (await this.uniqueViewRepository
      .createQueryBuilder('uv')
      .select('COUNT(DISTINCT uv.id)', 'total')
      .where('uv.createdAt >= :startOfToday', { startOfToday })
      .andWhere(
        'uv.campaignId IN (' +
          this.campaignRepository
            .createQueryBuilder('c')
            .select('c.id')
            .where('c.advertiserId = :advertiserId', { advertiserId })
            .getQuery() +
          ')',
      )
      .setParameter('advertiserId', advertiserId)
      .getRawOne()) as QueryResult;

    const viewsYesterday = (await this.uniqueViewRepository
      .createQueryBuilder('uv')
      .select('COUNT(DISTINCT uv.id)', 'total')
      .where('uv.createdAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('uv.createdAt < :startOfToday', { startOfToday })
      .andWhere(
        'uv.campaignId IN (' +
          this.campaignRepository
            .createQueryBuilder('c')
            .select('c.id')
            .where('c.advertiserId = :advertiserId', { advertiserId })
            .getQuery() +
          ')',
      )
      .setParameter('advertiserId', advertiserId)
      .getRawOne()) as QueryResult;

    // Get conversions data from sales_records (more accurate than transaction counting)
    const conversionsThisWeek = (await this.salesRecordRepository
      .createQueryBuilder('sr')
      .innerJoin('sr.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('sr.verificationStatus = :status', { status: 'VERIFIED' })
      .andWhere('sr.createdAt >= :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    const conversionsLastWeek = (await this.salesRecordRepository
      .createQueryBuilder('sr')
      .innerJoin('sr.campaign', 'campaign')
      .select('COUNT(*)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('sr.verificationStatus = :status', { status: 'VERIFIED' })
      .andWhere('sr.createdAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('sr.createdAt < :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    // Get campaign counts
    const activeCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'ACTIVE' })
      .getCount();

    // Custom logic for pending approval campaigns with promoter logic
    const campaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'ACTIVE' })
      .getMany();

    let pendingApprovalCount = 0;
    for (const campaign of campaigns) {
      if (campaign.canHaveMultiplePromoters) {
        // Count all promoter_campaigns in AWAITING_REVIEW for this campaign
        const awaitingReviewCount = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
          .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
          .getCount();
        pendingApprovalCount += awaitingReviewCount;
      } else {
        // Check if there is any promoter_campaign in ONGOING or COMPLETED
        const hasActiveOrCompleted = await this.promoterCampaignRepository
          .createQueryBuilder('pc')
          .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
          .andWhere('pc.status IN (:...statuses)', {
            statuses: ['ONGOING', 'COMPLETED'],
          })
          .getCount();
        if (hasActiveOrCompleted === 0) {
          // If none, count the AWAITING_REVIEW one (if exists)
          const awaitingReviewCount = await this.promoterCampaignRepository
            .createQueryBuilder('pc')
            .where('pc.campaignId = :campaignId', { campaignId: campaign.id })
            .andWhere('pc.status = :status', { status: 'AWAITING_REVIEW' })
            .getCount();
          pendingApprovalCount += awaitingReviewCount;
        }
      }
    }
    const pendingApprovalCampaigns = pendingApprovalCount;

    // Calculate percentage changes with safe value extraction
    const spendingThisWeekNum = Number(spendingThisWeek?.total || 0) / 100; // Convert cents to dollars
    const spendingLastWeekNum = Number(spendingLastWeek?.total || 0) / 100; // Convert cents to dollars
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
