import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEarningsTracking } from '../database/entities/financial/campaign-earnings-tracking.entity';
import { CampaignViewTracking } from '../database/entities/financial/campaign-view-tracking.entity';
import { CampaignPayoutService } from '../services/campaign-payout.service';
import { CampaignEarningsService } from '../services/campaign-earnings.service';
import { PromoterPaymentService } from '../services/promoter/promoter-payment.service';
import { StripeConnectAccount } from '../database/entities/stripe-connect-account.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { StripeModule } from '../stripe/stripe.module';

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
    ]),
    StripeModule,
  ],
  providers: [CampaignPayoutService, CampaignEarningsService, PromoterPaymentService],
  exports: [CampaignPayoutService, CampaignEarningsService],
})
export class CampaignPayoutModule {}
