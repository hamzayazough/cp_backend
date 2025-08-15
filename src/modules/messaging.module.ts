import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MessageThread,
  Message,
  ChatSummary,
} from '../database/entities/message.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { MessagingService } from '../services/messaging/messaging.service';
import { MessagingController } from '../controllers/messaging.controller';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { UserModule } from './user.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { NotificationHelperService } from '../services/notification-helper.service';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';
import { EmailService } from '../services/email/email.service';
import { PhoneService } from '../services/phone/phone.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageThread,
      Message,
      ChatSummary,
      UserEntity,
      CampaignEntity,
      NotificationEntity,
      UserNotificationPreferenceEntity,
    ]),
    UserModule, // Import UserModule to get UserService
    AuthModule, // Import AuthModule to get FirebaseAuthService
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingGateway,
    NotificationDeliveryService,
    NotificationHelperService,
    EmailService,
    PhoneService,
  ],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
