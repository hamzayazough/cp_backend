import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageThread, Message, ChatSummary } from '../database/entities/message.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { MessagingService } from '../services/messaging/messaging.service';
import { MessagingController } from '../controllers/messaging.controller';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { UserModule } from './user.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageThread,
      Message,
      ChatSummary,
      UserEntity,
      CampaignEntity,
    ]),
    UserModule, // Import UserModule to get UserService
    AuthModule, // Import AuthModule to get FirebaseAuthService
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
