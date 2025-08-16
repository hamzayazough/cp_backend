import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEarningsTracking } from '../database/entities/financial/campaign-earnings-tracking.entity';
import { CampaignViewTracking } from '../database/entities/financial/campaign-view-tracking.entity';
import { CampaignPayoutService } from '../services/campaign/campaign-payout.service';
import { CampaignEarningsService } from 'src/services/campaign/campaign-earnings.service';
import { PromoterPaymentService } from '../services/promoter/promoter-payment.service';
import { StripeConnectAccount } from '../database/entities/stripe-connect-account.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { StripeModule } from '../stripe/stripe.module';
import { NotificationHelperService } from 'src/services/notifications/notification-helper.service';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { EmailService } from '../services/email/email.service';
import { PhoneService } from '../services/phone/phone.service';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEarningsTracking,
      CampaignViewTracking,
      UniqueViewEntity,
      StripeConnectAccount,
      UserEntity,
      CampaignEntity,
      CampaignBudgetTracking,
      Wallet,
      Transaction,
      PromoterCampaign,
      PaymentRecord,
      NotificationEntity,
      UserNotificationPreferenceEntity,
    ]),
    StripeModule,
  ],
  providers: [
    CampaignPayoutService,
    CampaignEarningsService,
    PromoterPaymentService,
    NotificationHelperService,
    NotificationDeliveryService,
    EmailService,
    PhoneService,
  ],
  exports: [CampaignPayoutService, CampaignEarningsService],
})
export class CampaignPayoutModule {}
