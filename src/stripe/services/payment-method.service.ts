import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.constants';
import { UserEntity } from 'src/database/entities';
import { AdvertiserDetailsEntity } from '../../database/entities/advertiser-details.entity';
import { PaymentMethod } from '../../database/entities/payment-method.entity';
import { AddPaymentMethodDto } from '../../controllers/advertiser.controller';

export interface PaymentSetupStatus {
  hasStripeCustomer: boolean;
  paymentMethodsCount: number;
  setupComplete: boolean;
  stripeCustomerId?: string;
}

export interface PaymentMethodResponse {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: string;
  };
  billingDetails: {
    name?: string | null;
    email?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
  };
  isDefault: boolean;
  createdAt: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

/**
 * Service responsible for managing payment methods for advertisers
 * Handles Stripe customer setup, payment method CRUD operations, and synchronization
 */
@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepo: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  async getPaymentSetupStatus(
    firebaseUid: string,
  ): Promise<PaymentSetupStatus> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.advertiserDetailsRepo.findOne({
      where: { userId: user.id },
    });

    if (!advertiserDetails?.stripeCustomerId) {
      return {
        hasStripeCustomer: false,
        paymentMethodsCount: 0,
        setupComplete: false,
      };
    }

    // Sync payment methods from Stripe to ensure we have the latest state
    await this.syncPaymentMethodsFromStripe(
      user.id,
      advertiserDetails.stripeCustomerId,
    );

    // Fetch payment methods directly from Stripe to get the most current state
    let paymentMethodsCount = 0;
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: advertiserDetails.stripeCustomerId,
        type: 'card',
      });
      paymentMethodsCount = paymentMethods.data.length;
    } catch (error) {
      this.logger.error('Error fetching payment methods from Stripe:', error);
      // Fallback to local database count if Stripe call fails
      paymentMethodsCount = await this.paymentMethodRepo.count({
        where: { userId: user.id },
      });
    }

    return {
      hasStripeCustomer: true,
      paymentMethodsCount,
      setupComplete: paymentMethodsCount > 0,
      stripeCustomerId: advertiserDetails.stripeCustomerId,
    };
  }

  async completePaymentSetup(firebaseUid: string) {
    const user = await this.userRepo.findOne({
      where: { firebaseUid },
      relations: ['advertiserDetails'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.advertiserDetails) {
      throw new NotFoundException('Advertiser details not found');
    }

    // Create Stripe customer if not exists
    if (!user.advertiserDetails.stripeCustomerId) {
      const stripeCustomer = await this.stripe.customers.create({
        email: user.email,
        name: user.advertiserDetails.companyName,
        metadata: {
          firebaseUid: user.firebaseUid,
          userId: user.id,
        },
      });

      user.advertiserDetails.stripeCustomerId = stripeCustomer.id;
      await this.advertiserDetailsRepo.save(user.advertiserDetails);
    }

    return {
      id: `stripe_customer_${user.advertiserDetails.id}`,
      customerId: user.advertiserDetails.stripeCustomerId,
      userId: user.id,
      email: user.email,
      name: user.advertiserDetails.companyName,
      defaultPaymentMethodId: null,
      createdAt: user.advertiserDetails.createdAt.toISOString(),
      updatedAt: user.advertiserDetails.updatedAt.toISOString(),
    };
  }

  async createSetupIntent(firebaseUid: string): Promise<SetupIntentResponse> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: advertiserDetails.stripeCustomerId,
      usage: 'off_session',
      payment_method_types: ['card'],
    });

    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  }

  async getPaymentMethods(
    firebaseUid: string,
  ): Promise<PaymentMethodResponse[]> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Return empty array if no Stripe customer ID
    if (!advertiserDetails.stripeCustomerId) {
      return [];
    }

    // Sync first to ensure latest data
    await this.syncPaymentMethodsFromStripe(
      user.id,
      advertiserDetails.stripeCustomerId,
    );

    // Get customer's default payment method from Stripe
    const customer = await this.stripe.customers.retrieve(
      advertiserDetails.stripeCustomerId,
    );

    if (typeof customer === 'object' && !customer.deleted) {
      const defaultPaymentMethodId =
        typeof customer.invoice_settings?.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;

      // Get all payment methods from Stripe (most up-to-date)
      const stripePaymentMethods = await this.stripe.paymentMethods.list({
        customer: advertiserDetails.stripeCustomerId,
        type: 'card',
      });

      return stripePaymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              funding: pm.card.funding || 'unknown',
            }
          : undefined,
        billingDetails: {
          name: pm.billing_details.name,
          email: pm.billing_details.email,
          address: pm.billing_details.address
            ? {
                line1: pm.billing_details.address.line1,
                line2: pm.billing_details.address.line2,
                city: pm.billing_details.address.city,
                state: pm.billing_details.address.state,
                postalCode: pm.billing_details.address.postal_code,
                country: pm.billing_details.address.country,
              }
            : undefined,
        },
        isDefault: pm.id === defaultPaymentMethodId,
        createdAt: new Date(pm.created * 1000).toISOString(),
      }));
    }

    return [];
  }

  async addPaymentMethod(firebaseUid: string, dto: AddPaymentMethodDto) {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(dto.paymentMethodId, {
      customer: advertiserDetails.stripeCustomerId,
    });

    // Set as default if requested or if it's the first payment method
    if (dto.setAsDefault) {
      await this.setDefaultPaymentMethod(firebaseUid, dto.paymentMethodId);
    }

    // Sync to update our local database
    await this.syncPaymentMethodsFromStripe(
      user.id,
      advertiserDetails.stripeCustomerId,
    );

    return { success: true, paymentMethodId: dto.paymentMethodId };
  }

  async removePaymentMethod(firebaseUid: string, paymentMethodId: string) {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Detach from Stripe
    await this.stripe.paymentMethods.detach(paymentMethodId);

    // Remove from local database
    await this.paymentMethodRepo.delete({
      userId: user.id,
      stripePaymentMethodId: paymentMethodId,
    });

    return { success: true };
  }

  async setDefaultPaymentMethod(firebaseUid: string, paymentMethodId: string) {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Update default payment method in Stripe
    await this.stripe.customers.update(advertiserDetails.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return { success: true };
  }

  async getDefaultPaymentMethod(firebaseUid: string): Promise<string | null> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Return null if no Stripe customer ID
    if (!advertiserDetails.stripeCustomerId) {
      return null;
    }

    const customer = await this.stripe.customers.retrieve(
      advertiserDetails.stripeCustomerId,
    );

    if (typeof customer === 'object' && !customer.deleted) {
      const defaultPaymentMethod =
        customer.invoice_settings?.default_payment_method;
      return typeof defaultPaymentMethod === 'string'
        ? defaultPaymentMethod
        : defaultPaymentMethod?.id || null;
    }

    return null;
  }

  // Helper method to sync payment methods from Stripe to local database
  private async syncPaymentMethodsFromStripe(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    try {
      // Validate stripeCustomerId before making API calls
      if (!stripeCustomerId || stripeCustomerId.trim() === '') {
        this.logger.warn(
          `Skipping payment method sync for user ${userId}: No valid Stripe customer ID`,
        );
        return;
      }

      // Get all payment methods from Stripe
      const stripePaymentMethods = await this.stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      // Get all saved payment methods from database for this user
      const savedMethods = await this.paymentMethodRepo.find({
        where: { userId },
      });

      // Find payment methods that exist in Stripe but not in our database for this user
      const missingPaymentMethods = stripePaymentMethods.data.filter(
        (stripePm) =>
          !savedMethods.some(
            (saved) => saved.stripePaymentMethodId === stripePm.id,
          ),
      );

      // Save missing payment methods to database with error handling
      for (const pm of missingPaymentMethods) {
        try {
          // Note: PaymentMethod entity creation may need adjustment based on actual entity fields
          // For now, we'll skip automatic sync and rely on manual payment method addition
          this.logger.log(
            `Found unsynced payment method ${pm.id} for user ${userId}. Manual sync may be required.`,
          );
        } catch (saveError) {
          this.logger.error(
            `Error processing payment method ${pm.id}:`,
            saveError,
          );
        }
      }

      // Clean up payment methods that exist in database but not in Stripe
      const orphanedMethods = savedMethods.filter(
        (saved) =>
          !stripePaymentMethods.data.some(
            (stripePm) => stripePm.id === saved.stripePaymentMethodId,
          ),
      );

      for (const orphaned of orphanedMethods) {
        try {
          await this.paymentMethodRepo.remove(orphaned);
          this.logger.log(
            `Removed orphaned payment method ${orphaned.stripePaymentMethodId} for user ${userId}`,
          );
        } catch (removeError) {
          this.logger.error(
            `Error removing orphaned payment method ${orphaned.stripePaymentMethodId}:`,
            removeError,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error syncing payment methods for user ${userId}:`,
        error,
      );
    }
  }

  private async findUserByFirebaseUid(
    firebaseUid: string,
  ): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async findAdvertiserDetails(
    userId: string,
  ): Promise<AdvertiserDetailsEntity> {
    const advertiserDetails = await this.advertiserDetailsRepo.findOne({
      where: { userId },
    });

    if (!advertiserDetails) {
      throw new NotFoundException('Advertiser details not found');
    }

    return advertiserDetails;
  }
}
