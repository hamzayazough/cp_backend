import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PAYMENT_CONSTANTS } from '../interfaces/payment-service.interface';
import { PayoutRecord, AdvertiserCharge } from '../interfaces/payment';
import { Campaign } from '../interfaces/campaign';
import { CampaignType } from '../enums/campaign-type';

// Entities
import { Campaign as CampaignEntity } from '../database/entities/campaign.entity';
import {
  PayoutRecord as PayoutRecordEntity,
  PayoutStatus,
} from '../database/entities/payout-record.entity';
import {
  AdvertiserCharge as AdvertiserChargeEntity,
  ChargeStatus,
} from '../database/entities/advertiser-charge.entity';
import { UserEntity } from '../database/entities/user.entity';

// Import other services
import { StripeIntegrationService } from './stripe-integration.service';
import { AccountingService } from './accounting.service';

/**
 * Service responsible for processing payments, charges, and payouts
 */
@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PayoutRecordEntity)
    private readonly payoutRepository: Repository<PayoutRecordEntity>,
    @InjectRepository(AdvertiserChargeEntity)
    private readonly chargeRepository: Repository<AdvertiserChargeEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly stripeService: StripeIntegrationService,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Charge advertiser for campaign budget with upfront payment
   */
  async chargeCampaignBudget(
    campaign: Campaign,
    paymentMethodId: string,
  ): Promise<AdvertiserCharge> {
    this.logger.log(`Charging campaign budget for campaign ${campaign.id}`);

    try {
      // Validate campaign status
      if (campaign.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Campaign must be active to charge budget',
        );
      }

      // Calculate budget amount based on campaign type
      let campaignBudget = 0;

      // Type guard to check for budget fields
      if (
        'maxBudget' in campaign &&
        campaign.maxBudget &&
        typeof campaign.maxBudget === 'number'
      ) {
        campaignBudget = campaign.maxBudget;
      } else if (
        'cpv' in campaign &&
        campaign.cpv &&
        typeof campaign.cpv === 'number' &&
        'maxViews' in campaign &&
        campaign.maxViews &&
        typeof campaign.maxViews === 'number'
      ) {
        // For visibility campaigns: cpv * maxViews / 100
        campaignBudget = (campaign.cpv * campaign.maxViews) / 100;
      } else if (
        'commissionPerSale' in campaign &&
        campaign.commissionPerSale &&
        typeof campaign.commissionPerSale === 'number'
      ) {
        // For salesman campaigns, we'll use a default or minimal charge
        campaignBudget = 1000; // $10 minimum for salesman campaigns
      } else {
        throw new BadRequestException(
          'Cannot determine campaign budget amount',
        );
      }

      if (campaignBudget <= 0) {
        throw new BadRequestException('Invalid campaign budget amount');
      }

      // Calculate total amount including Stripe fees (amounts are in cents)
      const stripeFee = Math.round(
        campaignBudget * PAYMENT_CONSTANTS.STRIPE_FEE_PERCENTAGE,
      );
      const totalAmount = campaignBudget + stripeFee;

      // Create charge record first
      const chargeEntity = this.chargeRepository.create({
        advertiserId: campaign.createdBy, // Using createdBy as advertiserId
        campaignId: campaign.id,
        amount: campaignBudget,
        status: ChargeStatus.PENDING,
        description: `Campaign budget charge for ${campaign.title}`,
      });

      const savedCharge = await this.chargeRepository.save(chargeEntity);

      try {
        // Process payment through Stripe
        const paymentIntent = await this.stripeService.createPaymentIntent({
          amount: totalAmount,
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            campaignId: campaign.id,
            chargeId: savedCharge.id,
            type: 'campaign_budget',
          },
        });

        // Update charge with Stripe payment intent ID
        savedCharge.stripeChargeId = paymentIntent.id;
        savedCharge.status =
          paymentIntent.status === 'succeeded'
            ? ChargeStatus.SUCCEEDED
            : ChargeStatus.FAILED;
        await this.chargeRepository.save(savedCharge);

        if (paymentIntent.status === 'succeeded') {
          // Update campaign with held budget
          await this.campaignRepository.update(campaign.id, {
            budgetHeld: campaignBudget,
            stripeChargeId: paymentIntent.id,
          });

          // Update advertiser spend tracking
          await this.accountingService.updateAdvertiserSpend(
            campaign.createdBy,
            campaign.type,
            campaignBudget,
          );

          this.logger.log(
            `Successfully charged $${totalAmount / 100} for campaign ${campaign.id}`,
          );
        } else {
          this.logger.error(
            `Payment failed for campaign ${campaign.id}: ${paymentIntent.status}`,
          );
          throw new BadRequestException('Payment failed');
        }

        return this.mapChargeEntityToInterface(savedCharge);
      } catch (stripeError) {
        // Update charge status to failed
        savedCharge.status = ChargeStatus.FAILED;
        await this.chargeRepository.save(savedCharge);
        throw stripeError;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to charge campaign budget: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process payment');
    }
  }

  /**
   * Execute payout to promoter after campaign completion
   */
  async executePromoterPayout(
    campaignId: string,
    finalAmount?: number,
  ): Promise<PayoutRecord> {
    this.logger.log(`Executing payout for campaign ${campaignId}`);

    try {
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
        relations: ['selectedPromoter'],
      });

      if (!campaign) {
        throw new BadRequestException('Campaign not found');
      }

      if (campaign.payoutExecuted) {
        throw new BadRequestException(
          'Payout already executed for this campaign',
        );
      }

      if (!campaign.budgetHeld || campaign.budgetHeld <= 0) {
        throw new BadRequestException('No budget held for this campaign');
      }

      // Calculate final payout amount
      const payoutAmount = finalAmount || campaign.budgetHeld;

      if (payoutAmount > campaign.budgetHeld) {
        throw new BadRequestException(
          'Payout amount cannot exceed held budget',
        );
      }

      // Validate promoter has Stripe account
      if (!campaign.selectedPromoterId) {
        throw new BadRequestException('Campaign must have a selected promoter');
      }

      const isStripeValid = await this.stripeService.validateStripeAccount(
        campaign.selectedPromoterId,
      );
      if (!isStripeValid) {
        throw new BadRequestException(
          'Promoter must have valid Stripe account for payouts',
        );
      }

      // Create payout record
      const payoutEntity = this.payoutRepository.create({
        promoterId: campaign.selectedPromoterId,
        campaignId: campaign.id,
        amount: payoutAmount,
        status: PayoutStatus.PENDING,
        description: `Payout for campaign: ${campaign.title}`,
      });

      const savedPayout = await this.payoutRepository.save(payoutEntity);

      try {
        // Execute Stripe transfer
        const promoter = await this.userRepository.findOne({
          where: { id: campaign.selectedPromoterId },
        });

        if (!promoter?.stripeAccountId) {
          throw new BadRequestException('Promoter Stripe account not found');
        }

        const transfer = await this.stripeService.createTransfer({
          amount: payoutAmount,
          currency: 'usd',
          destination: promoter.stripeAccountId,
          metadata: {
            campaignId: campaign.id,
            payoutId: savedPayout.id,
            type: 'campaign_payout',
          },
        });

        // Update payout record with Stripe transfer ID
        savedPayout.stripeTransferId = transfer.id;
        savedPayout.status = PayoutStatus.COMPLETED;
        await this.payoutRepository.save(savedPayout);

        // Update campaign
        await this.campaignRepository.update(campaign.id, {
          finalPayoutAmount: payoutAmount,
          payoutExecuted: true,
          payoutDate: new Date(),
          stripeTransferId: transfer.id,
        });

        // Update promoter balance
        await this.accountingService.updatePromoterBalance(
          campaign.selectedPromoterId,
          campaign.type,
          payoutAmount,
        );

        // Handle any remaining budget (refund if difference)
        const remainingBudget = campaign.budgetHeld - payoutAmount;
        if (remainingBudget > 0) {
          await this.refundCampaignBudget(campaignId, remainingBudget);
        }

        this.logger.log(
          `Successfully executed payout of $${payoutAmount / 100} for campaign ${campaignId}`,
        );
        return this.mapPayoutEntityToInterface(savedPayout);
      } catch (stripeError) {
        // Update payout status to failed
        savedPayout.status = PayoutStatus.FAILED;
        await this.payoutRepository.save(savedPayout);
        throw stripeError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to execute payout: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to execute payout');
    }
  }

  /**
   * Refund campaign budget to advertiser
   */
  async refundCampaignBudget(
    campaignId: string,
    amount?: number,
  ): Promise<AdvertiserCharge> {
    this.logger.log(`Processing refund for campaign ${campaignId}`);

    try {
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new BadRequestException('Campaign not found');
      }

      if (!campaign.stripeChargeId) {
        throw new BadRequestException(
          'No original charge found for this campaign',
        );
      }

      const refundAmount = amount || campaign.budgetHeld;

      if (refundAmount <= 0) {
        throw new BadRequestException('Refund amount must be greater than 0');
      }

      if (refundAmount > campaign.budgetHeld) {
        throw new BadRequestException(
          'Refund amount cannot exceed held budget',
        );
      }

      // Create refund charge record
      const refundEntity = this.chargeRepository.create({
        advertiserId: campaign.createdBy,
        campaignId: campaign.id,
        amount: -refundAmount, // Negative amount for refund
        status: ChargeStatus.PENDING,
        description: `Refund for campaign: ${campaign.title}`,
      });

      const savedRefund = await this.chargeRepository.save(refundEntity);

      try {
        // Process refund through Stripe
        const refund = await this.stripeService.createRefund({
          charge: campaign.stripeChargeId,
          amount: refundAmount,
          metadata: {
            campaignId: campaign.id,
            refundId: savedRefund.id,
            type: 'campaign_refund',
          },
        });

        // Update refund record
        savedRefund.stripeChargeId = refund.id;
        savedRefund.status = ChargeStatus.SUCCEEDED;
        await this.chargeRepository.save(savedRefund);

        // Update campaign budget held
        const newBudgetHeld = campaign.budgetHeld - refundAmount;
        await this.campaignRepository.update(campaign.id, {
          budgetHeld: newBudgetHeld,
        });

        // Update advertiser spend tracking (subtract refunded amount)
        await this.accountingService.updateAdvertiserSpend(
          campaign.createdBy,
          campaign.type,
          -refundAmount,
        );

        this.logger.log(
          `Successfully refunded $${refundAmount / 100} for campaign ${campaignId}`,
        );
        return this.mapChargeEntityToInterface(savedRefund);
      } catch (stripeError) {
        // Update refund status to failed
        savedRefund.status = ChargeStatus.FAILED;
        await this.chargeRepository.save(savedRefund);
        throw stripeError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process refund: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  /**
   * Get payout history for a promoter
   */
  async getPayoutHistory(
    promoterId: string,
    limit: number = 50,
  ): Promise<PayoutRecord[]> {
    const payouts = await this.payoutRepository.find({
      where: { promoterId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['campaign'],
    });

    return payouts.map(this.mapPayoutEntityToInterface);
  }

  /**
   * Get charge history for an advertiser
   */
  async getChargeHistory(
    advertiserId: string,
    limit: number = 50,
  ): Promise<AdvertiserCharge[]> {
    const charges = await this.chargeRepository.find({
      where: { advertiserId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['campaign'],
    });

    return charges.map(this.mapChargeEntityToInterface);
  }

  // Entity to interface mapping methods
  private mapPayoutEntityToInterface = (
    entity: PayoutRecordEntity,
  ): PayoutRecord => ({
    id: entity.id,
    promoterId: entity.promoterId,
    campaignId: entity.campaignId,
    amount: entity.amount,
    status: entity.status,
    stripeTransferId: entity.stripeTransferId,
    stripePayoutId: entity.stripePayoutId,
    periodStart: entity.periodStart,
    periodEnd: entity.periodEnd,
    description: entity.description,
    failureReason: entity.failureReason,
    processedAt: entity.processedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });

  private mapChargeEntityToInterface = (
    entity: AdvertiserChargeEntity,
  ): AdvertiserCharge => ({
    id: entity.id,
    advertiserId: entity.advertiserId,
    campaignId: entity.campaignId,
    amount: entity.amount,
    status: entity.status,
    stripeChargeId: entity.stripeChargeId,
    stripePaymentMethodId: entity.stripePaymentMethodId,
    currency: entity.currency,
    description: entity.description,
    failureReason: entity.failureReason,
    refundedAmount: entity.refundedAmount,
    processedAt: entity.processedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}
