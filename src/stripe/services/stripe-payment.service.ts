import { Injectable, Inject, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.module';
import { StripePaymentIntent } from '../../database/entities/stripe-payment-intent.entity';
import { StripeTransfer } from '../../database/entities/stripe-transfer.entity';
import { CampaignPaymentConfig } from '../../database/entities/campaign-payment-config.entity';
import { PlatformFee } from '../../database/entities/platform-fee.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
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
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Create payment intent for campaign payment
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntentResponse> {
    try {
      // Get campaign and its payment configuration
      const campaign = await this.campaignRepo.findOne({
        where: { id: dto.campaignId },
        relations: ['advertiser'],
      });

      if (!campaign) {
        throw new BadRequestException('Campaign not found');
      }

      // Get or create payment configuration for campaign
      let paymentConfig = await this.campaignConfigRepo.findOne({
        where: { campaignId: dto.campaignId },
      });

      if (!paymentConfig) {
        paymentConfig = await this.createDefaultPaymentConfig(dto.campaignId, campaign.type);
      }

      // Get recipient's Stripe account
      const recipientAccount = await this.stripeConnectService.getAccountByUserId(dto.recipientId);
      if (!recipientAccount || !recipientAccount.chargesEnabled) {
        throw new BadRequestException('Recipient account not ready for payments');
      }

      // Calculate amounts
      const amountInCents = Math.round(dto.amount * 100);
      const platformFeeInCents = this.calculatePlatformFee(amountInCents, paymentConfig);

      // Create payment intent based on flow type
      let stripePaymentIntent: Stripe.PaymentIntent;
      
      switch (paymentConfig.paymentFlowType) {
        case 'destination':
          stripePaymentIntent = await this.createDestinationCharge(
            amountInCents,
            platformFeeInCents,
            recipientAccount.stripeAccountId,
            dto.description,
            dto.metadata,
          );
          break;
        
        case 'direct':
          stripePaymentIntent = await this.createDirectCharge(
            amountInCents,
            platformFeeInCents,
            recipientAccount.stripeAccountId,
            dto.description,
            dto.metadata,
          );
          break;
        
        case 'hold_and_transfer':
          stripePaymentIntent = await this.createHoldCharge(
            amountInCents,
            dto.description,
            dto.metadata,
          );
          break;
        
        default:
          throw new BadRequestException('Invalid payment flow type');
      }

      // Save payment intent to database
      const paymentIntentEntity = this.paymentIntentRepo.create({
        stripePaymentIntentId: stripePaymentIntent.id,
        campaignId: dto.campaignId,
        payerId: dto.payerId,
        recipientId: dto.recipientId,
        amount: amountInCents,
        currency: this.config.currency,
        applicationFeeAmount: platformFeeInCents,
        paymentFlowType: paymentConfig.paymentFlowType,
        destinationAccountId: recipientAccount.stripeAccountId,
        status: stripePaymentIntent.status,
        clientSecret: stripePaymentIntent.client_secret || null,
        description: dto.description,
        metadata: dto.metadata,
      });

      const savedPaymentIntent = await this.paymentIntentRepo.save(paymentIntentEntity);

      // Create platform fee record
      await this.createPlatformFeeRecord(
        savedPaymentIntent.id,
        dto.campaignId,
        platformFeeInCents,
        paymentConfig,
        amountInCents,
      );

      this.logger.log(`Created payment intent ${stripePaymentIntent.id} for campaign ${dto.campaignId}`);

      return {
        id: savedPaymentIntent.id,
        clientSecret: stripePaymentIntent.client_secret!,
        amount: amountInCents,
        currency: this.config.currency,
        status: stripePaymentIntent.status,
        platformFee: platformFeeInCents,
      };
    } catch (error) {
      this.logger.error(`Failed to create payment intent:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  /**
   * Create destination charge (recommended for cross-border)
   */
  private async createDestinationCharge(
    amount: number,
    applicationFee: number,
    destinationAccount: string,
    description?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency: this.config.currency.toLowerCase(),
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: destinationAccount,
      },
      description,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * Create direct charge (not recommended for cross-border)
   */
  private async createDirectCharge(
    amount: number,
    applicationFee: number,
    connectedAccount: string,
    description?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency: this.config.currency.toLowerCase(),
      application_fee_amount: applicationFee,
      description,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    }, {
      stripeAccount: connectedAccount,
    });
  }

  /**
   * Create hold charge (for later transfer)
   */
  private async createHoldCharge(
    amount: number,
    description?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency: this.config.currency.toLowerCase(),
      description,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * Create transfer for hold-and-transfer flow
   */
  async createTransfer(paymentIntentId: string, recipientId: string, amount?: number): Promise<StripeTransfer> {
    try {
      const paymentIntent = await this.paymentIntentRepo.findOne({
        where: { id: paymentIntentId },
        relations: ['campaign'],
      });

      if (!paymentIntent) {
        throw new BadRequestException('Payment intent not found');
      }

      if (paymentIntent.paymentFlowType !== 'hold_and_transfer') {
        throw new BadRequestException('Payment intent is not configured for transfers');
      }

      const recipientAccount = await this.stripeConnectService.getAccountByUserId(recipientId);
      if (!recipientAccount) {
        throw new BadRequestException('Recipient account not found');
      }

      const transferAmount = amount || (paymentIntent.amount - paymentIntent.applicationFeeAmount);

      const stripeTransfer = await this.stripe.transfers.create({
        amount: transferAmount,
        currency: paymentIntent.currency,
        destination: recipientAccount.stripeAccountId,
        source_transaction: paymentIntent.stripePaymentIntentId,
      });

      // Save transfer to database
      const transferEntity = this.transferRepo.create({
        stripeTransferId: stripeTransfer.id,
        paymentIntentId: paymentIntent.id,
        campaignId: paymentIntent.campaignId,
        amount: transferAmount,
        currency: paymentIntent.currency,
        destinationAccountId: recipientAccount.stripeAccountId,
        recipientId,
        status: 'pending',
        description: `Transfer for campaign ${paymentIntent.campaignId}`,
      });

      const savedTransfer = await this.transferRepo.save(transferEntity);

      this.logger.log(`Created transfer ${stripeTransfer.id} for payment intent ${paymentIntentId}`);

      return savedTransfer;
    } catch (error) {
      this.logger.error(`Failed to create transfer:`, error);
      throw new InternalServerErrorException('Failed to create transfer');
    }
  }

  /**
   * Calculate platform fee based on configuration
   */
  private calculatePlatformFee(amount: number, config: CampaignPaymentConfig): number {
    switch (config.platformFeeType) {
      case 'percentage':
        return Math.round((amount * config.platformFeeValue) / 100);
      case 'fixed':
        return Math.round(config.platformFeeValue * 100); // Convert to cents
      case 'none':
        return 0;
      default:
        return Math.round((amount * this.config.platformFeePercentage) / 100);
    }
  }

  /**
   * Create default payment configuration for campaign
   */
  private async createDefaultPaymentConfig(campaignId: string, campaignType: string): Promise<CampaignPaymentConfig> {
    let defaultFlow = 'destination';
    let defaultFeeType = 'percentage';
    let defaultFeeValue = this.config.platformFeePercentage;

    // Customize based on campaign type
    switch (campaignType) {
      case 'VISIBILITY':
        defaultFlow = 'destination'; // Immediate payout
        break;
      case 'CONSULTANT':
      case 'SELLER':
        defaultFlow = 'hold_and_transfer'; // Hold until completion
        break;
      case 'SALESMAN':
        defaultFlow = 'hold_and_transfer'; // Batch payouts
        break;
    }

    const config = this.campaignConfigRepo.create({
      campaignId,
      paymentFlowType: defaultFlow,
      platformFeeType: defaultFeeType,
      platformFeeValue: defaultFeeValue,
      requiresGoalCompletion: ['CONSULTANT', 'SELLER'].includes(campaignType),
      autoReleaseFunds: campaignType === 'VISIBILITY',
      holdPeriodDays: campaignType === 'VISIBILITY' ? 0 : 7,
    });

    return await this.campaignConfigRepo.save(config);
  }

  /**
   * Create platform fee record
   */
  private async createPlatformFeeRecord(
    paymentIntentId: string,
    campaignId: string,
    feeAmount: number,
    config: CampaignPaymentConfig,
    baseAmount: number,
  ): Promise<PlatformFee> {
    const platformFee = this.platformFeeRepo.create({
      paymentIntentId,
      campaignId,
      feeAmount,
      stripeFeeAmount: 0, // Will be updated via webhook
      netFeeAmount: feeAmount,
      feeType: config.platformFeeType,
      feeRate: config.platformFeeValue,
      baseAmount,
      status: 'pending',
    });

    return await this.platformFeeRepo.save(platformFee);
  }

  /**
   * Get payment intent by ID
   */
  async getPaymentIntent(id: string): Promise<StripePaymentIntent | null> {
    return this.paymentIntentRepo.findOne({
      where: { id },
      relations: ['campaign', 'payer', 'recipient'],
    });
  }

  /**
   * Update payment intent status
   */
  async updatePaymentIntentStatus(stripePaymentIntentId: string, status: string): Promise<void> {
    await this.paymentIntentRepo.update(
      { stripePaymentIntentId },
      { 
        status,
        ...(status === 'succeeded' ? { succeededAt: new Date() } : {}),
        ...(status === 'canceled' ? { canceledAt: new Date() } : {}),
      },
    );
  }
}
