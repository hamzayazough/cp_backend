import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvertiserController } from '../controllers/advertiser.controller';
import { AdvertiserService } from '../services/advertiser.service';
import { AdvertiserDashboardService } from '../services/advertiser-dashboard.service';
import { AdvertiserCampaignService } from '../services/advertiser-campaign.service';
import { AdvertiserWalletService } from '../services/advertiser-wallet.service';
import { AdvertiserStatsService } from '../services/advertiser-stats.service';
import { AdvertiserTransactionService } from '../services/advertiser-transaction.service';
import { AdvertiserMessageService } from '../services/advertiser-message.service';
import { CampaignService } from '../services/campaign.service';
import { S3Service } from '../services/s3.service';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { MessageThread, Message } from '../database/entities/message.entity';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { AdvertiserTypeMappingEntity } from '../database/entities/advertiser-type-mapping.entity';

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
      AdvertiserDetailsEntity,
      AdvertiserTypeMappingEntity,
    ]),
  ],
  controllers: [AdvertiserController],
  providers: [
    AdvertiserService,
    AdvertiserDashboardService,
    AdvertiserCampaignService,
    AdvertiserWalletService,
    AdvertiserStatsService,
    AdvertiserTransactionService,
    AdvertiserMessageService,
    CampaignService,
    S3Service,
  ],
  exports: [AdvertiserService, CampaignService],
})
export class AdvertiserModule {}
