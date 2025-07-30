import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from '../stripe/stripe.module';

// Entities
import { UserEntity } from 'src/database/entities';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { PaymentMethod } from '../database/entities/payment-method.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { StripeConnectAccount } from '../database/entities/stripe-connect-account.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';

// Services
import { PaymentMethodService } from '../stripe/services/payment-method.service';
import { WalletService } from '../services/wallet.service';
import { CampaignFundingService } from '../services/campaign/campaign-funding.service';
import { PromoterPaymentService } from '../services/promoter/promoter-payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AdvertiserDetailsEntity,
      PaymentMethod,
      PaymentRecord,
      Wallet,
      Transaction,
      CampaignEntity,
      CampaignBudgetTracking,
      StripeConnectAccount,
      PromoterCampaign,
    ]),
    StripeModule,
  ],
  providers: [
    PaymentMethodService,
    WalletService,
    CampaignFundingService,
    PromoterPaymentService,
  ],
  exports: [
    PaymentMethodService,
    WalletService,
    CampaignFundingService,
    PromoterPaymentService,
  ],
})
export class PaymentModule {}
