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
import {
  PaymentMethod,
  PaymentMethodType,
} from '../database/entities/payment-method.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod as TxnPaymentMethod,
} from '../database/entities/transaction.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignBudgetAllocation } from '../database/entities/campaign-budget-allocation.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { CampaignStatus } from '../enums/campaign-status';
import {
  CompletePaymentSetupDto,
  AddPaymentMethodDto,
  AddFundsDto,
  FundCampaignDto,
  UpdateBudgetDto,
  TransactionQueryDto,
  WithdrawFundsDto,
} from '../controllers/advertiser.controller';

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

export interface WalletBalance {
  currentBalance: number;
  pendingCharges: number;
  totalDeposited: number;
  totalSpent: number;
  availableForWithdrawal: number;
}

export interface TransactionResponse {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    campaignId?: string;
    campaignTitle?: string;
    status: string;
    createdAt: string;
    paymentIntentId?: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

export interface FundingResult {
  paymentIntentId?: string;
  clientSecret?: string | null;
}

export interface CampaignFundingStatus {
  campaignId: string;
  totalBudget: number;
  spentAmount: number;
  remainingBudget: number;
  pendingPayments: number;
  lastPaymentDate?: string;
  paymentHistory: Array<any>;
}

export interface BudgetUpdateResult {
  requiresAdditionalFunding: boolean;
  additionalFundingAmount?: number;
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

@Injectable()
export class AdvertiserPaymentService {
  private readonly logger = new Logger(AdvertiserPaymentService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepo: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignBudgetAllocation)
    private readonly budgetAllocationRepo: Repository<CampaignBudgetAllocation>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
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

  async completePaymentSetup(
    firebaseUid: string,
    dto: CompletePaymentSetupDto,
  ) {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.advertiserDetailsRepo.findOne({
      where: { userId: user.id },
    });

    if (!advertiserDetails) {
      throw new NotFoundException('Advertiser details not found');
    }

    // Create Stripe customer if not exists
    if (!advertiserDetails.stripeCustomerId) {
      const stripeCustomer = await this.stripe.customers.create({
        email: dto.email,
        name: dto.companyName,
        metadata: {
          firebaseUid: user.firebaseUid,
          userId: user.id,
        },
      });

      advertiserDetails.stripeCustomerId = stripeCustomer.id;
      await this.advertiserDetailsRepo.save(advertiserDetails);
    }

    return {
      id: `stripe_customer_${advertiserDetails.id}`,
      customerId: advertiserDetails.stripeCustomerId,
      userId: user.id,
      email: dto.email,
      name: dto.companyName,
      defaultPaymentMethodId: null,
      createdAt: advertiserDetails.createdAt.toISOString(),
      updatedAt: advertiserDetails.updatedAt.toISOString(),
    };
  }

  async createSetupIntent(firebaseUid: string): Promise<SetupIntentResponse> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    if (!advertiserDetails.stripeCustomerId) {
      throw new BadRequestException(
        'Stripe customer not found. Complete payment setup first.',
      );
    }

    const setupIntent = await this.stripe.setupIntents.create({
      customer: advertiserDetails.stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
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

    if (!advertiserDetails.stripeCustomerId) {
      return [];
    }

    // Sync payment methods from Stripe to ensure we have the latest state
    await this.syncPaymentMethodsFromStripe(
      user.id,
      advertiserDetails.stripeCustomerId,
    );

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: advertiserDetails.stripeCustomerId,
      type: 'card',
    });

    const savedMethods = await this.paymentMethodRepo.find({
      where: { userId: user.id },
    });

    return paymentMethods.data.map((pm) => {
      const savedMethod = savedMethods.find(
        (sm) => sm.stripePaymentMethodId === pm.id,
      );

      return {
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              funding: pm.card.funding,
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
        isDefault: savedMethod?.isDefault || false,
        createdAt: new Date(pm.created * 1000).toISOString(),
      };
    });
  }

