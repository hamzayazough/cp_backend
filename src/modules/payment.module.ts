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
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';

// Services
import { PaymentMethodService } from '../stripe/services/payment-method.service';
import { WalletService } from '../services/wallet.service';
import { CampaignFundingService } from '../services/campaign/campaign-funding.service';
import { PromoterPaymentService } from '../services/promoter/promoter-payment.service';
import { NotificationHelperService } from '../services/notification-helper.service';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { EmailService } from '../services/email/email.service';
import { PhoneService } from '../services/phone/phone.service';

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
      NotificationEntity,
      UserNotificationPreferenceEntity,
    ]),
    StripeModule,
  ],
  providers: [
    PaymentMethodService,
    WalletService,
    CampaignFundingService,
    PromoterPaymentService,
    NotificationHelperService,
    NotificationDeliveryService,
    EmailService,
    PhoneService,
  ],
  exports: [
    PaymentMethodService,
    WalletService,
    CampaignFundingService,
    PromoterPaymentService,
    NotificationHelperService,
    NotificationDeliveryService,
    EmailService,
    PhoneService,
  ],
})
export class PaymentModule {}
