import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserEntity } from '../database/entities/user.entity';
import { NotificationQueryService } from '../services/notifications/notification-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, UserEntity])],
  controllers: [NotificationController],
  providers: [NotificationQueryService],
  exports: [TypeOrmModule, NotificationQueryService],
})
export class NotificationModule {}
