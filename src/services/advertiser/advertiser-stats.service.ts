import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvertiserStats } from '../../interfaces/advertiser-dashboard';
import { UserEntity } from 'src/database/entities';
import { CampaignStatus } from 'src/enums/campaign-status';
import { PromoterCampaignStatus } from 'src/database/entities/promoter-campaign.entity';
import { TransactionType } from 'src/database/entities/transaction.entity';

@Injectable()
export class AdvertiserStatsService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async getAdvertiserStats(advertiserId: string): Promise<AdvertiserStats> {
    // Load user with all needed relations
    const advertiser = await this.userRepository.findOne({
      where: { id: advertiserId },
      relations: [
        'campaigns',
        'transactions',
        'uniqueViews',
        'wallet',
        'campaigns.promoterCampaigns',
        // Add other relations as needed
      ],
    });

    if (!advertiser) {
      throw new Error('Advertiser not found');
    }

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

    const transactionTypes = [
      TransactionType.DIRECT_PAYMENT,
      TransactionType.VIEW_EARNING,
      TransactionType.SALESMAN_COMMISSION,
      TransactionType.MONTHLY_PAYOUT,
    ];

    const filterTransactions = (start: Date, end?: Date) =>
      (advertiser.transactions || []).filter(
        (tx) =>
          transactionTypes.includes(tx.type) &&
          tx.createdAt >= start &&
          (!end || tx.createdAt < end),
      );

    const spendingThisWeekNum =
      filterTransactions(weekAgo).reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      ) / 100;
    const spendingLastWeekNum =
      filterTransactions(twoWeeksAgo, weekAgo).reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      ) / 100;
    const spendingPercentageChange =
      spendingLastWeekNum > 0
        ? ((spendingThisWeekNum - spendingLastWeekNum) / spendingLastWeekNum) *
          100
        : 0;
    const spendingTotal =
      filterTransactions(new Date(0)).reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      ) / 100;

    // Views: count by campaign_id using UniqueViewEntity repository
    const advertiserCampaignIds = (advertiser.campaigns || []).map((c) => c.id);

    const viewsTodayNum = await this.userRepository.manager
      .getRepository('UniqueViewEntity')
      .createQueryBuilder('uv')
      .where('uv.campaignId IN (:...campaignIds)', {
        campaignIds: advertiserCampaignIds,
      })
      .andWhere('uv.createdAt >= :startOfToday', { startOfToday })
      .getCount();

    const viewsYesterdayNum = await this.userRepository.manager
      .getRepository('UniqueViewEntity')
      .createQueryBuilder('uv')
      .where('uv.campaignId IN (:...campaignIds)', {
        campaignIds: advertiserCampaignIds,
      })
      .andWhere('uv.createdAt >= :startOfYesterday', { startOfYesterday })
      .andWhere('uv.createdAt < :startOfToday', { startOfToday })
      .getCount();

    const viewsTotal = await this.userRepository.manager
      .getRepository('UniqueViewEntity')
      .createQueryBuilder('uv')
      .where('uv.campaignId IN (:...campaignIds)', {
        campaignIds: advertiserCampaignIds,
      })
      .getCount();

    const viewsPercentageChange =
      viewsYesterdayNum > 0
        ? ((viewsTodayNum - viewsYesterdayNum) / viewsYesterdayNum) * 100
        : 0;

    // TODO: Once implemented logic to track promoter sales, update this
    const conversionsThisWeekNum = 0;
    const conversionsLastWeekNum = 0;
    const conversionsPercentageChange = 0;

    // Active campaigns: must be ACTIVE and have at least one promoterCampaign ONGOING
    const activeCampaigns = (advertiser.campaigns || []).filter(
      (c) =>
        c.status === CampaignStatus.ACTIVE &&
        (c.promoterCampaigns || []).some(
          (pc) => pc.status === PromoterCampaignStatus.ONGOING,
        ),
    ).length;

    // Pending approval campaigns
    let pendingApprovalCount = 0;
    for (const campaign of advertiser.campaigns || []) {
      if (campaign.status !== CampaignStatus.ACTIVE) continue;
      if (!campaign.isPublic && !campaign.canHaveMultiplePromoters) {
        const hasAwaitingReview = (campaign.promoterCampaigns || []).some(
          (pc) => pc.status === PromoterCampaignStatus.AWAITING_REVIEW,
        );
        if (hasAwaitingReview) {
          pendingApprovalCount += 1;
        }
      } else {
        // it mean campaign is public so no need to check for pending approval
      }
    }
    const pendingApprovalCampaigns = pendingApprovalCount;

    return {
      spendingThisWeek: spendingThisWeekNum,
      spendingLastWeek: spendingLastWeekNum,
      spendingPercentageChange,
      spendingTotal: spendingTotal,
      viewsToday: viewsTodayNum,
      viewsYesterday: viewsYesterdayNum,
      viewsPercentageChange,
      viewsTotal: viewsTotal,
      conversionsThisWeek: conversionsThisWeekNum,
      conversionsLastWeek: conversionsLastWeekNum,
      conversionsPercentageChange,
      activeCampaigns,
      pendingApprovalCampaigns,
    };
  }
}
