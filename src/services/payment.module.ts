import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from '../stripe/stripe.module';

// Entities
import { UserEntity } from '../database/entities/user.entity';
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
import { PaymentMethodService } from './payment-method.service';
import { WalletService } from './wallet.service';
import { CampaignFundingService } from './campaign-funding.service';
import { PromoterPaymentService } from './promoter-payment.service';
import { AdvertiserPaymentService } from './advertiser-payment-facade.service';

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
    AdvertiserPaymentService,
  ],
  exports: [
    PaymentMethodService,
    WalletService,
    CampaignFundingService,
    PromoterPaymentService,
    AdvertiserPaymentService,
  ],
})
export class PaymentModule {}
