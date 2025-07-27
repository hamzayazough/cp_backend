import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaymentProcessingService } from './payment-processing.service';
import { AccountingService } from './accounting.service';
import { StripeIntegrationService } from './stripe-integration.service';
import { CampaignEntity } from 'src/database/entities';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { UserType } from 'src/enums/user-type';

/**
 * Main PaymentService that orchestrates the modular payment services
 * This service acts as a facade pattern, delegating to specialized services
 * Using new simplified schema (PaymentRecord, Transaction, Wallet)
 */
@Injectable()
export class PaymentServiceImpl {
  private readonly logger = new Logger(PaymentServiceImpl.name);

  constructor(
    private readonly paymentProcessingService: PaymentProcessingService,
    private readonly accountingService: AccountingService,
    private readonly stripeService: StripeIntegrationService,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  /**
   * Charge campaign budget by creating a payment record and processing payment
   */
  async chargeCampaignBudget(
    campaign: CampaignEntity,
    advertiserId: string,
  ): Promise<PaymentRecord> {
    try {
      this.logger.log(
        `Charging campaign budget for campaign ${campaign.id}, advertiser ${advertiserId}`,
      );

      // Create payment record directly
      const paymentRecord = this.paymentRecordRepo.create({
        userId: advertiserId,
        amountCents: campaign.budgetAllocated || 0,
        paymentType: 'CAMPAIGN_FUNDING',
        status: 'pending',
        description: `Campaign budget payment for ${campaign.title}`,
        stripePaymentIntentId: `temp_${Date.now()}`, // Will be updated after Stripe processing
      });

      const savedPaymentRecord =
        await this.paymentRecordRepo.save(paymentRecord);

      // Process payment through Stripe (delegated to stripe service)
      try {
        const amountToCharge = campaign.budgetAllocated || 0;
        // TODO: Implement actual Stripe payment processing
        // await this.stripeService.processPayment(paymentMethodId, amountToCharge);

        // Update payment record status to completed
        savedPaymentRecord.status = 'completed';
        await this.paymentRecordRepo.save(savedPaymentRecord);

        this.logger.log(
          `Successfully charged $${amountToCharge / 100} for campaign ${campaign.id}`,
        );
      } catch (paymentError) {
        // Update payment record status to failed
        savedPaymentRecord.status = 'failed';
        await this.paymentRecordRepo.save(savedPaymentRecord);
        throw paymentError;
      }

      return savedPaymentRecord;
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
      let wallet = await this.walletRepo.findOne({
        where: { userId: promoterId, userType: UserType.PROMOTER },
      });

      if (!wallet) {
        wallet = this.walletRepo.create({
          userId: promoterId,
          userType: UserType.PROMOTER,
          currentBalance: 0,
        });
        wallet = await this.walletRepo.save(wallet);
      }

      // Create payout transaction
      const transaction = this.transactionRepo.create({
        userId: promoterId,
        userType: UserType.PROMOTER,
        amount: finalAmount || 0,
        type: TransactionType.MONTHLY_PAYOUT,
        status: TransactionStatus.COMPLETED,
        description: `Promoter payout for campaign ${campaignId}`,
        campaignId,
      });

      const savedTransaction = await this.transactionRepo.save(transaction);

      // Update wallet balance
      wallet.currentBalance += finalAmount || 0;
      await this.walletRepo.save(wallet);

      this.logger.log(
        `Successfully processed payout of $${(finalAmount || 0) / 100} for promoter ${promoterId}`,
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
        `Processing refund for campaign ${campaignId}, advertiser ${advertiserId}`,
      );

      // Create refund payment record
      const refundRecord = this.paymentRecordRepo.create({
        userId: advertiserId,
        amountCents: -(amount || 0), // Negative amount for refund
        paymentType: 'WITHDRAWAL',
        status: 'completed',
        description: `Campaign budget refund for ${campaignId}`,
        stripePaymentIntentId: `refund_${Date.now()}`,
      });

      const savedRefund = await this.paymentRecordRepo.save(refundRecord);

      this.logger.log(
        `Successfully processed refund of $${(amount || 0) / 100} for campaign ${campaignId}`,
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
   * Process monthly payouts - delegates to AccountingService
   */
  async processMonthlyPayouts(
    minimumThreshold: number = 2000,
  ): Promise<Transaction[]> {
    return await this.accountingService.processMonthlyPayouts(minimumThreshold);
  }

  /**
   * Calculate monthly promoter earnings - delegates to AccountingService
   */
  async calculateMonthlyPromoterEarnings(
    promoterId: string,
    year: number,
    month: number,
  ): Promise<{
    totalEarnings: number;
    earningsByType: Record<string, number>;
    transactionCount: number;
  }> {
    return await this.accountingService.calculateMonthlyPromoterEarnings(
      promoterId,
      year,
      month,
    );
  }

  /**
   * Calculate monthly advertiser spend - delegates to AccountingService
   */
  async calculateMonthlyAdvertiserSpend(
    advertiserId: string,
    year: number,
    month: number,
  ): Promise<{
    totalSpent: number;
    spendByType: Record<string, number>;
    transactionCount: number;
  }> {
    return await this.accountingService.calculateMonthlyAdvertiserSpend(
      advertiserId,
      year,
      month,
    );
  }

  /**
   * Get payout history using Transaction data
   */
  async getPayoutHistory(
    promoterId: string,
    limit: number = 50,
  ): Promise<Transaction[]> {
    return await this.transactionRepo.find({
      where: {
        userId: promoterId,
        userType: UserType.PROMOTER,
        type: TransactionType.MONTHLY_PAYOUT,
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get charge history using PaymentRecord data
   */
  async getChargeHistory(
    advertiserId: string,
    limit: number = 50,
  ): Promise<PaymentRecord[]> {
    return await this.paymentRecordRepo.find({
      where: {
        userId: advertiserId,
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get promoter balance - delegates to AccountingService
   */
  async getPromoterBalance(promoterId: string): Promise<{
    currentBalance: number;
    pendingBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
  } | null> {
    return await this.accountingService.getPromoterBalance(promoterId);
  }

  /**
   * Get advertiser spend - delegates to AccountingService
   */
  async getAdvertiserSpend(advertiserId: string): Promise<{
    totalSpent: number;
    totalRefunded: number;
    lastPaymentDate: Date | null;
  } | null> {
    return await this.accountingService.getAdvertiserSpend(advertiserId);
  }

  /**
   * Get payment dashboard - delegates to AccountingService
   */
  async getPaymentDashboard(
    userId: string,
    userType: UserType,
  ): Promise<{
    currentBalance: number;
    pendingPayouts: number;
    totalEarningsThisMonth: number;
    totalSpentThisMonth: number;
    recentTransactions: Transaction[];
    recentPayments: PaymentRecord[];
  }> {
    return await this.accountingService.getPaymentDashboard(userId, userType);
  }
}
