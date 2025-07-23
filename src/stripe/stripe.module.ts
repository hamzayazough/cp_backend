import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.config';
import { StripeConnectService } from './services/stripe-connect.service';
import { StripePaymentService } from './services/stripe-payment.service';
import {
  StripeConnectAccount,
  StripePaymentIntent,
  StripeTransfer,
  CampaignPaymentConfig,
  PlatformFee,
  StripeWebhookEvent,
  BusinessProfile,
  UserEntity,
  CampaignEntity,
} from '../database/entities';
import { ConnectController } from './controllers/connect.controller';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';
import { StripeWebhookService } from './services/stripe-webhook.service';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      StripeConnectAccount,
      StripePaymentIntent,
      StripeTransfer,
      CampaignPaymentConfig,
      PlatformFee,
      StripeWebhookEvent,
      BusinessProfile,
      UserEntity,
      CampaignEntity,
    ]),
  ],
  controllers: [ConnectController, PaymentController, WebhookController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: () => {
        const config = stripeConfig();
        return new Stripe(config.secretKey, {
          apiVersion: config.apiVersion as Stripe.LatestApiVersion,
          typescript: true,
        });
      },
    },
    StripeConnectService,
    StripePaymentService,
    StripeWebhookService,
  ],
  exports: [STRIPE_CLIENT, StripeConnectService, StripePaymentService, StripeWebhookService],
})
export class StripeModule {}
