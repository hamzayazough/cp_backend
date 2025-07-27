import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { ViewStatEntity } from '../database/entities/view-stat.entity';
import { SalesRecordEntity } from '../database/entities/sales-record.entity';
import { AdvertiserStats } from '../interfaces/advertiser-dashboard';

// Type for raw query results
interface QueryResult {
  total: string;
}

@Injectable()
export class AdvertiserStatsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private campaignBudgetTrackingRepository: Repository<CampaignBudgetTracking>,
    @InjectRepository(ViewStatEntity)
    private viewStatsRepository: Repository<ViewStatEntity>,
    @InjectRepository(SalesRecordEntity)
    private salesRecordRepository: Repository<SalesRecordEntity>,
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

    // Get spending data from campaign_budget_tracking (this shows actual campaign spending)
    const spendingThisWeek = (await this.campaignBudgetTrackingRepository
      .createQueryBuilder('cbt')
      .innerJoin('cbt.campaign', 'campaign')
      .select('COALESCE(SUM(cbt.spentBudgetCents), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('cbt.updatedAt >= :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    const spendingLastWeek = (await this.campaignBudgetTrackingRepository
      .createQueryBuilder('cbt')
      .innerJoin('cbt.campaign', 'campaign')
      .select('COALESCE(SUM(cbt.spentBudgetCents), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('cbt.updatedAt >= :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('cbt.updatedAt < :weekAgo', { weekAgo })
      .getRawOne()) as QueryResult;

    // Get views data from view_stats table (more accurate daily tracking)
    const viewsToday = (await this.viewStatsRepository
      .createQueryBuilder('vs')
      .innerJoin('vs.campaign', 'campaign')
      .select('COALESCE(SUM(vs.viewCount), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('vs.dateTracked >= :startOfToday', { startOfToday })
      .getRawOne()) as QueryResult;

    const viewsYesterday = (await this.viewStatsRepository
      .createQueryBuilder('vs')
      .innerJoin('vs.campaign', 'campaign')
      .select('COALESCE(SUM(vs.viewCount), 0)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('vs.dateTracked >= :startOfYesterday', { startOfYesterday })
      .andWhere('vs.dateTracked < :startOfToday', { startOfToday })
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

    const pendingApprovalCampaigns = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('campaign.status = :status', { status: 'PENDING_APPROVAL' })
      .getCount();

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
