import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { CampaignStatus } from '../enums/campaign-status';
import { CampaignCompletionService } from './campaign-completion.service';

@Injectable()
export class ViewsService {
  constructor(
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepo: Repository<UniqueViewEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepo: Repository<PromoterCampaign>,
    @InjectRepository(PromoterDetailsEntity)
    private readonly promoterDetailsRepo: Repository<PromoterDetailsEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private readonly budgetTrackingRepo: Repository<CampaignBudgetTracking>,
    private readonly campaignCompletionService: CampaignCompletionService,
  ) {}

  private makeFingerprint(ip: string, ua: string, token: string): string {
    return createHash('sha256').update(`${ip}|${ua}|${token}`).digest('hex');
  }

  async trackAndRedirect(
    campaignId: string,
    promoterId: string,
    ip: string,
    userAgent: string,
    browserToken: string,
  ): Promise<string> {
    // Add validation logging for UUID corruption detection
    console.log('🔍 trackAndRedirect called:', {
      campaignId,
      promoterId,
      ip,
      userAgent: userAgent.substring(0, 50) + '...',
    });

    console.log('🔍 UUID Validation:', {
      'Raw promoterId': JSON.stringify(promoterId),
      'promoterId length': promoterId.length,
      'promoterId ends with': promoterId.slice(-5),
      'campaignId length': campaignId.length,
      'campaignId ends with': campaignId.slice(-5),
    });

    // Clean promoterId if it has corruption
    const cleanPromoterId = promoterId.trim().replace(/[<>]/g, '');
    if (cleanPromoterId !== promoterId) {
      console.log('⚠️ Cleaned corrupted promoterId:', {
        original: promoterId,
        cleaned: cleanPromoterId,
      });
    }

    const fingerprint = this.makeFingerprint(ip, userAgent, browserToken);
    console.log('🔐 Generated fingerprint:', fingerprint);

    // 1) Try to insert a new unique view
    try {
      console.log('📝 Inserting unique view record...');
      await this.uniqueViewRepo.insert({
        campaignId,
        promoterId: cleanPromoterId, // Use cleaned promoterId
        fingerprint,
        ip,
        userAgent,
      });
      console.log('✅ Unique view inserted successfully');

      console.log('✅ Unique view inserted successfully');

      // New view detected → get campaign details for budget calculations
      console.log('🎯 Fetching campaign details for budget calculations...');
      const campaign = await this.campaignRepo.findOne({
        where: { id: campaignId },
        select: ['id', 'cpv', 'currentViews'],
      });
      console.log('📊 Campaign found:', campaign);

      if (campaign && campaign.cpv) {
        const costPerView = campaign.cpv / 100; // Convert from cents to dollars
        console.log('💰 Cost per view calculated:', costPerView);

        // Update campaign counters (no spent budget here)
        console.log('📈 Updating campaign counters...');
        await this.campaignRepo.increment(
          { id: campaignId },
          'currentViews',
          1,
        );
        console.log('✅ Campaign counters updated');

        // Update budget tracking spent amount
        console.log('💰 Updating budget tracking spent amount...');
        await this.budgetTrackingRepo.increment(
          { campaignId },
          'spentBudgetCents',
          Math.round(costPerView * 100), // Convert to cents
        );
        await this.budgetTrackingRepo.increment(
          { campaignId },
          'platformFeesCollectedCents',
          Math.round(costPerView * 100 * 0.2), // 20% platform fee in cents
        );
        console.log('✅ Budget tracking updated');

        // Update promoter's view count and earnings
        console.log('👤 Updating promoter campaign stats...');
        await this.promoterCampaignRepo.update(
          { campaignId, promoterId: cleanPromoterId },
          { updatedAt: new Date() },
        );
        await this.promoterCampaignRepo.increment(
          { campaignId, promoterId: cleanPromoterId },
          'viewsGenerated',
          1,
        );
        await this.promoterCampaignRepo.increment(
          { campaignId, promoterId: cleanPromoterId },
          'earnings',
          costPerView,
        );
        console.log('✅ Promoter campaign stats updated');

        // Update promoter's total views generated in promoter details
        console.log('🙋‍♂️ Updating promoter details total views generated...');
        await this.promoterDetailsRepo.increment(
          { userId: cleanPromoterId },
          'totalViewsGenerated',
          1,
        );
        console.log('✅ User total views updated');

        // Check if campaign has reached maxViews limit and complete if needed
        console.log('🔍 Checking if campaign needs to be completed...');
        const wasCompleted =
          await this.campaignCompletionService.checkAndCompleteCampaignIfNeeded(
            campaignId,
          );
        if (wasCompleted) {
          console.log(
            '🏁 Campaign was completed due to reaching maxViews limit',
          );
        }
      } else {
        console.log('⚠️  No CPV found, using fallback counters only');
        // Fallback: just increment counters without budget calculations
        await this.campaignRepo.increment(
          { id: campaignId },
          'currentViews',
          1,
        );
        await this.promoterCampaignRepo.increment(
          { campaignId, promoterId: cleanPromoterId },
          'viewsGenerated',
          1,
        );

        // Update promoter's total views generated in promoter details
        await this.promoterDetailsRepo.increment(
          { userId: cleanPromoterId },
          'totalViewsGenerated',
          1,
        );
        console.log('✅ Fallback counters updated');

        // Check if campaign has reached maxViews limit and complete if needed
        console.log(
          '🔍 Checking if campaign needs to be completed (fallback)...',
        );
        const wasCompleted =
          await this.campaignCompletionService.checkAndCompleteCampaignIfNeeded(
            campaignId,
          );
        if (wasCompleted) {
          console.log(
            '🏁 Campaign was completed due to reaching maxViews limit (fallback)',
          );
        }
      }
    } catch (error) {
      console.log('🔄 Duplicate fingerprint detected - view already tracked');
      console.log(
        'Error details:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Duplicate fingerprint → do nothing (view already tracked)
      // This is expected behavior for subsequent visits by the same user
    }

    // 2) Fetch the campaign's tracking_link (reuse if already fetched, or fetch again)
    console.log('🔗 Fetching campaign for redirect...');
    const campaignForRedirect = await this.campaignRepo.findOne({
      where: { id: campaignId },
      select: ['id', 'trackingLink', 'status'],
    });
    console.log('🎯 Campaign for redirect:', campaignForRedirect);

    if (!campaignForRedirect) {
      console.log('❌ Campaign not found');
      throw new NotFoundException('Campaign not found');
    }

    if (!campaignForRedirect.trackingLink) {
      console.log('❌ Campaign tracking link not configured');
      throw new NotFoundException('Campaign tracking link not configured');
    }

    if (campaignForRedirect.status !== CampaignStatus.ACTIVE) {
      console.log(
        '❌ Campaign is not active, status:',
        campaignForRedirect.status,
      );
      throw new NotFoundException('Campaign is not active');
    }

    console.log('✅ Redirecting to:', campaignForRedirect.trackingLink);
    return campaignForRedirect.trackingLink;
  }

  async getUniqueViewStats(campaignId: string, promoterId?: string) {
    const query = this.uniqueViewRepo
      .createQueryBuilder('uv')
      .where('uv.campaignId = :campaignId', { campaignId });

    if (promoterId) {
      query.andWhere('uv.promoterId = :promoterId', { promoterId });
    }

    const totalUniqueViews = await query.getCount();

    const dailyStats = await query
      .select(['DATE(uv.createdAt) as date', 'COUNT(*) as unique_views'])
      .groupBy('DATE(uv.createdAt)')
      .orderBy('date', 'DESC')
      .limit(30)
      .getRawMany();

    return {
      totalUniqueViews,
      dailyStats,
    };
  }
}
