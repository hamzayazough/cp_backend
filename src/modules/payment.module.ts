import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Services
import { PaymentServiceImpl } from '../services/payment-orchestrator.service';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { AccountingService } from '../services/accounting.service';
import { StripeIntegrationService } from '../services/stripe-integration.service';

// Entities
import { Campaign as CampaignEntity } from '../database/entities/campaign.entity';
import { PayoutRecord as PayoutRecordEntity } from '../database/entities/payout-record.entity';
import { AdvertiserCharge as AdvertiserChargeEntity } from '../database/entities/advertiser-charge.entity';
import { PromoterBalance as PromoterBalanceEntity } from '../database/entities/promoter-balance.entity';
import { AdvertiserSpend as AdvertiserSpendEntity } from '../database/entities/advertiser-spend.entity';
import { UserEntity } from '../database/entities/user.entity';

/**
 * Payment Module - organizes all payment-related services
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      PayoutRecordEntity,
      AdvertiserChargeEntity,
      PromoterBalanceEntity,
      AdvertiserSpendEntity,
      UserEntity,
    ]),
  ],
  providers: [
    // Core payment services
    PaymentProcessingService,
    AccountingService,
    StripeIntegrationService,

    // Main orchestrator service
    {
      provide: 'PaymentService',
      useClass: PaymentServiceImpl,
    },

    // Also provide as PaymentServiceImpl for direct injection
    PaymentServiceImpl,
  ],
  exports: [
    'PaymentService',
    PaymentServiceImpl,
    PaymentProcessingService,
    AccountingService,
    StripeIntegrationService,
  ],
})
export class PaymentModule {}
