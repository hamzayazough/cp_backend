import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe/stripe.constants';
import { UserEntity } from '../database/entities/user.entity';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Wallet } from '../database/entities/wallet.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod as TxnPaymentMethod,
} from '../database/entities/transaction.entity';
import { UserType } from '../enums/user-type';
import {
  AddFundsDto,
  WithdrawFundsDto,
  TransactionQueryDto,
} from '../controllers/advertiser.controller';

export interface WalletBalance {
  currentBalance: number;
  pendingCharges: number;
  totalDeposited: number;
  totalSpent: number;
  availableForWithdrawal: number;
  totalHeldForCampaign: number;
}

export interface TransactionResponse {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    grossAmount?: number;
    platformFee?: number;
    description: string;
    campaignId?: string;
    campaignTitle?: string;
    status: string;
    paymentMethod?: string;
    createdAt: string;
    processedAt?: string;
    paymentIntentId?: string;
    paymentRecordId?: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

export interface FundingResult {
  paymentIntentId?: string;
  clientSecret?: string | null;
}

export interface WithdrawalResult {
  withdrawalId: string;
  amount: number;
  processingTime: string;
  estimatedArrival: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface WithdrawalLimits {
  feeStructure: {
    standardFee: number;
    freeWithdrawalThreshold: number;
    minimumWithdrawal: number;
  };
  limits: {
    dailyLimit: number;
    remainingDailyLimit: number;
    maxWithdrawable: number;
    recommendedMaxWithdrawal: number;
  };
  campaignRestrictions: {
    activeCampaigns: number;
    totalBudgetAllocated: number;
    recommendedReserve: number;
    canWithdrawFullBalance: boolean;
  };
  processingTime: string;
  description: string;
}

/**
 * Service responsible for wallet operations for advertisers
 * Handles balance management, deposits, withdrawals, and transaction history
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepo: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  /**
   * Get advertiser wallet balance using the unified wallet system
   */
  async getWalletBalance(firebaseUid: string): Promise<WalletBalance> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Get wallet entity
    let wallet = await this.walletRepo.findOne({
      where: { userId: user.id, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = this.walletRepo.create({
        userId: user.id,
        userType: UserType.ADVERTISER,
        currentBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        heldForCampaigns: 0,
      });
      await this.walletRepo.save(wallet);
    }

    // Calculate pending charges from payment records
    const pendingPayments: { total: string | null } | undefined =
      await this.paymentRecordRepo
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amountCents), 0)', 'total')
        .where('payment.userId = :userId', { userId: user.id })
        .andWhere('payment.status = :status', { status: 'pending' })
        .getRawOne();

    const pendingCharges = pendingPayments?.total
      ? parseInt(pendingPayments.total) / 100
      : 0;

    // Calculate available for withdrawal (current balance minus held amounts and pending outgoing)
    const availableForWithdrawal = Math.max(
      0,
      wallet.currentBalance - (wallet.heldForCampaigns || 0) - pendingCharges,
    );

    return {
      currentBalance: wallet.currentBalance,
      pendingCharges,
      totalDeposited: wallet.totalDeposited || 0,
      totalSpent: wallet.totalWithdrawn || 0,
      availableForWithdrawal,
      totalHeldForCampaign: wallet.heldForCampaigns || 0,
    };
  }

  /**
   * Add funds to advertiser wallet using Stripe payment processing
   */
  async addFunds(
    firebaseUid: string,
    dto: AddFundsDto,
  ): Promise<FundingResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    let paymentMethodId = dto.paymentMethodId;

    // If no payment method specified, get default
    if (!paymentMethodId) {
      const customer = await this.stripe.customers.retrieve(
        advertiserDetails.stripeCustomerId,
      );

      if (typeof customer !== 'object' || customer.deleted) {
        throw new BadRequestException('Invalid Stripe customer');
      }

      const defaultPaymentMethod =
        customer.invoice_settings?.default_payment_method;

      if (!defaultPaymentMethod) {
        throw new BadRequestException(
          'No default payment method found. Please add a payment method first.',
        );
      }

      paymentMethodId =
        typeof defaultPaymentMethod === 'string'
          ? defaultPaymentMethod
          : defaultPaymentMethod.id;
    }

    // Calculate gross amount to charge including Stripe fees (2.9% + $0.30)
    const netAmountCents = dto.amount;
    const grossAmountCents = Math.round((netAmountCents + 30) / (1 - 0.029));
    const stripeFees = grossAmountCents - netAmountCents;

