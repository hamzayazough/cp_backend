import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeWebhookService } from '../services/stripe-webhook.service';

@Controller('stripe/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly endpointSecret: string;

  constructor(
    private readonly webhookService: StripeWebhookService,
    private readonly configService: ConfigService,
  ) {
    this.endpointSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    if (!this.endpointSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not configured. Webhook signature verification will fail.',
      );
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log('Received Stripe webhook');

    if (!signature) {
      this.logger.error('Missing stripe-signature header');
      throw new Error('Missing stripe-signature header');
    }

    try {
      // Construct and verify the event
      const event = this.webhookService.constructEvent(
        rawBody,
        signature,
        this.endpointSecret,
      );

      this.logger.log(`Webhook event verified: ${event.type} (${event.id})`);

      // Check for duplicate events (idempotency)
      const isProcessed = await this.webhookService.isEventProcessed(event.id);
      if (isProcessed) {
        this.logger.log(`Event ${event.id} already processed, skipping`);
        return { received: true };
      }

      // Log the event to database
      await this.webhookService.logWebhookEvent(event);

      // Process the event
      await this.webhookService.processWebhookEvent(event);

      this.logger.log(
        `Successfully handled webhook: ${event.type} (${event.id})`,
      );
      return { received: true };
    } catch (error: any) {
      this.logger.error('Webhook processing failed:', error);

      // Return 200 to acknowledge receipt even on processing errors
      // to prevent Stripe from retrying valid but problematic events
      if (error?.message?.includes('Invalid webhook signature')) {
        throw error; // Re-throw signature errors as they should return 400
      }

      return { received: true };
    }
  }
}
