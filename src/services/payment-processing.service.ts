import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities (using new simplified schema)
import { CampaignEntity } from '../database/entities/campaign.entity';
import { PromoterCampaign } from '../database/entities/promoter-campaign.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { UserEntity } from '../database/entities/user.entity';

// Import other services
import { StripeIntegrationService } from './stripe-integration.service';
import { AccountingService } from './accounting.service';

/**
 * Service responsible for processing payments, charges, and payouts
 * REFACTORED: Now uses simplified schema with PaymentRecord and Transaction
 */
@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepository: Repository<PromoterCampaign>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly stripeService: StripeIntegrationService,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Charge campaign budget by creating a payment record
   */
  async chargeCampaignBudget(
    campaign: CampaignEntity,
    advertiserId: string,
    paymentMethodId: string,
  ): Promise<PaymentRecord> {
    try {
      this.logger.log(
        `Processing campaign budget charge for campaign ${campaign.id}, advertiser ${advertiserId}`,
      );

      // Create payment record
      const paymentRecord = this.paymentRecordRepository.create({
        userId: advertiserId,
        amountCents: campaign.budgetAllocated || 0,
        paymentType: 'CAMPAIGN_FUNDING',
        status: 'pending',
        description: `Campaign budget payment for ${campaign.title}`,
        stripePaymentIntentId: `temp_${Date.now()}`, // Will be updated after Stripe processing
      });

      const savedPaymentRecord =
        await this.paymentRecordRepository.save(paymentRecord);

      // Process payment through Stripe
      try {
        // TODO: Implement actual Stripe payment processing
        // await this.stripeService.processPayment(paymentMethodId, campaign.budgetAllocated);

        // Update payment record status to completed
        await this.paymentRecordRepository.update(savedPaymentRecord.id, {
          status: 'completed',
        });

        this.logger.log(
          `Successfully charged $${(campaign.budgetAllocated || 0) / 100} for campaign ${campaign.id}`,
        );
      } catch (paymentError) {
        // Update payment record status to failed
        await this.paymentRecordRepository.update(savedPaymentRecord.id, {
          status: 'failed',
        });
        throw paymentError;
      }

      // Return the updated record
      const updatedRecord = await this.paymentRecordRepository.findOne({
        where: { id: savedPaymentRecord.id },
      });
      return updatedRecord!;
    } catch (error) {
      this.logger.error(
        `Failed to charge campaign budget: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to charge campaign budget',
      );
    }
  }

  /**
   * Execute promoter payout by creating a transaction
   */
  async executePromoterPayout(
    campaignId: string,
    promoterId: string,
    finalAmount?: number,
  ): Promise<Transaction> {
    try {
      this.logger.log(
        `Executing promoter payout for campaign ${campaignId}, promoter ${promoterId}`,
      );

      // Get or create promoter wallet
      let wallet = await this.walletRepository.findOne({
        where: { promoterId: promoterId },
      });

      if (!wallet) {
        wallet = this.walletRepository.create({
          promoterId: promoterId,
          currentBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });
        wallet = await this.walletRepository.save(wallet);
      }

      // Create payout transaction
      const transaction = this.transactionRepository.create({
        promoterId: promoterId,
        amount: finalAmount || 0,
        type: TransactionType.MONTHLY_PAYOUT,
        status: TransactionStatus.COMPLETED,
        description: `Payout for campaign ${campaignId}`,
        campaignId,
        paymentMethod: PaymentMethod.WALLET,
      });

      const savedTransaction =
        await this.transactionRepository.save(transaction);

      // Update wallet balance
      wallet.currentBalance += finalAmount || 0;
      await this.walletRepository.save(wallet);

      this.logger.log(
        `Successfully executed payout of $${(finalAmount || 0) / 100} for promoter ${promoterId}`,
      );

      return savedTransaction;
    } catch (error) {
      this.logger.error(
        `Failed to execute promoter payout: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to execute promoter payout',
      );
    }
  }

  /**
   * Refund campaign budget by creating a refund payment record
   */
  async refundCampaignBudget(
    campaignId: string,
    advertiserId: string,
    amount?: number,
  ): Promise<PaymentRecord> {
    try {
      this.logger.log(
        `Processing campaign budget refund for campaign ${campaignId}, advertiser ${advertiserId}`,
      );

      // Get campaign to determine refund amount if not specified
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new InternalServerErrorException('Campaign not found');
      }

      const refundAmount = amount || campaign.budgetAllocated || 0;

      // Create refund payment record
      const refundRecord = this.paymentRecordRepository.create({
        userId: advertiserId,
        amountCents: refundAmount,
        paymentType: 'WITHDRAWAL',
        status: 'completed',
        description: `Refund for campaign ${campaign.title}`,
        stripePaymentIntentId: `refund_${Date.now()}`,
      });

      const savedRefund = await this.paymentRecordRepository.save(refundRecord);

      // TODO: Process actual Stripe refund
      // await this.stripeService.processRefund(originalPaymentId, refundAmount);

      this.logger.log(
        `Successfully processed refund of $${refundAmount / 100} for campaign ${campaignId}`,
      );

      return savedRefund;
    } catch (error) {
      this.logger.error(
        `Failed to refund campaign budget: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to refund campaign budget',
      );
    }
  }

  /**
   * Get payout history for a promoter using Transaction records
   */
  async getPayoutHistory(
    promoterId: string,
    limit: number = 50,
  ): Promise<Transaction[]> {
    try {
      const transactions = await this.transactionRepository.find({
        where: {
          promoterId: promoterId,
          type: TransactionType.MONTHLY_PAYOUT,
        },
        order: { createdAt: 'DESC' },
        take: limit,
        relations: ['campaign'],
      });

      return transactions;
    } catch (error) {
      this.logger.error(
        `Failed to get payout history: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to get payout history');
    }
  }

  /**
   * Get charge history for an advertiser using PaymentRecord records
   */
  async getChargeHistory(
    advertiserId: string,
    limit: number = 50,
  ): Promise<PaymentRecord[]> {
    try {
      const paymentRecords = await this.paymentRecordRepository.find({
        where: {
          userId: advertiserId,
          paymentType: 'CAMPAIGN_FUNDING',
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return paymentRecords;
    } catch (error) {
      this.logger.error(
        `Failed to get charge history: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to get charge history');
    }
  }
}
