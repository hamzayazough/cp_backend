import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.config';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (configService: ConfigService) => {
        const config = stripeConfig();
        return new Stripe(config.secretKey, {
          apiVersion: config.apiVersion as Stripe.LatestApiVersion,
          typescript: true,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
