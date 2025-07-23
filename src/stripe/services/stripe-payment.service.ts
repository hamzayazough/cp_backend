import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.constants';
import { StripePaymentIntent } from '../../database/entities/stripe-payment-intent.entity';
import { StripeTransfer } from '../../database/entities/stripe-transfer.entity';
import { CampaignPaymentConfig } from '../../database/entities/campaign-payment-config.entity';
import { PlatformFee } from '../../database/entities/platform-fee.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { StripeConnectService } from './stripe-connect.service';
import { stripeConfig } from '../../config/stripe.config';
import {
  StripePaymentIntentStatus,
  StripeTransferStatus,
  PaymentFlowType,
  PlatformFeeType,
} from '../../database/entities/stripe-enums';

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
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Map Stripe payment intent status to our enum
   */
  private mapStripeStatusToEnum(
    stripeStatus: string,
  ): StripePaymentIntentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
        return StripePaymentIntentStatus.REQUIRES_PAYMENT_METHOD;
      case 'requires_confirmation':
        return StripePaymentIntentStatus.REQUIRES_CONFIRMATION;
      case 'requires_action':
        return StripePaymentIntentStatus.REQUIRES_ACTION;
      case 'processing':
        return StripePaymentIntentStatus.PROCESSING;
      case 'requires_capture':
        return StripePaymentIntentStatus.REQUIRES_CAPTURE;
      case 'canceled':
        return StripePaymentIntentStatus.CANCELED;
      case 'succeeded':
        return StripePaymentIntentStatus.SUCCEEDED;
      default:
        throw new Error(`Unknown Stripe status: ${stripeStatus}`);
    }
  }

  /**
   * Map Stripe transfer status to our enum
   */
  private mapStripeTransferStatusToEnum(
    stripeStatus: string,
  ): StripeTransferStatus {
    switch (stripeStatus) {
      case 'pending':
        return StripeTransferStatus.PENDING;
      case 'paid':
        return StripeTransferStatus.PAID;
      case 'failed':
        return StripeTransferStatus.FAILED;
      case 'canceled':
        return StripeTransferStatus.CANCELED;
      default:
        throw new Error(`Unknown Stripe transfer status: ${stripeStatus}`);
    }
  }

  /**
   * Create payment intent for campaign payment
   */
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponse> {
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
        paymentConfig = await this.createDefaultPaymentConfig(
          dto.campaignId,
          campaign.type,
        );
      }

      // Get recipient's Stripe account
      const recipientAccount =
        await this.stripeConnectService.getAccountByUserId(dto.recipientId);
      if (!recipientAccount || !recipientAccount.chargesEnabled) {
        throw new BadRequestException(
          'Recipient account not ready for payments',
        );
      }

      // Calculate amounts
      const amountInCents = Math.round(dto.amount * 100);
      const platformFeeInCents = this.calculatePlatformFee(
        amountInCents,
        paymentConfig,
      );

      // Create payment intent based on flow type
      let stripePaymentIntent: Stripe.PaymentIntent;

      switch (paymentConfig.paymentFlowType) {
        case PaymentFlowType.DESTINATION:
          stripePaymentIntent = await this.createDestinationCharge(
            amountInCents,
            platformFeeInCents,
            recipientAccount.stripeAccountId,
            dto.description,
            dto.metadata,
          );
          break;

        case PaymentFlowType.DIRECT:
          stripePaymentIntent = await this.createDirectCharge(
            amountInCents,
            platformFeeInCents,
            recipientAccount.stripeAccountId,
            dto.description,
            dto.metadata,
          );
          break;

        case PaymentFlowType.HOLD_AND_TRANSFER:
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
        status: this.mapStripeStatusToEnum(stripePaymentIntent.status),
        clientSecret: stripePaymentIntent.client_secret || null,
        description: dto.description,
        metadata: dto.metadata,
      });

      const savedPaymentIntent =
        await this.paymentIntentRepo.save(paymentIntentEntity);

      // Create platform fee record
      await this.createPlatformFeeRecord(
        savedPaymentIntent.id,
        dto.campaignId,
        platformFeeInCents,
        paymentConfig,
        amountInCents,
      );

      this.logger.log(
        `Created payment intent ${stripePaymentIntent.id} for campaign ${dto.campaignId}`,
      );

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
    return this.stripe.paymentIntents.create(
      {
        amount,
        currency: this.config.currency.toLowerCase(),
        application_fee_amount: applicationFee,
        description,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        stripeAccount: connectedAccount,
      },
    );
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
  async createTransfer(
    paymentIntentId: string,
    recipientId: string,
    amount?: number,
  ): Promise<StripeTransfer> {
    try {
      const paymentIntent = await this.paymentIntentRepo.findOne({
        where: { id: paymentIntentId },
        relations: ['campaign'],
      });

      if (!paymentIntent) {
        throw new BadRequestException('Payment intent not found');
      }

      if (paymentIntent.paymentFlowType !== PaymentFlowType.HOLD_AND_TRANSFER) {
        throw new BadRequestException(
          'Payment intent is not configured for transfers',
        );
      }

      const recipientAccount =
        await this.stripeConnectService.getAccountByUserId(recipientId);
      if (!recipientAccount) {
        throw new BadRequestException('Recipient account not found');
      }

      const transferAmount =
        amount || paymentIntent.amount - paymentIntent.applicationFeeAmount;

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
        status: StripeTransferStatus.PENDING,
        description: `Transfer for campaign ${paymentIntent.campaignId}`,
      });

      const savedTransfer = await this.transferRepo.save(transferEntity);

      this.logger.log(
        `Created transfer ${stripeTransfer.id} for payment intent ${paymentIntentId}`,
      );

      return savedTransfer;
    } catch (error) {
      this.logger.error(`Failed to create transfer:`, error);
      throw new InternalServerErrorException('Failed to create transfer');
    }
  }

  /**
   * Calculate platform fee based on configuration
   */
  private calculatePlatformFee(
    amount: number,
    config: CampaignPaymentConfig,
  ): number {
    switch (config.platformFeeType) {
      case PlatformFeeType.PERCENTAGE:
        return Math.round((amount * config.platformFeeValue) / 100);
      case PlatformFeeType.FIXED:
        return Math.round(config.platformFeeValue * 100); // Convert to cents
      case PlatformFeeType.NONE:
        return 0;
      default:
        return Math.round((amount * this.config.platformFeePercentage) / 100);
    }
  }

  /**
   * Create default payment configuration for campaign
   */
  private async createDefaultPaymentConfig(
    campaignId: string,
    campaignType: string,
  ): Promise<CampaignPaymentConfig> {
    let defaultFlow = PaymentFlowType.DESTINATION;
    const defaultFeeType = PlatformFeeType.PERCENTAGE;
    const defaultFeeValue = this.config.platformFeePercentage;

    // Customize based on campaign type
    switch (campaignType) {
      case 'VISIBILITY':
        defaultFlow = PaymentFlowType.DESTINATION; // Immediate payout
        break;
      case 'CONSULTANT':
      case 'SELLER':
        defaultFlow = PaymentFlowType.HOLD_AND_TRANSFER; // Hold until completion
        break;
      case 'SALESMAN':
        defaultFlow = PaymentFlowType.HOLD_AND_TRANSFER; // Batch payouts
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
  async updatePaymentIntentStatus(
    stripePaymentIntentId: string,
    status: string,
  ): Promise<void> {
    const enumStatus = this.mapStripeStatusToEnum(status);
    await this.paymentIntentRepo.update(
      { stripePaymentIntentId },
      {
        status: enumStatus,
        ...(status === 'succeeded' ? { succeededAt: new Date() } : {}),
        ...(status === 'canceled' ? { canceledAt: new Date() } : {}),
      },
    );
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
    returnUrl?: string,
  ): Promise<{
    id: string;
    status: string;
    client_secret: string | null;
    requires_action: boolean;
    next_action: any;
  }> {
    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {
        payment_method: paymentMethodId,
      };

      if (returnUrl) {
        confirmParams.return_url = returnUrl;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams,
      );

      // Update local record
      await this.updatePaymentIntentStatus(
        paymentIntentId,
        paymentIntent.status,
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
        requires_action: paymentIntent.status === 'requires_action',
        next_action: paymentIntent.next_action,
      };
    } catch (error) {
      this.logger.error('Error confirming payment intent:', error);
      throw new BadRequestException('Failed to confirm payment intent');
    }
  }

  /**
   * Capture payment intent
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amountToCapture?: number,
  ): Promise<{
    id: string;
    status: string;
    amount_captured: number | null;
    amount_capturable: number | null;
  }> {
    try {
      const captureParams: Stripe.PaymentIntentCaptureParams = {};

      if (amountToCapture) {
        captureParams.amount_to_capture = Math.round(amountToCapture * 100); // Convert to cents
      }

      const paymentIntent: Stripe.PaymentIntent =
        await this.stripe.paymentIntents.capture(
          paymentIntentId,
          captureParams,
        );

      // Update local record
      await this.updatePaymentIntentStatus(
        paymentIntentId,
        paymentIntent.status,
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount_captured: 0, // Stripe's PaymentIntent doesn't have amount_captured, use amount_capturable or 0
        amount_capturable: paymentIntent.amount_capturable,
      };
    } catch (error) {
      this.logger.error('Error capturing payment intent:', error);
      throw new BadRequestException('Failed to capture payment intent');
    }
  }

  /**
   * Get transfers by payment intent
   */
  async getTransfersByPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripeTransfer[]> {
    return this.transferRepo.find({
      where: { paymentIntent: { stripePaymentIntentId: paymentIntentId } },
      relations: ['paymentIntent', 'sourceAccount', 'destinationAccount'],
    });
  }

  /**
   * Get campaign payment configuration
   */
  async getCampaignPaymentConfig(
    campaignId: string,
  ): Promise<CampaignPaymentConfig | null> {
    return this.campaignConfigRepo.findOne({
      where: { campaignId },
    });
  }

  /**
   * Create or update campaign payment configuration
   */
  async createCampaignPaymentConfig(
    configData: CreateCampaignPaymentConfigDto,
  ): Promise<CampaignPaymentConfig> {
    const { campaignId, ...otherData } = configData;

    // Check if config already exists
    let config = await this.getCampaignPaymentConfig(campaignId);

    if (config) {
      // Update existing config
      Object.assign(config, otherData);
    } else {
      // Create new config
      config = this.campaignConfigRepo.create({
        campaignId,
        platformFeePercentage: otherData.platformFeePercentage || 5, // Default 5%
        autoTransfer: otherData.autoTransfer || false,
        captureMethod: otherData.captureMethod || 'automatic',
        currency: otherData.currency || 'usd',
        ...otherData,
      });
    }

    return this.campaignConfigRepo.save(config);
  }

  /**
   * Calculate fees for a payment amount
   */
  calculateFees(amount: number, currency: string = 'usd'): FeeCalculation {
    try {
      // Platform fee (percentage-based)
      const platformFeePercentage = this.config.platformFeePercentage || 5; // Default 5%
      const platformFee =
        Math.round(((amount * platformFeePercentage) / 100) * 100) / 100;

      // Stripe fee calculation (approximate)
      // Standard rates: 2.9% + 30¢ for US cards
      const stripeFeePercentage = 2.9;
      const stripeFixedFee = 0.3;
      const stripeFee =
        Math.round(
          ((amount * stripeFeePercentage) / 100 + stripeFixedFee) * 100,
        ) / 100;

      // Amount to promoter (after all fees)
      const totalFees = platformFee + stripeFee;
      const promoterAmount = amount - totalFees;

      return {
        amount,
        currency,
        platformFee,
        stripeFee,
        totalFees,
        promoterAmount: Math.max(0, promoterAmount), // Ensure non-negative
        platformFeePercentage,
      };
    } catch (error) {
      this.logger.error('Error calculating fees:', error);
      throw new BadRequestException('Failed to calculate fees');
    }
  }

  /**
   * Update transfer status
   */
  async updateTransferStatus(
    transferId: string,
    status: string,
  ): Promise<void> {
    try {
      const enumStatus = this.mapStripeTransferStatusToEnum(status);
      await this.transferRepo.update(
        { stripeTransferId: transferId },
        {
          status: enumStatus,
          ...(status === 'paid' ? { completedAt: new Date() } : {}),
          ...(status === 'failed' ? { failedAt: new Date() } : {}),
        },
      );
    } catch (error) {
      this.logger.error('Error updating transfer status:', error);
      throw error;
    }
  }

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