  async addPaymentMethod(firebaseUid: string, dto: AddPaymentMethodDto) {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Verify payment method exists in Stripe and belongs to customer
    const paymentMethod = await this.stripe.paymentMethods.retrieve(
      dto.paymentMethodId,
    );

    if (paymentMethod.customer !== advertiserDetails.stripeCustomerId) {
      throw new BadRequestException(
        'Payment method does not belong to customer',
      );
    }

    // If setting as default, unset other defaults
    if (dto.setAsDefault) {
      await this.paymentMethodRepo.update(
        { userId: user.id },
        { isDefault: false },
      );
    }

    // Save payment method to database
    const savedMethod = this.paymentMethodRepo.create({
      userId: user.id,
      stripePaymentMethodId: dto.paymentMethodId,
      type: paymentMethod.type as PaymentMethodType,
      cardBrand: paymentMethod.card?.brand,
      cardLast4: paymentMethod.card?.last4,
      cardExpMonth: paymentMethod.card?.exp_month,
      cardExpYear: paymentMethod.card?.exp_year,
      isDefault: dto.setAsDefault,
    });

    await this.paymentMethodRepo.save(savedMethod);
  }

  async removePaymentMethod(firebaseUid: string, paymentMethodId: string) {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    const savedMethod = await this.paymentMethodRepo.findOne({
      where: { userId: user.id, stripePaymentMethodId: paymentMethodId },
    });

    if (!savedMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Detach from Stripe
    await this.stripe.paymentMethods.detach(paymentMethodId);

    // Remove from database
    await this.paymentMethodRepo.remove(savedMethod);
  }

  async setDefaultPaymentMethod(firebaseUid: string, paymentMethodId: string) {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    const savedMethod = await this.paymentMethodRepo.findOne({
      where: { userId: user.id, stripePaymentMethodId: paymentMethodId },
    });

    if (!savedMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Unset all defaults
    await this.paymentMethodRepo.update(
      { userId: user.id },
      { isDefault: false },
    );

    // Set new default
    savedMethod.isDefault = true;
    await this.paymentMethodRepo.save(savedMethod);
  }

  /**
   * Get advertiser wallet balance from payment records
   *
   * Calculates real-time balance by aggregating all completed payment transactions:
   * - INCOMING: WALLET_DEPOSIT (user deposits from card)
   * - OUTGOING: CAMPAIGN_FUNDING, WITHDRAWAL (money leaving wallet)
   * - PENDING: Tracks transactions still processing
   *
   * This approach ensures balance accuracy by using payment_records as single source
   * of truth rather than maintaining separate wallet balance tracking.
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @returns Promise<WalletBalance> with current balance, pending amounts, and totals
   *
   * Business Logic:
   * - currentBalance = totalDeposited - totalSpent
   * - availableForWithdrawal = currentBalance - pendingOutgoing
   * - pendingCharges = pendingIncoming + pendingOutgoing
   *
   * Example Flow:
   * 1. User deposits $500 → WALLET_DEPOSIT (+$500)
   * 2. User funds campaign $200 → CAMPAIGN_FUNDING (-$200)
   * 3. User withdraws $100 → WITHDRAWAL (-$100)
   * 4. Result: currentBalance = $200, availableForWithdrawal = $200
   */
  async getWalletBalance(firebaseUid: string): Promise<WalletBalance> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Get all completed transactions that ADD money to wallet (positive amounts)
    const totalIncoming: { total: string | null } | undefined =
      await this.paymentRecordRepo
        .createQueryBuilder('payment')
        .select('SUM(payment.amountCents)', 'total')
        .where('payment.userId = :userId', { userId: user.id })
        .andWhere('payment.paymentType IN (:...incomingTypes)', {
          incomingTypes: ['WALLET_DEPOSIT'], // Only deposits add money
        })
        .andWhere('payment.status = :status', { status: 'completed' })
        .getRawOne();

    const totalIncomingCents = parseInt(totalIncoming?.total || '0');
    const totalDeposited = totalIncomingCents / 100;

    // Get all completed transactions that REMOVE money from wallet (negative amounts)
    const totalOutgoing: { total: string | null } | undefined =
      await this.paymentRecordRepo
        .createQueryBuilder('payment')
        .select('SUM(payment.amountCents)', 'total')
        .where('payment.userId = :userId', { userId: user.id })
        .andWhere('payment.paymentType IN (:...outgoingTypes)', {
          outgoingTypes: ['CAMPAIGN_FUNDING', 'WITHDRAWAL'], // Both reduce wallet balance
        })
        .andWhere('payment.status = :status', { status: 'completed' })
        .getRawOne();

    const totalOutgoingCents = parseInt(totalOutgoing?.total || '0');
    const totalSpent = totalOutgoingCents / 100;

    // Get pending incoming transactions (deposits still processing)
    const pendingIncoming: { total: string | null } | undefined =
      await this.paymentRecordRepo
        .createQueryBuilder('payment')
        .select('SUM(payment.amountCents)', 'total')
        .where('payment.userId = :userId', { userId: user.id })
        .andWhere('payment.paymentType IN (:...incomingTypes)', {
          incomingTypes: ['WALLET_DEPOSIT'],
        })
        .andWhere('payment.status = :status', { status: 'pending' })
        .getRawOne();

    const pendingIncomingCents = parseInt(pendingIncoming?.total || '0');
    const pendingAmount = pendingIncomingCents / 100;

    // Get pending outgoing transactions (withdrawals/funding still processing)
    const pendingOutgoing: { total: string | null } | undefined =
      await this.paymentRecordRepo
        .createQueryBuilder('payment')
        .select('SUM(payment.amountCents)', 'total')
        .where('payment.userId = :userId', { userId: user.id })
        .andWhere('payment.paymentType IN (:...outgoingTypes)', {
          outgoingTypes: ['CAMPAIGN_FUNDING', 'WITHDRAWAL'],
        })
        .andWhere('payment.status = :status', { status: 'pending' })
        .getRawOne();

    const pendingOutgoingCents = parseInt(pendingOutgoing?.total || '0');
    const pendingCharges = pendingOutgoingCents / 100;

    // Calculate current balance: incoming - outgoing
    const currentBalance = totalDeposited - totalSpent;

    // Available for withdrawal = current balance - pending outgoing
    const availableForWithdrawal = Math.max(0, currentBalance - pendingCharges);

    return {
      currentBalance: Number(currentBalance.toFixed(2)),
      pendingCharges: Number((pendingAmount + pendingCharges).toFixed(2)), // Total pending changes
      totalDeposited: Number(totalDeposited.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
      availableForWithdrawal: Number(availableForWithdrawal.toFixed(2)),
    };
  }

  async addFunds(
    firebaseUid: string,
    dto: AddFundsDto,
  ): Promise<FundingResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    let paymentMethodId = dto.paymentMethodId;

    // If no payment method specified, use default
    if (!paymentMethodId) {
      const defaultMethod = await this.paymentMethodRepo.findOne({
        where: { userId: user.id, isDefault: true },
      });

      if (!defaultMethod) {
        throw new BadRequestException('No default payment method found');
      }

      paymentMethodId = defaultMethod.stripePaymentMethodId;
    }

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: dto.amount,
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
      },
    });
    console.log('Creating payment record for intent:', paymentIntent.id);

