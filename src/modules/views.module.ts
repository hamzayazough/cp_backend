import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { UserEntity } from 'src/database/entities';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { ViewsService } from 'src/services/visibility-feature/views.service';
import { RateLimitService } from '../services/visibility-feature/rate-limit.service';
import { CampaignCompletionService } from '../services/campaign/campaign-completion.service';
import { VisitController } from '../controllers/visit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UniqueViewEntity,
      CampaignEntity,
      PromoterCampaign,
      UserEntity,
      CampaignBudgetTracking,
      PromoterDetailsEntity,
    ]),
  ],
  providers: [ViewsService, RateLimitService, CampaignCompletionService],
  controllers: [VisitController],
  exports: [ViewsService, RateLimitService, CampaignCompletionService],
})
export class ViewsModule {}
