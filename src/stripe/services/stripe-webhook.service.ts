import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { StripeWebhookEvent } from '../../database/entities/stripe-webhook-event.entity';
import { StripeConnectService } from './stripe-connect.service';
import { StripePaymentService } from './stripe-payment.service';
import { UserService } from '../../services/user.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @InjectRepository(StripeWebhookEvent)
    private readonly webhookEventRepository: Repository<StripeWebhookEvent>,
    private readonly stripeConnectService: StripeConnectService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly userService: UserService,
  ) {}

  /**
   * Verify webhook signature and construct event
   */
  constructEvent(
    payload: string | Buffer,
    signature: string,
    endpointSecret: string,
  ): Stripe.Event {
    try {
      const stripe = this.stripeConnectService.getStripeInstance();
      return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Check if event has already been processed (idempotency)
   */
  async isEventProcessed(stripeEventId: string): Promise<boolean> {
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { stripeEventId },
    });
    return existingEvent?.processed || false;
  }

  /**
   * Log webhook event to database
   */
  async logWebhookEvent(event: Stripe.Event): Promise<StripeWebhookEvent> {
    const webhookEvent = this.webhookEventRepository.create({
      stripeEventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      objectId: (event.data.object as any).id || '',
      objectType: event.data.object.object,
      processed: false,
      rawEventData: event,
    });

    return this.webhookEventRepository.save(webhookEvent);
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    await this.webhookEventRepository.update(
      { stripeEventId: eventId },
      {
        processed: !error,
        processedAt: new Date(),
        processingError: error,
        retryCount: error ? () => 'retry_count + 1' : undefined,
      },
    );
  }

  /**
   * Process webhook event based on type
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        // Payment Intent Events
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event);
          break;

        // Connect Account Events
        case 'account.updated':
          await this.handleAccountUpdated(event);
          break;
        case 'account.application.deauthorized':
          await this.handleAccountDeauthorized(event);
          break;

        // Transfer Events
        case 'transfer.created':
          await this.handleTransferCreated(event);
          break;
        case 'transfer.reversed':
          await this.handleTransferFailed(event);
          break;
        case 'transfer.updated':
          await this.handleTransferPaid(event);
          break;

        // Payout Events
        case 'payout.created':
          await this.handlePayoutCreated(event);
          break;
        case 'payout.failed':
          await this.handlePayoutFailed(event);
          break;
        case 'payout.paid':
          await this.handlePayoutPaid(event);
          break;

        // Person Events (for business accounts)
        case 'person.created':
          await this.handlePersonCreated(event);
          break;
        case 'person.updated':
          await this.handlePersonUpdated(event);
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }

      await this.markEventProcessed(event.id);
      this.logger.log(`Successfully processed webhook event: ${event.id}`);
    } catch (error: any) {
      this.logger.error(`Error processing webhook event ${event.id}:`, error);
      await this.markEventProcessed(
        event.id,
        error?.message || 'Unknown error',
      );
      throw error;
    }
  }

  // Event Handlers

  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await this.stripePaymentService.updatePaymentIntentFromWebhook(
      paymentIntent.id,
      { status: 'succeeded' },
    );
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await this.stripePaymentService.updatePaymentIntentFromWebhook(
      paymentIntent.id,
      { status: 'failed' },
    );
  }

  private async handlePaymentIntentCanceled(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await this.stripePaymentService.updatePaymentIntentFromWebhook(
      paymentIntent.id,
      { status: 'canceled' },
    );
  }

  private async handleAccountUpdated(event: Stripe.Event): Promise<void> {
    const account = event.data.object as Stripe.Account;

    // Update account status in database
    await this.stripeConnectService.updateAccountFromWebhook(account.id, {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      status:
        account.charges_enabled && account.payouts_enabled
          ? 'active'
          : 'pending',
    });

    // Check if onboarding is complete and mark user setup as done
    const isOnboardingComplete =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    if (isOnboardingComplete) {
      try {
        // Get the user's Firebase UID from the connected account
        const stripeAccount =
          await this.stripeConnectService.getAccountByStripeId(account.id);

        if (stripeAccount && stripeAccount.userId) {
          this.logger.log(
            `Marking user setup complete for Firebase UID: ${stripeAccount.userId}`,
          );
          await this.userService.markSetupComplete(stripeAccount.userId);
          this.logger.log(
            `Successfully marked user ${stripeAccount.userId} setup as complete`,
          );
        } else {
          this.logger.warn(
            `Could not find user for Stripe account: ${account.id}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to mark user setup complete for account ${account.id}:`,
          error,
        );
        // Don't throw error here - webhook should still succeed even if user update fails
      }
    }
  }

  private async handleAccountDeauthorized(event: Stripe.Event): Promise<void> {
    const deauthorization = event.data.object as Stripe.Application;
    if (deauthorization.id) {
      await this.stripeConnectService.updateAccountFromWebhook(
        deauthorization.id,
        {
          status: 'deauthorized',
        },
      );
    }
  }

  private async handleTransferCreated(event: Stripe.Event): Promise<void> {
    const transfer = event.data.object as Stripe.Transfer;
    await this.stripePaymentService.updateTransferFromWebhook(transfer.id, {
      status: 'pending',
    });
  }

  private async handleTransferFailed(event: Stripe.Event): Promise<void> {
    const transfer = event.data.object as Stripe.Transfer;
    await this.stripePaymentService.updateTransferFromWebhook(transfer.id, {
      status: 'failed',
    });
  }

  private async handleTransferPaid(event: Stripe.Event): Promise<void> {
    const transfer = event.data.object as Stripe.Transfer;
    await this.stripePaymentService.updateTransferFromWebhook(transfer.id, {
      status: 'paid',
    });
  }

  private handlePayoutCreated(event: Stripe.Event): void {
    const payout = event.data.object as Stripe.Payout;
    this.logger.log(
      `Payout created: ${payout.id} for account: ${String(payout.destination)}`,
    );
    // Additional payout tracking logic can be added here
  }

  private handlePayoutFailed(event: Stripe.Event): void {
    const payout = event.data.object as Stripe.Payout;
    this.logger.warn(
      `Payout failed: ${payout.id} for account: ${String(payout.destination)}`,
    );
    // Additional error handling logic can be added here
  }

  private handlePayoutPaid(event: Stripe.Event): void {
    const payout = event.data.object as Stripe.Payout;
    this.logger.log(
      `Payout completed: ${payout.id} for account: ${String(payout.destination)}`,
    );
    // Additional completion tracking logic can be added here
  }

  private handlePersonCreated(event: Stripe.Event): void {
    const person = event.data.object as Stripe.Person;
    this.logger.log(
      `Person created: ${person.id} for account: ${person.account}`,
    );
    // Business profile person tracking logic can be added here
  }

  private handlePersonUpdated(event: Stripe.Event): void {
    const person = event.data.object as Stripe.Person;
    this.logger.log(
      `Person updated: ${person.id} for account: ${person.account}`,
    );
    // Business profile person update logic can be added here
  }
}
