import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { EmailService } from '../services/email/email.service';
import { CampaignNotificationService } from '../services/campaign/campaign-notification.service';
import { CampaignCompletionService } from '../services/campaign/campaign-management.service';
import { CampaignExpirationService } from '../services/campaign/campaign-expiration.service';
import { CampaignManagementController } from '../controllers/campaign-management.controller';
import { PaymentModule } from './payment.module';
import { AdvertiserModule } from './advertiser.module';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { NotificationHelperService } from 'src/services/notifications/notification-helper.service';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';
import { PhoneService } from '../services/phone/phone.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PaymentModule,
    AdvertiserModule,
    TypeOrmModule.forFeature([
      CampaignEntity,
      PromoterCampaign,
      UserEntity,
      PromoterDetailsEntity,
      CampaignBudgetTracking,
      UniqueViewEntity,
      Wallet,
      Transaction,
      NotificationEntity,
      UserNotificationPreferenceEntity,
    ]),
  ],
  controllers: [CampaignManagementController],
  providers: [
    EmailService,
    PhoneService,
    CampaignNotificationService,
    CampaignCompletionService,
    CampaignExpirationService,
    NotificationDeliveryService,
    NotificationHelperService,
  ],
  exports: [
    EmailService,
    PhoneService,
    CampaignNotificationService,
    CampaignCompletionService,
    CampaignExpirationService,
    NotificationDeliveryService,
    NotificationHelperService,
  ],
})
export class CampaignManagementModule {}
