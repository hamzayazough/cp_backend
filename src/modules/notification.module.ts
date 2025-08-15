import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationEntity } from '../database/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [NotificationController],
  providers: [],
  exports: [TypeOrmModule],
})
export class NotificationModule {}