    // Create payment intent with the gross amount (including fees)
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: grossAmountCents,
      currency: 'usd',
      customer: advertiserDetails.stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/payment-success`,
      description: dto.description || 'Add funds to wallet',
      metadata: {
        type: 'wallet_funding',
        userId: user.id,
        firebaseUid: user.firebaseUid,
        netAmount: netAmountCents.toString(),
        stripeFees: stripeFees.toString(),
      },
    });

    console.log('Creating payment record for intent:', paymentIntent.id);
    console.log(
      `Net amount: $${(netAmountCents / 100).toFixed(2)}, Gross amount: $${(grossAmountCents / 100).toFixed(2)}, Stripe fees: $${(stripeFees / 100).toFixed(2)}`,
    );

    // Save payment record to database for tracking
    try {
      const paymentRecord = this.paymentRecordRepo.create({
        stripePaymentIntentId: paymentIntent.id,
        userId: user.id,
        amountCents: netAmountCents,
        currency: 'USD',
        paymentType: 'WALLET_FUNDING',
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        description: dto.description || 'Add funds to wallet',
      });

      const savedPaymentRecord =
        await this.paymentRecordRepo.save(paymentRecord);

      // If payment succeeded immediately, update wallet balance
      if (paymentIntent.status === 'succeeded') {
        await this.processSuccessfulDeposit(
          user.id,
          netAmountCents,
          savedPaymentRecord,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error saving payment record for intent ${paymentIntent.id}:`,
        error,
      );
      throw new BadRequestException(
        'Payment processing failed. Please try again.',
      );
    }

    console.log('Payment intent created successfully:', paymentIntent.id);
    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  /**
   * Withdraw funds from advertiser wallet
   */
  async withdrawFunds(
    firebaseUid: string,
    dto: WithdrawFundsDto,
  ): Promise<WithdrawalResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const balance = await this.getWalletBalance(user.firebaseUid);

    const withdrawalAmountDollars = dto.amount / 100;

    // Calculate withdrawal fee
    const withdrawalFeeThreshold = 500; // $500 threshold for free withdrawals
    const withdrawalFeeDollars =
      withdrawalAmountDollars >= withdrawalFeeThreshold ? 0 : 5; // $5.00 fee
    const netWithdrawalDollars = withdrawalAmountDollars - withdrawalFeeDollars;

    // Business rule validations
    if (withdrawalAmountDollars > balance.availableForWithdrawal) {
      throw new BadRequestException(
        'Insufficient available balance for withdrawal',
      );
    }

    if (netWithdrawalDollars < 1) {
      throw new BadRequestException(
        `Minimum net withdrawal amount is $1.00. ` +
          `Withdrawal amount: $${withdrawalAmountDollars.toFixed(2)}, ` +
          `Fee: $${withdrawalFeeDollars.toFixed(2)}, ` +
          `Net amount: $${netWithdrawalDollars.toFixed(2)}`,
      );
    }

    const minimumBalance = 10;
    if (balance.currentBalance - withdrawalAmountDollars < minimumBalance) {
      throw new BadRequestException(
        `Minimum wallet balance of $${minimumBalance} required`,
      );
    }

    // Check daily withdrawal limit
    const dailyLimit = 5000;
    const todayWithdrawals = await this.getTodayWithdrawals(user.id);

    if (todayWithdrawals + withdrawalAmountDollars > dailyLimit) {
      throw new BadRequestException(
        `Daily withdrawal limit exceeded. Limit: $${dailyLimit}, Today's withdrawals: $${todayWithdrawals}`,
      );
    }

    // Create withdrawal transaction record
    const withdrawalTransaction = this.transactionRepo.create({
      userId: user.id,
      userType: UserType.ADVERTISER,
      type: TransactionType.WITHDRAWAL,
      amount: -withdrawalAmountDollars,
      status: TransactionStatus.PENDING,
      description:
        dto.description ||
        `Wallet withdrawal - $${withdrawalAmountDollars.toFixed(2)} (Net: $${netWithdrawalDollars.toFixed(2)}, Fee: $${withdrawalFeeDollars.toFixed(2)})`,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
    });

    const savedWithdrawalTransaction = await this.transactionRepo.save(
      withdrawalTransaction,
    );

    // Update wallet balance immediately
    const wallet = await this.walletRepo.findOne({
      where: { userId: user.id, userType: UserType.ADVERTISER },
    });

    if (wallet) {
      wallet.currentBalance -= withdrawalAmountDollars;
      wallet.totalWithdrawn =
        (wallet.totalWithdrawn || 0) + withdrawalAmountDollars;
      await this.walletRepo.save(wallet);
    }

    // Calculate estimated arrival (3-5 business days)
    const estimatedArrival = this.calculateBusinessDays(new Date(), 5);

    this.logger.log(
      `Withdrawal processed: User ${user.id}, Amount: $${withdrawalAmountDollars}, Transaction ID: ${savedWithdrawalTransaction.id}`,
    );

    return {
      withdrawalId: savedWithdrawalTransaction.id,
      amount: dto.amount,
      processingTime: '3-5 business days',
      estimatedArrival: estimatedArrival.toLocaleDateString(),
      status: 'pending',
    };
  }

  /**
   * Get paginated transaction history for an advertiser
   */
  async getTransactions(
    firebaseUid: string,
    query: TransactionQueryDto,
  ): Promise<TransactionResponse> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const page = query.page || 1;
    const limit = Math.min(query.limit || 10, 100);
    const offset = (page - 1) * limit;

    const queryBuilder = this.transactionRepo
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.campaign', 'campaign')
      .leftJoinAndSelect('transaction.paymentRecord', 'paymentRecord')
      .where('transaction.userId = :userId', { userId: user.id })
      .andWhere('transaction.userType = :userType', {
        userType: UserType.ADVERTISER,
      })
      .orderBy('transaction.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.type) {
      queryBuilder.andWhere('transaction.type = :type', {
        type: query.type,
      });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return {
      transactions: transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        grossAmount: txn.grossAmountCents
          ? txn.grossAmountCents / 100
          : undefined,
        platformFee: txn.platformFeeCents
          ? txn.platformFeeCents / 100
          : undefined,
        description: txn.description || '',
        campaignId: txn.campaignId,
        campaignTitle: txn.campaign?.title,
        status: txn.status,
        paymentMethod: txn.paymentMethod,
        createdAt: txn.createdAt.toISOString(),
        processedAt: txn.processedAt?.toISOString(),
        paymentIntentId: txn.stripeTransactionId,
        paymentRecordId: txn.paymentRecordId,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get withdrawal limits and recommendations
   */
  async getWithdrawalLimits(firebaseUid: string): Promise<WithdrawalLimits> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const balance = await this.getWalletBalance(user.firebaseUid);

    // Get today's withdrawals to calculate remaining daily limit
    const dailyLimit = 5000;
    const todayWithdrawals = await this.getTodayWithdrawals(user.id);
    const remainingDailyLimit = Math.max(0, dailyLimit - todayWithdrawals);

    // Calculate maximum withdrawable amount considering all constraints
    const minimumBalance = 10;
    const maxWithdrawableByBalance = Math.max(
      0,
      balance.availableForWithdrawal - minimumBalance,
    );
    const maxWithdrawableByDailyLimit = remainingDailyLimit;
    const maxWithdrawable = Math.min(
      maxWithdrawableByBalance,
      maxWithdrawableByDailyLimit,
    );

    return {
      feeStructure: {
        standardFee: 5.0,
        freeWithdrawalThreshold: 500.0,
        minimumWithdrawal: 6.0,
      },
      limits: {
        dailyLimit,
        remainingDailyLimit,
        maxWithdrawable: Number(maxWithdrawable.toFixed(2)),
        recommendedMaxWithdrawal: Number(maxWithdrawable.toFixed(2)),
      },
      campaignRestrictions: {
        activeCampaigns: 0, // This would need campaign service
        totalBudgetAllocated: 0,
        recommendedReserve: 0,
        canWithdrawFullBalance: true,
      },
      processingTime: '3-5 business days',
      description:
        'No active campaigns. You can withdraw up to your available balance minus the $10 minimum required.',
    };
  }

  /**
   * Process a successful deposit by updating wallet balance and creating transaction record
   */
  async processSuccessfulDeposit(
    userId: string,
    netAmountCents: number,
    paymentRecord: PaymentRecord,
  ): Promise<void> {
    const netAmountDollars = netAmountCents / 100;

    // Get or create advertiser wallet
    let wallet = await this.walletRepo.findOne({
      where: { userId, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        userType: UserType.ADVERTISER,
        currentBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        heldForCampaigns: 0,
      });
    }

    // Update wallet balances
    wallet.currentBalance += netAmountDollars;
    wallet.totalDeposited += netAmountDollars;

    await this.walletRepo.save(wallet);

    // Create transaction record for audit trail
    const transaction = this.transactionRepo.create({
      userId,
      userType: UserType.ADVERTISER,
      type: TransactionType.WALLET_DEPOSIT,
      amount: netAmountDollars,
      grossAmountCents:
        paymentRecord.amountCents +
        Math.round(paymentRecord.amountCents * 0.029) +
        30,
      platformFeeCents: 0,
      status: TransactionStatus.COMPLETED,
      description: paymentRecord.description,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
      stripeTransactionId: paymentRecord.stripePaymentIntentId,
      paymentRecordId: paymentRecord.id,
      processedAt: new Date(),
    });

    await this.transactionRepo.save(transaction);

    this.logger.log(
      `Wallet deposit processed: User ${userId}, Amount: $${netAmountDollars}, New Balance: $${wallet.currentBalance}`,
    );
  }

  private async getTodayWithdrawals(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result: { total: string | null } | undefined =
      await this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(ABS(transaction.amount))', 'total')
        .where('transaction.userId = :userId', { userId })
        .andWhere('transaction.type = :type', {
          type: TransactionType.WITHDRAWAL,
        })
        .andWhere('transaction.createdAt >= :today', { today })
        .andWhere('transaction.createdAt < :tomorrow', { tomorrow })
        .andWhere('transaction.status IN (:...statuses)', {
          statuses: [TransactionStatus.PENDING, TransactionStatus.COMPLETED],
        })
        .getRawOne();

    return result?.total ? parseFloat(result.total) : 0;
  }

  private calculateBusinessDays(startDate: Date, businessDays: number): Date {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < businessDays) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
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
