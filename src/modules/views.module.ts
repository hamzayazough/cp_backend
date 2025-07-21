import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignBudgetAllocation } from '../database/entities/campaign-budget-allocation.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { ViewsService } from '../services/views.service';
import { RateLimitService } from '../services/rate-limit.service';
import { CampaignCompletionService } from '../services/campaign-completion.service';
import { VisitController } from '../controllers/visit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UniqueViewEntity,
      CampaignEntity,
      PromoterCampaign,
      UserEntity,
      CampaignBudgetAllocation,
      PromoterDetailsEntity,
    ]),
  ],
  providers: [ViewsService, RateLimitService, CampaignCompletionService],
  controllers: [VisitController],
  exports: [ViewsService, RateLimitService, CampaignCompletionService],
})
export class ViewsModule {}
