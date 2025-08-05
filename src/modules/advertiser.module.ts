import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvertiserController } from '../controllers/advertiser.controller';
import { AdvertiserService } from '../services/advertiser/advertiser.service';
import { AdvertiserCampaignService } from 'src/services/advertiser/advertiser-campaign.service';
import { AdvertiserWalletService } from 'src/services/advertiser/advertiser-wallet.service';
import { AdvertiserStatsService } from 'src/services/advertiser/advertiser-stats.service';
import { AdvertiserTransactionService } from 'src/services/advertiser/advertiser-transaction.service';
import { AdvertiserMessageService } from 'src/services/advertiser/advertiser-message.service';
import { CampaignService } from 'src/services/campaign/campaign.service';
import { CampaignMediaService } from 'src/services/campaign/campaign-media.service';
import { S3Service } from '../services/s3.service';
import { PromoterModule } from './promoter.module';
import { PaymentModule } from './payment.module';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { AdvertiserTypeMappingEntity } from '../database/entities/advertiser-type-mapping.entity';
import { CampaignApplicationEntity } from '../database/entities/campaign-applications.entity';
import { CampaignDeliverableEntity } from '../database/entities/campaign-deliverable.entity';
import { CampaignWorkEntity } from '../database/entities/campaign-work.entity';
import { CampaignWorkCommentEntity } from '../database/entities/campaign-work-comment.entity';
import { SalesRecordEntity } from '../database/entities/sales-record.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { CampaignMedia } from '../database/entities/campaign-media.entity';
import { UniqueViewEntity } from 'src/database/entities';
import { AdvertiserPaymentService } from 'src/services/advertiser/advertiser-payment-facade.service';

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
      AdvertiserDetailsEntity,
      AdvertiserTypeMappingEntity,
      CampaignApplicationEntity,
      CampaignDeliverableEntity,
      CampaignWorkEntity,
      CampaignWorkCommentEntity,
      SalesRecordEntity,
      CampaignBudgetTracking, // Added back for AdvertiserStatsService
      UniqueViewEntity,
    ]),
    PromoterModule,
    PaymentModule, // Import the payment module instead of individual services
  ],
  controllers: [AdvertiserController],
  providers: [
    AdvertiserService,
    AdvertiserCampaignService,
    AdvertiserWalletService,
    AdvertiserStatsService,
    AdvertiserTransactionService,
    AdvertiserMessageService,
    AdvertiserPaymentService,
    CampaignService,
    CampaignMediaService,
    S3Service,
  ],
  exports: [AdvertiserService, CampaignService],
})
export class AdvertiserModule {}
