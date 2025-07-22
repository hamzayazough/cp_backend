import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoterController } from '../controllers/promoter.controller';
import { PromoterService } from '../services/promoter.service';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { CampaignApplicationEntity } from '../database/entities/campaign-applications.entity';
import { CampaignWorkEntity } from '../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../database/entities/campaign-work-comment.entity';
import { CampaignDeliverableEntity } from '../database/entities/campaign-deliverable.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CampaignEntity,
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
    ]),
  ],
  controllers: [PromoterController],
  providers: [PromoterService],
  exports: [PromoterService],
})
export class PromoterModule {}
