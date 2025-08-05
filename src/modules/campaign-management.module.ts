import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { EmailService } from '../services/email/email.service';
import { CampaignNotificationService } from '../services/campaign/campaign-notification.service';
import { CampaignCompletionService } from '../services/campaign/campaign-management.service';
import { CampaignExpirationService } from '../services/campaign/campaign-expiration.service';
import { CampaignManagementController } from '../controllers/campaign-management.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      CampaignEntity,
      PromoterCampaign,
      UserEntity,
      PromoterDetailsEntity,
    ]),
  ],
  controllers: [CampaignManagementController],
  providers: [
    EmailService,
    CampaignNotificationService,
    CampaignCompletionService,
    CampaignExpirationService,
  ],
  exports: [
    EmailService,
    CampaignNotificationService,
    CampaignCompletionService,
    CampaignExpirationService,
  ],
})
export class CampaignManagementModule {}
