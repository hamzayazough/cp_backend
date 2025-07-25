import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.config';
import { StripeConnectService } from './services/stripe-connect.service';
import { StripePaymentService } from './services/stripe-payment.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { STRIPE_CLIENT } from './stripe.constants';
import {
  StripeConnectAccount,
  StripePaymentIntent,
  StripeTransfer,
  CampaignPaymentConfig,
  PlatformFee,
  StripeWebhookEvent,
  UserEntity,
  CampaignEntity,
} from '../database/entities';
import { ConnectController } from './controllers/connect.controller';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StripeConnectAccount,
      StripePaymentIntent,
      StripeTransfer,
      CampaignPaymentConfig,
      PlatformFee,
      StripeWebhookEvent,
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
        console.log('Config loaded:', {
          hasSecretKey: !!config.secretKey,
          apiVersion: config.apiVersion,
        });
        if (!config.secretKey) {
          throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        const stripeInstance = new Stripe(config.secretKey, {
          apiVersion: config.apiVersion as Stripe.LatestApiVersion,
          typescript: true,
        });
        console.log('Stripe client created successfully:', !!stripeInstance);
        return stripeInstance;
      },
    },
    StripeConnectService,
    StripePaymentService,
    StripeWebhookService,
  ],
  exports: [
    STRIPE_CLIENT,
    StripeConnectService,
    StripePaymentService,
    StripeWebhookService,
  ],
})
export class StripeModule {}
