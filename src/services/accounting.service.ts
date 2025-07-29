import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { PaymentRecord } from '../database/entities/payment-record.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
} from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { UserType } from 'src/enums/user-type';

/**
 * Service responsible for accounting, balance tracking, and financial reporting
 * Using new simplified schema (PaymentRecord, Transaction, Wallet)
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  /**
   * Calculate monthly earnings for a promoter using Transaction data
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
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Get all earnings transactions for the promoter in the period
      const transactions = await this.transactionRepo.find({
        where: {
          userId: promoterId,
          userType: UserType.PROMOTER,
          status: TransactionStatus.COMPLETED,
          createdAt: Between(startDate, endDate),
        },
        relations: ['campaign'],
      });

      const earningsByType: Record<string, number> = {};
      let totalEarnings = 0;

      for (const transaction of transactions) {
        totalEarnings += transaction.amount;

        const transactionType = transaction.type || 'UNKNOWN';
        earningsByType[transactionType] =
          (earningsByType[transactionType] || 0) + transaction.amount;
      }

      return {
        totalEarnings,
        earningsByType,
        transactionCount: transactions.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate monthly promoter earnings: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate monthly earnings',
      );
    }
  }

  /**
   * Calculate monthly spend for an advertiser using PaymentRecord data
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
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Get all payment records for the advertiser in the period
      const paymentRecords = await this.paymentRecordRepo.find({
        where: {
          userId: advertiserId,
          status: 'COMPLETED',
          createdAt: Between(startDate, endDate),
        },
      });

      const spendByType: Record<string, number> = {};
      let totalSpent = 0;

      for (const payment of paymentRecords) {
        totalSpent += payment.amountCents;

        const paymentType = payment.paymentType || 'CAMPAIGN_FUNDING';
        spendByType[paymentType] =
          (spendByType[paymentType] || 0) + payment.amountCents;
      }

      return {
        totalSpent,
        spendByType,
        transactionCount: paymentRecords.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate monthly advertiser spend: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate monthly spend',
      );
    }
  }

  /**
   * Process monthly payouts using Wallet and Transaction entities
   */
  async processMonthlyPayouts(
    minimumThreshold: number = 2000,
  ): Promise<Transaction[]> {
    this.logger.log(
      `Processing monthly payouts with threshold $${minimumThreshold / 100}`,
    );

    try {
      // Find all wallets with balance above threshold
      const wallets = await this.walletRepo
        .createQueryBuilder('wallet')
        .where('wallet.currentBalance >= :threshold', {
          threshold: minimumThreshold,
        })
        .getMany();

      const processedPayouts: Transaction[] = [];

      for (const wallet of wallets) {
        try {
          // Create payout transaction
          const payoutTransaction = this.transactionRepo.create({
            userId: wallet.userId,
            userType: UserType.PROMOTER,
            amount: wallet.currentBalance,
            status: TransactionStatus.PENDING,
            type: TransactionType.MONTHLY_PAYOUT,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            description: `Monthly earnings payout - ${new Date().toISOString().slice(0, 7)}`,
            processedAt: new Date(),
          });

          const savedTransaction =
            await this.transactionRepo.save(payoutTransaction);
          processedPayouts.push(savedTransaction);

          // Reset wallet balance after payout
          await this.walletRepo.update(wallet.id, {
            currentBalance: 0,
            totalWithdrawn: wallet.totalWithdrawn + wallet.currentBalance,
          });

          this.logger.log(
            `Created monthly payout of $${wallet.currentBalance / 100} for promoter ${wallet.userId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process payout for promoter ${wallet.userId}: ${(error as Error).message}`,
          );
          // Continue with other promoters
        }
      }

      this.logger.log(`Processed ${processedPayouts.length} monthly payouts`);
      return processedPayouts;
    } catch (error) {
      this.logger.error(
        `Failed to process monthly payouts: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to process monthly payouts',
      );
    }
  }

  /**
   * Get current promoter balance using Wallet entity
   */
  async getPromoterBalance(promoterId: string): Promise<{
    currentBalance: number;
    pendingBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
  } | null> {
    const wallet = await this.walletRepo.findOne({
      where: { userId: promoterId, userType: UserType.PROMOTER },
    });

    if (!wallet) {
      return null;
    }

    return {
      currentBalance: wallet.currentBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn,
    };
  }

  /**
   * Get advertiser spend summary using PaymentRecord entity
   */
  async getAdvertiserSpend(advertiserId: string): Promise<{
    totalSpent: number;
    totalRefunded: number;
    lastPaymentDate: Date | null;
  } | null> {
    try {
      // Get all payment records for the advertiser
      const paymentRecords = await this.paymentRecordRepo.find({
        where: { userId: advertiserId },
        order: { createdAt: 'DESC' },
      });

      if (paymentRecords.length === 0) {
        return null;
      }

      let totalSpent = 0;
      let totalRefunded = 0;
      const lastPaymentDate = paymentRecords[0]?.createdAt || null;

      for (const payment of paymentRecords) {
        if (payment.status === 'COMPLETED') {
          totalSpent += payment.amountCents;
        } else if (payment.status === 'REFUNDED') {
          totalRefunded += payment.amountCents;
        }
      }

      return {
        totalSpent,
        totalRefunded,
        lastPaymentDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get advertiser spend: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  /**
   * Update promoter balance using Wallet entity
   */
  async updatePromoterBalance(
    promoterId: string,
    campaignType: string,
    amount: number,
  ): Promise<void> {
    try {
      let wallet = await this.walletRepo.findOne({
        where: { userId: promoterId, userType: UserType.PROMOTER },
      });

      if (!wallet) {
        // Create new wallet for promoter
        wallet = this.walletRepo.create({
          userId: promoterId,
          userType: UserType.PROMOTER,
          currentBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });
      }

      // Update balances
      wallet.currentBalance += amount;
      wallet.totalEarned = (wallet.totalEarned || 0) + amount;

      await this.walletRepo.save(wallet);

      // Also create a transaction record for this earning
      const transaction = this.transactionRepo.create({
        userId: promoterId,
        userType: UserType.PROMOTER,
        amount,
        status: TransactionStatus.COMPLETED,
        type: this.mapCampaignTypeToTransactionType(campaignType),
        paymentMethod: PaymentMethod.WALLET,
        description: `Earnings from ${campaignType} campaign`,
        processedAt: new Date(),
      });

      await this.transactionRepo.save(transaction);

      this.logger.log(
        `Updated promoter ${promoterId} balance by $${amount / 100} for ${campaignType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update promoter balance: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to update promoter balance',
      );
    }
  }

  /**
   * Get payment dashboard using new simplified schema
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
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      if (userType === UserType.PROMOTER) {
        const balance = await this.getPromoterBalance(userId);
        const monthlyEarnings = await this.calculateMonthlyPromoterEarnings(
          userId,
          currentYear,
          currentMonth,
        );

        // Get recent transactions
        const recentTransactions = await this.transactionRepo.find({
          where: { userId: userId, userType: UserType.PROMOTER },
          order: { createdAt: 'DESC' },
          take: 10,
        });

        return {
          currentBalance: balance?.currentBalance || 0,
          pendingPayouts: balance?.pendingBalance || 0,
          totalEarningsThisMonth: monthlyEarnings.totalEarnings,
          totalSpentThisMonth: 0,
          recentTransactions,
          recentPayments: [],
        };
      } else {
        const monthlySpend = await this.calculateMonthlyAdvertiserSpend(
          userId,
          currentYear,
          currentMonth,
        );

        // Get recent payments
        const recentPayments = await this.paymentRecordRepo.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 10,
        });

        return {
          currentBalance: 0,
          pendingPayouts: 0,
          totalEarningsThisMonth: 0,
          totalSpentThisMonth: monthlySpend.totalSpent,
          recentTransactions: [],
          recentPayments,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get payment dashboard: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to get payment dashboard');
    }
  }

  /**
   * Helper method to map campaign type to transaction type
   */
  private mapCampaignTypeToTransactionType(
    campaignType: string,
  ): TransactionType {
    switch (campaignType.toUpperCase()) {
      case 'VISIBILITY':
        return TransactionType.VIEW_EARNING;
      case 'SALESMAN':
        return TransactionType.SALESMAN_COMMISSION;
      default:
        return TransactionType.DIRECT_PAYMENT;
    }
  }
}
