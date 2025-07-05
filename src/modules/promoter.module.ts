import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoterController } from '../controllers/promoter.controller';
import { PromoterService } from '../services/promoter.service';
import { UserEntity } from '../database/entities/user.entity';
import { Campaign } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      Campaign,
      Transaction,
      Wallet,
      PromoterCampaign,
      MessageThread,
      Message,
    ]),
  ],
  controllers: [PromoterController],
  providers: [PromoterService],
  exports: [PromoterService],
})
export class PromoterModule {}
