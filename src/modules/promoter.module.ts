import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoterController } from '../controllers/promoter.controller';
import { PromoterService } from 'src/services/promoter/promoter.service';
import { PromoterDashboardService } from '../services/promoter/promoter-dashboard.service';
import { PromoterCampaignService } from '../services/promoter/promoter-campaign.service';
import { PromoterMyCampaignService } from '../services/promoter/promoter-my-campaign.service';
import { PromoterCampaignInteractionService } from '../services/promoter/promoter-campaign-interaction.service';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { CampaignApplicationEntity } from '../database/entities/campaign-applications.entity';
import { CampaignWorkEntity } from '../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from '../database/entities/campaign-deliverable.entity';
import { CampaignMedia } from '../database/entities/campaign-media.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { DiscordService } from '../services/discord.service';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { EmailService } from '../services/email/email.service';
import { PhoneService } from '../services/phone/phone.service';
import { NotificationHelperService } from '../services/notification-helper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CampaignEntity,
      CampaignMedia,
      Transaction,
      Wallet,
      PromoterCampaign,
      MessageThread,
      Message,
      CampaignApplicationEntity,
      CampaignWorkEntity,
      CampaignWorkCommentEntity,
      CampaignDeliverableEntity,
      UniqueViewEntity,
      UserNotificationPreferenceEntity,
      NotificationEntity,
    ]),
  ],
  controllers: [PromoterController],
  providers: [
    PromoterService,
    PromoterDashboardService,
    PromoterCampaignService,
    PromoterMyCampaignService,
    PromoterCampaignInteractionService,
    DiscordService,
    NotificationDeliveryService,
    EmailService,
    PhoneService,
    NotificationHelperService,
  ],
  exports: [PromoterService],
})
export class PromoterModule {}
