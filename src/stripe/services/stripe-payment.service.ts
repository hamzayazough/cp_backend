import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.constants';
import { StripePaymentIntent } from '../../database/entities/stripe-payment-intent.entity';
import { StripeTransfer } from '../../database/entities/stripe-transfer.entity';
import { CampaignPaymentConfig } from '../../database/entities/campaign-payment-config.entity';
import { PlatformFee } from '../../database/entities/platform-fee.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { UserEntity } from 'src/database/entities';
import { AdvertiserDetailsEntity } from '../../database/entities/advertiser-details.entity';
import { StripeConnectService } from './stripe-connect.service';
import { stripeConfig } from '../../config/stripe.config';

export interface CreatePaymentIntentDto {
  campaignId: string;
  payerId: string;
  recipientId: string;
  amount: number; // Amount in dollars
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateCampaignPaymentConfigDto {
  campaignId: string;
  platformFeePercentage?: number;
  autoTransfer?: boolean;
  captureMethod?: string;
  currency?: string;
}

export interface SetupCustomerDto {
  email?: string;
  name?: string;
  companyName?: string;
}

export interface CustomerStatusResponse {
  hasStripeCustomer: boolean;
  stripeCustomerId?: string;
  setupRequired: boolean;
}

export interface FeeCalculation {
  amount: number;
  currency: string;
  platformFee: number;
  stripeFee: number;
  totalFees: number;
  promoterAmount: number;
  platformFeePercentage: number;
}

export interface PaymentIntentResponse {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  platformFee: number;
}

@Injectable()
export class StripePaymentService {
  private readonly logger = new Logger(StripePaymentService.name);
  private readonly config = stripeConfig();

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(StripePaymentIntent)
    private readonly paymentIntentRepo: Repository<StripePaymentIntent>,
    @InjectRepository(StripeTransfer)
    private readonly transferRepo: Repository<StripeTransfer>,
    @InjectRepository(CampaignPaymentConfig)
    private readonly campaignConfigRepo: Repository<CampaignPaymentConfig>,
    @InjectRepository(PlatformFee)
    private readonly platformFeeRepo: Repository<PlatformFee>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepo: Repository<AdvertiserDetailsEntity>,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Update payment intent from webhook event
   */
  async updatePaymentIntentFromWebhook(
    stripePaymentIntentId: string,
    updates: Partial<{
      status: string;
      failureCode?: string;
      failureMessage?: string;
    }>,
  ): Promise<void> {
    try {
      const paymentIntent = await this.paymentIntentRepo.findOne({
        where: { stripePaymentIntentId },
      });

      if (!paymentIntent) {
        this.logger.warn(
          `Payment intent not found for webhook update: ${stripePaymentIntentId}`,
        );
        return;
      }

      const updateData: Record<string, any> = {
        ...updates,
        updatedAt: new Date(),
      };

      // Set completion timestamp for succeeded payments
      if (updates.status === 'succeeded') {
        updateData['confirmedAt'] = new Date();
      }

      // Set failure details for failed payments
      if (
        updates.status === 'failed' &&
        (updates.failureCode || updates.failureMessage)
      ) {
        updateData['failedAt'] = new Date();
      }

      await this.paymentIntentRepo.update(paymentIntent.id, updateData);

      this.logger.log(
        `Updated payment intent ${stripePaymentIntentId} from webhook`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update payment intent ${stripePaymentIntentId} from webhook:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update transfer from webhook event
   */
  async updateTransferFromWebhook(
    stripeTransferId: string,
    updates: Partial<{
      status: string;
      failureCode?: string;
      failureMessage?: string;
    }>,
  ): Promise<void> {
    try {
      const transfer = await this.transferRepo.findOne({
        where: { stripeTransferId },
      });

      if (!transfer) {
        this.logger.warn(
          `Transfer not found for webhook update: ${stripeTransferId}`,
        );
        return;
      }

      const updateData: Record<string, any> = {
        ...updates,
        updatedAt: new Date(),
      };

      // Set appropriate timestamps based on status
      if (updates.status === 'paid') {
        updateData['completedAt'] = new Date();
      } else if (updates.status === 'failed') {
        updateData['failedAt'] = new Date();
      }

      await this.transferRepo.update(transfer.id, updateData);

      this.logger.log(`Updated transfer ${stripeTransferId} from webhook`);
    } catch (error) {
      this.logger.error(
        `Failed to update transfer ${stripeTransferId} from webhook:`,
        error,
      );
      throw error;
    }
  }
}