    // Calculate net amount after Stripe fees (2.9% + $0.30)
    // User pays: dto.amount (includes fees)
    // Net amount for wallet: dto.amount - Stripe fees
    const stripeFees = Math.round(dto.amount * 0.029) + 30;
    const netAmountCents = dto.amount - stripeFees;

    // Save payment record to database for tracking
    try {
      const paymentRecord = this.paymentRecordRepo.create({
        stripePaymentIntentId: paymentIntent.id,
        // campaignId is optional, so we can omit it for wallet funding
        userId: user.id,
        amountCents: netAmountCents, // Store net amount that goes to wallet
        currency: 'USD',
        paymentType: 'WALLET_DEPOSIT',
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        description: dto.description || 'Add funds to wallet',
      });

      console.log(
        'Payment record created, about to save:',
        JSON.stringify(paymentRecord, null, 2),
      );

      const savedPaymentRecord =
        await this.paymentRecordRepo.save(paymentRecord);
      console.log(
        'Payment record successfully saved with ID:',
        savedPaymentRecord.id,
      );

      // Verify it was saved by querying it back
      const verifyRecord = await this.paymentRecordRepo.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
      });
      console.log(
        'Verification query result:',
        verifyRecord ? 'Found' : 'Not found',
      );
    } catch (error) {
      console.error('Error saving payment record:', error);
      console.error(
        'Error details:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    console.log('Payment intent created successfully:', paymentIntent.id);
    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

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
      .where('transaction.promoterId = :userId', { userId: user.id })
      .orderBy('transaction.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.type) {
      queryBuilder.andWhere('transaction.type = :type', { type: query.type });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return {
      transactions: transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        description: txn.description || '',
        campaignId: txn.campaignId,
        campaignTitle: txn.campaign?.title,
        status: txn.status,
        createdAt: txn.createdAt.toISOString(),
        paymentIntentId: txn.stripeTransactionId,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async fundCampaign(
    firebaseUid: string,
    campaignId: string,
    dto: FundCampaignDto,
  ): Promise<FundingResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, advertiserId: user.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (dto.source === 'wallet') {
      return this.fundFromWallet(user.id, campaignId, dto.amount);
    } else {
      return this.fundDirectly(
        user,
        campaignId,
        dto.amount,
        dto.paymentMethodId!,
      );
    }
  }

  async getCampaignFundingStatus(
    firebaseUid: string,
    campaignId: string,
  ): Promise<CampaignFundingStatus> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, advertiserId: user.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const budgetAllocation = await this.budgetAllocationRepo.findOne({
      where: { campaignId },
    });

    const paymentHistory = await this.transactionRepo.find({
      where: { campaignId, promoterId: user.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      campaignId,
      totalBudget: budgetAllocation?.totalBudget || 0,
      spentAmount: budgetAllocation?.spentAmount || 0,
      remainingBudget:
        (budgetAllocation?.totalBudget || 0) -
        (budgetAllocation?.spentAmount || 0),
      pendingPayments: 0, // Calculate from pending transactions
      lastPaymentDate: paymentHistory[0]?.createdAt?.toISOString(),
      paymentHistory: paymentHistory.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        description: txn.description,
        campaignId: txn.campaignId,
        campaignTitle: campaign.title,
        status: txn.status,
        createdAt: txn.createdAt.toISOString(),
        paymentIntentId: txn.stripeTransactionId,
      })),
    };
  }

  async updateCampaignBudget(
    firebaseUid: string,
    campaignId: string,
    dto: UpdateBudgetDto,
  ): Promise<BudgetUpdateResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, advertiserId: user.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const newBudgetDollars = dto.newBudget / 100;
    const currentBudget = campaign.maxBudget || 0;
    const additionalFunding = Math.max(0, newBudgetDollars - currentBudget);

    // Update campaign budget
    campaign.maxBudget = newBudgetDollars;
    await this.campaignRepo.save(campaign);

    return {
      requiresAdditionalFunding: additionalFunding > 0,
      additionalFundingAmount:
        additionalFunding > 0 ? Math.round(additionalFunding * 100) : undefined,
    };
  }

  /**
   * Withdraw funds from advertiser wallet to their bank account
   * Business Rules:
   * - Minimum balance of $10 must remain in wallet
   * - Cannot withdraw if user has active campaigns
   * - Processing time: 3-5 business days
   * - Daily withdrawal limit: $5,000
   * - Withdrawal fee: $5.00 flat fee (deducted from withdrawal amount)
   * - Free withdrawals for amounts over $500
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

    // Business rule: Check available balance (including fee)
    if (withdrawalAmountDollars > balance.availableForWithdrawal) {
      throw new BadRequestException(
        'Insufficient available balance for withdrawal',
      );
    }

    // Business rule: Minimum withdrawal after fees
    if (netWithdrawalDollars < 1) {
      throw new BadRequestException(
        `Minimum net withdrawal amount is $1.00. ` +
          `Withdrawal amount: $${withdrawalAmountDollars.toFixed(2)}, ` +
          `Fee: $${withdrawalFeeDollars.toFixed(2)}, ` +
          `Net amount: $${netWithdrawalDollars.toFixed(2)}`,
      );
    }

    // Business rule: Minimum balance requirement ($10)
    const minimumBalance = 10;
    if (balance.currentBalance - withdrawalAmountDollars < minimumBalance) {
      throw new BadRequestException(
        `Minimum wallet balance of $${minimumBalance} required`,
      );
    }

    // Business rule: Check for active campaigns
    const activeCampaigns = await this.campaignRepo.count({
      where: { advertiserId: user.id, status: CampaignStatus.ACTIVE },
    });

    if (
      activeCampaigns > 0 &&
      withdrawalAmountDollars > balance.currentBalance * 0.5
    ) {
      throw new BadRequestException(
        'Cannot withdraw more than 50% of balance while campaigns are active',
      );
    }

    // Business rule: Daily withdrawal limit check
    const dailyLimit = 5000; // $5,000
    const todayWithdrawals = await this.getTodayWithdrawals(user.id);

    if (todayWithdrawals + withdrawalAmountDollars > dailyLimit) {
      throw new BadRequestException(
        `Daily withdrawal limit exceeded. Limit: $${dailyLimit}, Today's withdrawals: $${todayWithdrawals}`,
      );
    }

    // Create withdrawal transaction record (full amount deducted from wallet)
    const withdrawalTransaction = this.transactionRepo.create({
      promoterId: user.id,
      type: TransactionType.WITHDRAWAL,
      amount: -withdrawalAmountDollars, // Full amount deducted from wallet
      status: TransactionStatus.PENDING,
      description:
        dto.description ||
        `Wallet withdrawal - $${withdrawalAmountDollars.toFixed(2)} (Net: $${netWithdrawalDollars.toFixed(2)}, Fee: $${withdrawalFeeDollars.toFixed(2)})`,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
    });

    const savedWithdrawalTransaction = await this.transactionRepo.save(
      withdrawalTransaction,
    );

    // Process the actual Stripe transfer to bank account
    try {
      const transferResult = await this.processStripeTransfer(
        user,
        netWithdrawalDollars,
        dto.bankAccountId,
      );

      // Update transaction with Stripe transfer ID
      savedWithdrawalTransaction.stripeTransactionId =
        transferResult.transferId;
      savedWithdrawalTransaction.description += ` (Transfer ID: ${transferResult.transferId})`;
      await this.transactionRepo.save(savedWithdrawalTransaction);

      this.logger.log(
        `Stripe transfer initiated for user ${user.id}, amount: $${netWithdrawalDollars}, transfer ID: ${transferResult.transferId}`,
      );
    } catch (error) {
      // If Stripe transfer fails, mark transaction as failed
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown transfer error';
      savedWithdrawalTransaction.status = TransactionStatus.FAILED;
      savedWithdrawalTransaction.description += ` (Transfer failed: ${errorMessage})`;
      await this.transactionRepo.save(savedWithdrawalTransaction);

      this.logger.error(
        `Stripe transfer failed for user ${user.id}: ${errorMessage}`,
      );
      throw new BadRequestException(
        `Withdrawal failed: ${errorMessage}. Please try again or contact support.`,
      );
    }

    // Calculate estimated arrival (3-5 business days)
    const estimatedArrival = this.calculateBusinessDays(new Date(), 5);

    return {
      withdrawalId: savedWithdrawalTransaction.id,
      amount: dto.amount,
      processingTime: '3-5 business days',
      estimatedArrival: estimatedArrival.toLocaleDateString(),
      status: 'pending',
    };
  }

  /**
   * Get today's total withdrawals for a user
   */
  private async getTodayWithdrawals(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result: { total: string | null } | undefined =
      await this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(ABS(transaction.amount))', 'total')
        .where('transaction.promoterId = :userId', { userId })
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

  /**
   * Calculate business days from a given date
   */
  private calculateBusinessDays(startDate: Date, businessDays: number): Date {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < businessDays) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  }

  // Helper methods

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

  private async fundFromWallet(
    userId: string,
    campaignId: string,
    amount: number,
  ): Promise<FundingResult> {
    // Check wallet balance first
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const balance = await this.getWalletBalance(user.firebaseUid);
    const amountDollars = amount / 100;

    if (balance.availableForWithdrawal < amountDollars) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Create transaction record
    const transaction = this.transactionRepo.create({
      promoterId: userId,
      campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: -amountDollars, // Negative for outflow
      status: TransactionStatus.COMPLETED,
      description: `Campaign funding from wallet`,
      paymentMethod: TxnPaymentMethod.WALLET,
    });

    await this.transactionRepo.save(transaction);

    return {};
  }

  private async fundDirectly(
    user: UserEntity,
    campaignId: string,
    amount: number,
    paymentMethodId: string,
  ): Promise<FundingResult> {
    const advertiserDetails = await this.findAdvertiserDetails(user.id);

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: advertiserDetails.stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/payment-success`,
      description: `Campaign funding for campaign ${campaignId}`,
      metadata: {
        type: 'campaign_funding',
        campaignId,
        userId: user.id,
        firebaseUid: user.firebaseUid,
      },
    });

    // Save payment record to database for tracking
    const paymentRecord = this.paymentRecordRepo.create({
      stripePaymentIntentId: paymentIntent.id,
      campaignId,
      userId: user.id,
      amountCents: amount,
      currency: 'USD',
      paymentType: 'CAMPAIGN_FUNDING',
      status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
      description: `Campaign funding for campaign ${campaignId}`,
    });

    await this.paymentRecordRepo.save(paymentRecord);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  // Helper method to sync payment methods from Stripe to local database
  private async syncPaymentMethodsFromStripe(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    try {
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
          // Check if this payment method already exists for ANY user (due to unique constraint)
          const existingGlobal = await this.paymentMethodRepo.findOne({
            where: { stripePaymentMethodId: pm.id },
          });

          if (existingGlobal) {
            // If it exists for a different user, this is an error state
            if (existingGlobal.userId !== userId) {
              this.logger.warn(
                `Payment method ${pm.id} exists for different user ${existingGlobal.userId}, skipping sync for user ${userId}`,
              );
              continue;
            }
            // If it exists for the same user, skip (shouldn't happen with our filter above, but safety check)
            continue;
          }

          const newPaymentMethod = this.paymentMethodRepo.create({
            userId,
            stripePaymentMethodId: pm.id,
            type: pm.type as PaymentMethodType,
            cardBrand: pm.card?.brand,
            cardLast4: pm.card?.last4,
            cardExpMonth: pm.card?.exp_month,
            cardExpYear: pm.card?.exp_year,
            isDefault: false, // Don't automatically set as default
          });

          await this.paymentMethodRepo.save(newPaymentMethod);
          this.logger.log(`Synced payment method ${pm.id} for user ${userId}`);
        } catch (saveError) {
          // Handle duplicate key error gracefully
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (saveError && saveError.code === '23505') {
            this.logger.warn(
              `Payment method ${pm.id} already exists in database, skipping`,
            );
          } else {
            this.logger.error(
              `Error saving payment method ${pm.id} for user ${userId}:`,
              saveError,
            );
          }
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

  /**
   * Get withdrawal limits and recommendations based on campaign allocations
   */
  async getWithdrawalLimits(firebaseUid: string): Promise<WithdrawalLimits> {
    const user = await this.findUserByFirebaseUid(firebaseUid);
    const balance = await this.getWalletBalance(user.firebaseUid);

    // Get active campaigns and their budget allocations
    const activeCampaigns = await this.campaignRepo.find({
      where: {
        advertiserId: user.id,
        status: CampaignStatus.ACTIVE,
      },
      select: ['id', 'title', 'budgetAllocated', 'maxBudget', 'minBudget'],
    });

    // Calculate total budget allocated across active campaigns
    const totalBudgetAllocated = activeCampaigns.reduce(
      (sum, campaign) => sum + (campaign.budgetAllocated || 0),
      0,
    );

    // Calculate recommended reserve (20% of allocated budget or $50, whichever is higher)
    const recommendedReserve = Math.max(
      totalBudgetAllocated * 0.2,
      activeCampaigns.length > 0 ? 50 : 0,
    );

    // Get today's withdrawals to calculate remaining daily limit
    const dailyLimit = 5000; // $5,000 daily limit
    const todayWithdrawals = await this.getTodayWithdrawals(user.id);
    const remainingDailyLimit = Math.max(0, dailyLimit - todayWithdrawals);

    // Calculate maximum withdrawable amount considering all constraints
    const minimumBalance = 10; // $10 minimum wallet balance
    const maxWithdrawableByBalance = Math.max(
      0,
      balance.availableForWithdrawal - minimumBalance,
    );
    const maxWithdrawableByDailyLimit = remainingDailyLimit;
    const maxWithdrawable = Math.min(
      maxWithdrawableByBalance,
      maxWithdrawableByDailyLimit,
    );

    // Calculate recommended max withdrawal considering campaign needs
    const safeWithdrawable = Math.max(
      0,
      balance.availableForWithdrawal - recommendedReserve - minimumBalance,
    );
    const recommendedMaxWithdrawal = Math.min(
      safeWithdrawable,
      maxWithdrawable,
    );

    // Determine if user can withdraw full balance
    const canWithdrawFullBalance =
      activeCampaigns.length === 0 &&
      balance.availableForWithdrawal > minimumBalance;

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
        recommendedMaxWithdrawal: Number(recommendedMaxWithdrawal.toFixed(2)),
      },
      campaignRestrictions: {
        activeCampaigns: activeCampaigns.length,
        totalBudgetAllocated: Number(totalBudgetAllocated.toFixed(2)),
        recommendedReserve: Number(recommendedReserve.toFixed(2)),
        canWithdrawFullBalance,
      },
      processingTime: '3-5 business days',
      description:
        activeCampaigns.length > 0
          ? `You have ${activeCampaigns.length} active campaign(s) with $${totalBudgetAllocated.toFixed(2)} allocated. We recommend keeping $${recommendedReserve.toFixed(2)} in your wallet for campaign operations.`
          : 'No active campaigns. You can withdraw up to your available balance minus the $10 minimum required.',
    };
  }

  /**
   * Process actual Stripe transfer to user's bank account
   * This handles the real money movement from platform to user's bank
   */
  private async processStripeTransfer(
    user: UserEntity,
    netAmountDollars: number,
    bankAccountId?: string,
  ): Promise<{ transferId: string; status: string }> {
    try {
      // Get advertiser details to access Stripe accounts
      const advertiserDetails = await this.findAdvertiserDetails(user.id);

      if (!advertiserDetails.stripeCustomerId) {
        throw new Error(
          'No Stripe customer found. Please complete payment setup first.',
        );
      }

      // Convert dollars to cents for Stripe
      const amountCents = Math.round(netAmountDollars * 100);

      // TODO: uncomment once we add stripeConnectedAccount to advertiserDetails
      // If user has a Stripe Connect account, use transfers
      // if (advertiserDetails.stripeConnectedAccountId) {
      //   return await this.processConnectTransfer(
      //     advertiserDetails,
      //     user,
      //     amountCents,
      //     bankAccountId,
      //   );
      // } else {
      // Fallback: Use direct payout to customer's external account
      return await this.processDirectPayout(
        advertiserDetails,
        user,
        amountCents,
        bankAccountId,
      );
      //}
    } catch (error) {
      this.logger.error('Stripe transfer error:', error);

      // Provide more specific error messages
      if (error && typeof error === 'object' && 'type' in error) {
        const stripeError = error as { type: string; message: string };
        if (stripeError.type === 'StripeCardError') {
          throw new Error('Bank account error: ' + stripeError.message);
        } else if (stripeError.type === 'StripeInvalidRequestError') {
          throw new Error('Invalid withdrawal request: ' + stripeError.message);
        } else if (stripeError.type === 'StripeConnectionError') {
          throw new Error(
            'Payment processing temporarily unavailable. Please try again.',
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error('Withdrawal processing failed: ' + errorMessage);
    }
  }

  /**
   * Process transfer using Stripe Connect (for connected accounts)
   */
  private async processConnectTransfer(
    advertiserDetails: AdvertiserDetailsEntity,
    user: UserEntity,
    amountCents: number,
    bankAccountId?: string,
  ): Promise<{ transferId: string; status: string }> {
    console.log(bankAccountId);
    // TODO: once we added  we will need to uncomment that
    // If no specific bank account provided, use the default external account
    // let destinationAccountId = bankAccountId;

    // if (!destinationAccountId) {
    //   // Get the default external account from Stripe Connect account
    //   const account = await this.stripe.accounts.retrieve(
    //     advertiserDetails.stripeConnectedAccountId,
    //   );

    //   if (!account.external_accounts?.data?.[0]) {
    //     throw new Error(
    //       'No bank account found for withdrawal. Please add a bank account first.',
    //     );
    //   }

    //   destinationAccountId = account.external_accounts.data[0].id;
    // }

    // // Create Stripe transfer to the connected account
    // const transfer = await this.stripe.transfers.create({
    //   amount: amountCents,
    //   currency: 'usd',
    //   destination: advertiserDetails.stripeConnectedAccountId,
    //   description: `Wallet withdrawal for user ${user.firebaseUid}`,
    //   metadata: {
    //     userId: user.id,
    //     firebaseUid: user.firebaseUid,
    //     withdrawalType: 'wallet_withdrawal',
    //     bankAccountId: destinationAccountId || '',
    //   },
    // });

    // Create a payout to move money to their bank account
    try {
      // const payout = await this.stripe.payouts.create(
      //   {
      //     amount: amountCents,
      //     currency: 'usd',
      //     description: `Wallet withdrawal payout`,
      //     metadata: {
      //       transferId: transfer.id,
      //       userId: user.id,
      //     },
      //   },
      //   {
      //     stripeAccount: advertiserDetails.stripeConnectedAccountId,
      //   },
      // );
      // this.logger.log(
      //   `Payout created for transfer ${transfer.id}: ${payout.id}`,
      // );
    } catch (payoutError) {
      const errorMessage =
        payoutError instanceof Error
          ? payoutError.message
          : 'Unknown payout error';
      this.logger.warn(
        `Payout creation failed for transfer : ${errorMessage}. ` +
          `Funds transferred to connected account balance.`,
      );
    }

    return {
      transferId: 'temporary', // TODO: change for transfer.id
      status: 'completed', // Stripe transfers are processed immediately
    };
  }

  /**
   * Process direct payout (fallback when no Connect account)
   */
  private processDirectPayout(
    advertiserDetails: AdvertiserDetailsEntity,
    user: UserEntity,
    _amountCents: number,
    _bankAccountId?: string,
  ): Promise<{ transferId: string; status: string }> {
    // For now, we'll create a record but not actually process the payout
    // This would require setting up external accounts on the customer
    // which is more complex and typically requires Stripe Connect

    this.logger.warn(
      `Direct payout requested for user ${user.id} but Stripe Connect not set up. ` +
        `Manual processing may be required.`,
    );

    // Create a placeholder transfer record for tracking
    // In a real implementation, you might use Stripe's ACH/bank transfer APIs
    // or integrate with other payment processors

    const placeholderTransferId = `manual_${user.id}_${Date.now()}`;

    return Promise.resolve({
      transferId: placeholderTransferId,
      status: 'requires_manual_processing',
    });
  }
}
