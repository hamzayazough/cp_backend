import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Services
// import { PaymentServiceImpl } from '../services/payment-orchestrator.service'; // TODO: Disabled
// import { PaymentProcessingService } from '../services/payment-processing.service'; // TODO: Disabled
// import { AccountingService } from '../services/accounting.service'; // TODO: Disabled
import { StripeIntegrationService } from '../services/stripe-integration.service';

// Entities
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PromoterBalance as PromoterBalanceEntity } from '../database/entities/promoter-balance.entity';
import { UserEntity } from '../database/entities/user.entity';

/**
 * Payment Module - organizes all payment-related services
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      PromoterCampaign,
      PaymentRecord,
      Transaction,
      Wallet,
      PromoterBalanceEntity,
      UserEntity,
    ]),
  ],
  providers: [
    // Core payment services
    // PaymentProcessingService, // TODO: Disabled until refactored to use PaymentRecord
    // AccountingService, // TODO: Disabled until refactored to use PaymentRecord
    StripeIntegrationService,

    // Main orchestrator service
    // {
    //   provide: 'PaymentService',
    //   useClass: PaymentServiceImpl,
    // },

    // Also provide as PaymentServiceImpl for direct injection
    // PaymentServiceImpl, // TODO: Disabled until refactored to use PaymentRecord
  ],
  exports: [
    // 'PaymentService', // TODO: Disabled until refactored to use PaymentRecord
    // PaymentServiceImpl, // TODO: Disabled until refactored to use PaymentRecord
    // PaymentProcessingService, // TODO: Disabled until refactored to use PaymentRecord
    // AccountingService, // TODO: Disabled until refactored to use PaymentRecord
    StripeIntegrationService,
  ],
})
export class PaymentModule {}
