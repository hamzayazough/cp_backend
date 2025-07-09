import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../database/entities/user.entity';

// For now, we'll create a simplified Stripe interface to avoid type issues
interface StripePaymentIntent {
  id: string;
  status: string;
}

interface StripeTransfer {
  id: string;
}

interface StripeRefund {
  id: string;
}

interface StripeAccount {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements?: {
    disabled_reason?: string;
  };
}

interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  payment_method: string;
  confirm: boolean;
  metadata: Record<string, string>;
}

interface CreateTransferParams {
  amount: number;
  currency: string;
  destination: string;
  metadata: Record<string, string>;
}

interface CreateRefundParams {
  charge: string;
  amount: number;
  metadata: Record<string, string>;
}

// Simplified Stripe service interface
interface StripeService {
  paymentIntents: {
    create: (params: CreatePaymentIntentParams) => Promise<StripePaymentIntent>;
  };
  transfers: {
    create: (params: CreateTransferParams) => Promise<StripeTransfer>;
  };
  refunds: {
    create: (params: CreateRefundParams) => Promise<StripeRefund>;
  };
  accounts: {
    create: (params: any) => Promise<StripeAccount>;
    retrieve: (accountId: string) => Promise<StripeAccount>;
  };
}

/**
 * Service responsible for all Stripe integration and payment processing
 */
@Injectable()
export class StripeIntegrationService {
  private readonly logger = new Logger(StripeIntegrationService.name);
  private readonly stripe: StripeService;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    // Initialize Stripe - for now using a mock implementation
    this.stripe = this.createMockStripe();
  }

  /**
   * Create a payment intent for charging customers
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<StripePaymentIntent> {
    try {
      this.logger.log(
        `Creating payment intent for amount $${params.amount / 100}`,
      );

      const paymentIntent = await this.stripe.paymentIntents.create(params);

      this.logger.log(
        `Created payment intent ${paymentIntent.id} with status ${paymentIntent.status}`,
      );
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  /**
   * Create a transfer to a connected account
   */
  async createTransfer(params: CreateTransferParams): Promise<StripeTransfer> {
    try {
      this.logger.log(
        `Creating transfer of $${params.amount / 100} to ${params.destination}`,
      );

      const transfer = await this.stripe.transfers.create(params);

      this.logger.log(`Created transfer ${transfer.id}`);
      return transfer;
    } catch (error) {
      this.logger.error(
        `Failed to create transfer: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create transfer');
    }
  }

  /**
   * Create a refund for a charge
   */
  async createRefund(params: CreateRefundParams): Promise<StripeRefund> {
    try {
      this.logger.log(
        `Creating refund of $${params.amount / 100} for charge ${params.charge}`,
      );

      const refund = await this.stripe.refunds.create(params);

      this.logger.log(`Created refund ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(
        `Failed to create refund: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create refund');
    }
  }

  /**
   * Validate Stripe account for a user
   */
  async validateStripeAccount(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user || !user.stripeAccountId) {
        return false;
      }

      const account = await this.stripe.accounts.retrieve(user.stripeAccountId);
      return account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      this.logger.error(
        `Failed to validate Stripe account: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Create Stripe Connect account for a user
   */
  async createStripeConnectAccount(userId: string): Promise<string> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        metadata: {
          userId: userId,
        },
      });

      // Update user with Stripe account ID
      await this.userRepository.update(userId, {
        stripeAccountId: account.id,
      });

      this.logger.log(
        `Created Stripe Connect account ${account.id} for user ${userId}`,
      );
      return account.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe Connect account: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create Stripe account');
    }
  }

  /**
   * Get Stripe account status for a user
   */
  async getStripeAccountStatus(
    userId: string,
  ): Promise<'pending' | 'active' | 'rejected'> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user || !user.stripeAccountId) {
        return 'pending';
      }

      const account = await this.stripe.accounts.retrieve(user.stripeAccountId);

      if (account.charges_enabled && account.payouts_enabled) {
        return 'active';
      } else if (account.requirements?.disabled_reason) {
        return 'rejected';
      } else {
        return 'pending';
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Stripe account status: ${error.message}`,
        error.stack,
      );
      return 'pending';
    }
  }

  /**
   * Mock Stripe implementation for development
   * Replace this with real Stripe SDK when ready
   */
  private createMockStripe(): StripeService {
    return {
      paymentIntents: {
        create: async (
          params: CreatePaymentIntentParams,
        ): Promise<StripePaymentIntent> => {
          // Mock implementation - replace with real Stripe
          this.logger.warn('Using mock Stripe payment intent creation');
          return {
            id: `pi_mock_${Date.now()}`,
            status: 'succeeded',
          };
        },
      },
      transfers: {
        create: async (
          params: CreateTransferParams,
        ): Promise<StripeTransfer> => {
          // Mock implementation - replace with real Stripe
          this.logger.warn('Using mock Stripe transfer creation');
          return {
            id: `tr_mock_${Date.now()}`,
          };
        },
      },
      refunds: {
        create: async (params: CreateRefundParams): Promise<StripeRefund> => {
          // Mock implementation - replace with real Stripe
          this.logger.warn('Using mock Stripe refund creation');
          return {
            id: `re_mock_${Date.now()}`,
          };
        },
      },
      accounts: {
        create: async (params: any): Promise<StripeAccount> => {
          // Mock implementation - replace with real Stripe
          this.logger.warn('Using mock Stripe account creation');
          return {
            id: `acct_mock_${Date.now()}`,
            charges_enabled: true,
            payouts_enabled: true,
          };
        },
        retrieve: async (accountId: string): Promise<StripeAccount> => {
          // Mock implementation - replace with real Stripe
          this.logger.warn('Using mock Stripe account retrieval');
          return {
            id: accountId,
            charges_enabled: true,
            payouts_enabled: true,
          };
        },
      },
    };
  }
}
