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
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { StripeConnectAccount } from '../database/entities/stripe-connect-account.entity';
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
import { CampaignBudgetTracking } from '../database/entities/campaign-budget-tracking.entity';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Wallet } from '../database/entities/wallet.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../database/entities/promoter-campaign.entity';
import { CampaignStatus } from '../enums/campaign-status';
import { UserType } from '../enums/user-type';
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
  totalHeldForCampaign: number;
}

export interface TransactionResponse {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    grossAmount?: number; // Gross amount before fees (for transparency)
    platformFee?: number; // Platform fee amount (for transparency)
    description: string;
    campaignId?: string;
    campaignTitle?: string;
    status: string;
    paymentMethod?: string; // Payment method used
    createdAt: string;
    processedAt?: string; // When transaction was actually processed
    paymentIntentId?: string;
    paymentRecordId?: string; // Link to payment record for audit trail
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

export interface CampaignFundingFeasibility {
  canAfford: boolean;
  currentAvailableBalance: number; // Available balance for new campaigns (excluding held amounts)
  estimatedBudget: number; // Budget needed for the new campaign
  shortfallAmount: number; // How much more is needed (0 if can afford)
  recommendedDeposit: number; // Recommended deposit amount (includes buffer and Stripe fees)
  walletSummary?: {
    totalBalance: number; // Total current balance
    heldForExistingCampaigns: number; // Amount held for existing campaigns
    pendingTransactions: number; // Pending deposits/withdrawals
  };
}

export interface PayPromoterResult {
  paymentId: string; // Transaction ID for the payment
  newBudgetAllocated: number; // Total amount allocated to this promoter for this campaign
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
    @InjectRepository(PromoterDetailsEntity)
    private readonly promoterDetailsRepo: Repository<PromoterDetailsEntity>,
    @InjectRepository(StripeConnectAccount)
    private readonly stripeConnectAccountRepo: Repository<StripeConnectAccount>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private readonly budgetTrackingRepo: Repository<CampaignBudgetTracking>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepo: Repository<PromoterCampaign>,
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
   * Get advertiser wallet balance using the unified wallet system
   *
   * Uses the wallets table as the primary source of truth for current balances,
   * with payment_records providing pending transaction details for accuracy.
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @returns Promise<WalletBalance> with current balance, pending amounts, and totals
   *
   * Business Logic:
   * - Uses wallet.current_balance as authoritative current balance
   * - Uses wallet.total_deposited and total_withdrawn for lifetime totals
   * - Calculates pending amounts from payment_records with 'pending' status
   * - availableForWithdrawal = current_balance - pending_outgoing - held_for_campaigns
   */
  async getWalletBalance(firebaseUid: string): Promise<WalletBalance> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Get or create advertiser wallet
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
    const pendingDeposits = pendingIncomingCents / 100;

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
    const pendingWithdrawals = pendingOutgoingCents / 100;

    // Calculate total spent (total_deposited - current_balance + held_for_campaigns)
    const totalSpent = wallet.totalDeposited - wallet.currentBalance;

    const totalHeldForCampaign = wallet.heldForCampaigns || 0;

    // Available for withdrawal = current balance - pending outgoing - held for campaigns
    const availableForWithdrawal = Math.max(
      0,
      wallet.currentBalance -
        pendingWithdrawals -
        (wallet.heldForCampaigns || 0),
    );
    const currentBalance =
      Number(wallet.currentBalance.toFixed(2)) -
      Number(totalHeldForCampaign.toFixed(2));

    return {
      currentBalance: currentBalance,
      pendingCharges: Number((pendingDeposits + pendingWithdrawals).toFixed(2)),
      totalDeposited: Number(wallet.totalDeposited.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
      availableForWithdrawal: Number(availableForWithdrawal.toFixed(2)),
      totalHeldForCampaign: Number(totalHeldForCampaign.toFixed(2)),
    };
  }

  /**
   * Add funds to advertiser wallet using Stripe payment processing
   *
   * This method handles the complete flow of depositing money into an advertiser's wallet:
   * 1. Calculates gross amount to charge including Stripe processing fees (2.9% + $0.30)
   * 2. Creates a Stripe PaymentIntent for the gross amount (including fees)
   * 3. Processes payment using the specified or default payment method
   * 4. Creates a PaymentRecord for tracking and audit purposes
   * 5. If payment succeeds immediately, updates wallet balance and creates transaction record
   * 6. For async payments, wallet update happens via webhook (payment.intent.succeeded)
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @param dto - AddFundsDto containing net amount (what user wants in wallet), payment method, and optional description
   * @returns Promise<FundingResult> with PaymentIntent ID and client secret for frontend confirmation
   *
   * Business Rules:
   * - Minimum deposit: $1.00 (100 cents) net amount
   * - Maximum deposit: No limit (subject to payment method limits)
   * - Fee Structure: Stripe fees (2.9% + $0.30) are added to the requested amount
   * - User specifies net amount they want in wallet, we calculate gross amount to charge
   * - Payment methods: Credit/debit cards via Stripe
   * - Processing: Immediate for most cards, may require 3D Secure for some
   *
   * Fee Calculation Example:
   * - User wants $100.00 in wallet ($10,000 cents)
   * - Gross amount to charge: ($100.00 + $0.30) / 0.971 = $103.40
   * - Stripe fees: $103.40 - $100.00 = $3.40
   * - Net amount added to wallet: $100.00 (exactly what user requested)
   *
   * Error Handling:
   * - BadRequestException: No default payment method found
   * - NotFoundException: User or advertiser details not found
   * - Stripe errors: Payment declined, invalid payment method, etc.
   *
   * Database Operations:
   * - Creates PaymentRecord with net amount and 'pending' or 'completed' status
   * - If payment succeeds immediately: updates Wallet balance and creates Transaction
   * - If payment is async: webhook will handle wallet/transaction updates later
   *
   * Security Considerations:
   * - Payment method ownership verified via Stripe customer association
   * - All monetary amounts handled in cents to avoid floating-point precision issues
   * - Stripe PaymentIntent provides built-in fraud protection and 3D Secure when needed
   * - Metadata attached to PaymentIntent for debugging and reconciliation
   *
   * Integration Points:
   * - Frontend: Uses returned clientSecret for payment confirmation with Stripe.js
   * - Webhooks: payment.intent.succeeded webhook processes async payment completion
   * - Audit: All operations logged and tracked via PaymentRecord and Transaction entities
   */
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

    // Calculate gross amount to charge including Stripe fees (2.9% + $0.30)
    // dto.amount is the net amount the user wants in their wallet
    // We need to calculate the gross amount to charge to cover fees
    // Formula: grossAmount = (netAmount + 30) / (1 - 0.029)
    const netAmountCents = dto.amount; // This is what user wants in wallet
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
        // campaignId is optional, so we can omit it for wallet funding
        userId: user.id,
        amountCents: netAmountCents, // Store the net amount that goes to wallet
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

      // If payment succeeded immediately, update wallet and create transaction
      if (paymentIntent.status === 'succeeded') {
        await this.processSuccessfulDeposit(
          user.id,
          netAmountCents,
          savedPaymentRecord,
        );
      }

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

  /**
   * Get paginated transaction history for an advertiser
   *
   * Retrieves transaction records from the unified transactions table, filtered by:
   * - User ID and User Type (ADVERTISER)
   * - Optional transaction type filtering
   * - Chronological ordering (most recent first)
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @param query - Query parameters for pagination and filtering
   * @returns Promise<TransactionResponse> with paginated transaction data
   *
   * New Architecture Features:
   * - Uses unified transaction table with user_type discrimination
   * - Includes gross amounts and platform fees for transparency
   * - Links to payment records for full audit trail
   * - Supports all new transaction types (WALLET_DEPOSIT, VIEW_EARNING, etc.)
   * - Provides processing timestamps for better tracking
   *
   * Response Fields:
   * - Basic transaction info (id, type, amount, status, date)
   * - Fee breakdown (gross amount, platform fees) when available
   * - Campaign association for campaign-related transactions
   * - Payment method and processing details
   * - Stripe transaction IDs for external reconciliation
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
        // Include fee breakdown for transparency
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
        // Additional context for audit trail
        paymentRecordId: txn.paymentRecordId,
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

    const budgetTracking = await this.budgetTrackingRepo.findOne({
      where: { campaignId },
    });

    const paymentHistory = await this.transactionRepo.find({
      where: { campaignId, userId: user.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      campaignId,
      totalBudget: budgetTracking?.allocatedBudgetCents
        ? budgetTracking.allocatedBudgetCents / 100
        : 0,
      spentAmount: budgetTracking?.spentBudgetCents
        ? budgetTracking.spentBudgetCents / 100
        : 0,
      remainingBudget: budgetTracking
        ? (budgetTracking.allocatedBudgetCents -
            budgetTracking.spentBudgetCents) /
          100
        : 0,
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
      userId: user.id,
      userType: UserType.ADVERTISER,
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
      userId: userId,
      userType: UserType.ADVERTISER,
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
      // Validate stripeCustomerId before making API calls
      if (!stripeCustomerId || stripeCustomerId.trim() === '') {
        this.logger.warn(
          `Skipping payment method sync for user ${userId}: No valid Stripe customer ID`,
        );
        return;
      }

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
   * Process direct payout (fallback when no Connect account)
   */
  private processDirectPayout(
    advertiserDetails: AdvertiserDetailsEntity,
    user: UserEntity,
    amountCents: number,
    bankAccountId?: string,
  ): Promise<{ transferId: string; status: string }> {
    // Avoid unused parameter warnings
    void advertiserDetails;
    void amountCents;
    void bankAccountId;
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

  /**
   * Process a successful deposit by updating wallet balance and creating transaction record
   * This ensures wallet balance stays in sync with payment records
   */
  private async processSuccessfulDeposit(
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
        30, // Original amount before fees
      platformFeeCents: 0, // No platform fee for deposits
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

  /**
   * Check if advertiser has sufficient funds for a new campaign
   *
   * This method calculates:
   * 1. Current available balance (current_balance - held_for_campaigns - pending_outgoing)
   * 2. Whether the advertiser can afford the estimated budget for new campaign
   * 3. If not, how much additional funding is needed
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @param estimatedBudgetCents - Estimated budget for the new campaign in cents
   * @returns Object with funding feasibility information
   */
  async checkCampaignFundingFeasibility(
    firebaseUid: string,
    estimatedBudgetCents: number,
  ): Promise<CampaignFundingFeasibility> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Get current wallet balance details
    const balance = await this.getWalletBalance(firebaseUid);

    // Get wallet entity for held_for_campaigns amount
    const wallet = await this.walletRepo.findOne({
      where: { userId: user.id, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      return {
        canAfford: false,
        currentAvailableBalance: 0,
        estimatedBudget: estimatedBudgetCents / 100,
        shortfallAmount: estimatedBudgetCents / 100,
        recommendedDeposit: this.calculateRecommendedDeposit(
          estimatedBudgetCents / 100,
        ),
      };
    }

    // Calculate available balance for new campaigns
    // This is current balance minus what's already held for existing campaigns and pending outgoing
    const availableForNewCampaigns = Math.max(
      0,
      wallet.currentBalance - (wallet.heldForCampaigns || 0),
    );

    const estimatedBudgetDollars = estimatedBudgetCents / 100;
    const canAfford = availableForNewCampaigns >= estimatedBudgetDollars;
    const shortfallAmount = canAfford
      ? 0
      : estimatedBudgetDollars - availableForNewCampaigns;

    return {
      canAfford,
      currentAvailableBalance: Number(availableForNewCampaigns.toFixed(2)),
      estimatedBudget: estimatedBudgetDollars,
      shortfallAmount: Number(shortfallAmount.toFixed(2)),
      recommendedDeposit:
        shortfallAmount > 0
          ? this.calculateRecommendedDeposit(shortfallAmount)
          : 0,
      walletSummary: {
        totalBalance: balance.currentBalance,
        heldForExistingCampaigns: Number(
          (wallet.heldForCampaigns || 0).toFixed(2),
        ),
        pendingTransactions: balance.pendingCharges,
      },
    };
  }

  /**
   * Calculate recommended deposit amount including a buffer and accounting for Stripe fees
   *
   * @param shortfallAmount - The minimum amount needed in dollars
   * @returns Recommended deposit amount including buffer and fees
   */
  private calculateRecommendedDeposit(shortfallAmount: number): number {
    // Add 20% buffer to the shortfall
    const amountWithBuffer = shortfallAmount * 1.2;

    // Calculate gross amount needed to get the net amount after Stripe fees
    // Using our existing fee calculation logic
    const grossAmountCents = this.calculateTotalAmountForNetDeposit(
      amountWithBuffer * 100,
    );

    return Number((grossAmountCents / 100).toFixed(2));
  }

  /**
   * Calculate total amount needed to be charged to get a specific net deposit amount
   * Accounts for Stripe processing fees (2.9% + $0.30)
   *
   * @param netAmountCents - Net amount user wants in wallet (in cents)
   * @returns Gross amount to charge including fees (in cents)
   */
  private calculateTotalAmountForNetDeposit(netAmountCents: number): number {
    // Formula: grossAmount = (netAmount + 30) / (1 - 0.029)
    return Math.round((netAmountCents + 30) / (1 - 0.029));
  }

  /**
   * Pay a promoter for their work on a campaign
   *
   * This method handles the complete flow of paying a promoter:
   * 1. Validates campaign ownership and promoter participation
   * 2. Checks advertiser wallet balance and campaign budget
   * 3. Deducts amount from advertiser wallet
   * 4. Calculates platform fee (20%) and net payment to promoter
   * 5. Processes Stripe payment to promoter
   * 6. Updates campaign budget tracking
   * 7. Creates transaction records for audit trail
   *
   * @param firebaseUid - Firebase UID of the advertiser
   * @param dto - PayPromoterDto with campaign, promoter, and amount details
   * @returns PayPromoterResult with payment ID and updated budget allocation
   */
  async payPromoter(
    firebaseUid: string,
    dto: {
      campaignId: string;
      promoterId: string;
      amount: number;
      description?: string;
    },
  ): Promise<PayPromoterResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // 1. Validate campaign ownership
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId, advertiserId: user.id },
    });

    if (!campaign) {
      throw new NotFoundException(
        'Campaign not found or you do not have permission to access it',
      );
    }

    // 2. Validate campaign status
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Campaign must be active to process payments',
      );
    }

    // 3. Validate promoter participation
    const promoterCampaign = await this.promoterCampaignRepo.findOne({
      where: {
        campaignId: dto.campaignId,
        promoterId: dto.promoterId,
        status: PromoterCampaignStatus.ONGOING, // Use enum value instead of string
      },
    });

    if (!promoterCampaign) {
      throw new NotFoundException(
        'Promoter is not actively working on this campaign',
      );
    }

    // 4. Get campaign budget tracking (create if doesn't exist for campaigns without initial budget)
    let budgetTracking = await this.budgetTrackingRepo.findOne({
      where: { campaignId: dto.campaignId },
    });

    if (!budgetTracking) {
      // Create budget tracking for campaigns that were created without initial budget
      budgetTracking = this.budgetTrackingRepo.create({
        campaignId: dto.campaignId,
        advertiserId: campaign.advertiserId,
        allocatedBudgetCents: 0,
        spentBudgetCents: 0,
        platformFeesCollectedCents: 0,
      });
      await this.budgetTrackingRepo.save(budgetTracking);
    }

    // 5. Validate advertiser wallet balance
    const advertiserWallet = await this.walletRepo.findOne({
      where: { userId: user.id, userType: UserType.ADVERTISER },
    });

    if (!advertiserWallet) {
      throw new BadRequestException('Advertiser wallet not found');
    }

    const amountDollars = dto.amount / 100;
    if (advertiserWallet.currentBalance < amountDollars) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: $${advertiserWallet.currentBalance.toFixed(2)}, Required: $${amountDollars.toFixed(2)}`,
      );
    }

    // 6. Calculate platform fee (20%) and net payment
    const platformFeeCents = Math.round(dto.amount * 0.2);
    const netPaymentCents = dto.amount - platformFeeCents;
    const netPaymentDollars = netPaymentCents / 100;

    // 7. Process payment to promoter via Stripe
    const promoter = await this.userRepo.findOne({
      where: { id: dto.promoterId },
    });
    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // Create transaction record for advertiser (deduction)
    const advertiserTransaction = this.transactionRepo.create({
      userId: user.id,
      userType: UserType.ADVERTISER,
      campaignId: dto.campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: -amountDollars, // Negative for outflow
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.COMPLETED,
      description: `Payment to promoter ${promoter.name} for campaign ${campaign.title}`,
      paymentMethod: TxnPaymentMethod.WALLET,
    });

    const savedAdvertiserTransaction = await this.transactionRepo.save(
      advertiserTransaction,
    );

    // Create transaction record for promoter (earning)
    const promoterTransaction = this.transactionRepo.create({
      userId: dto.promoterId,
      userType: UserType.PROMOTER,
      campaignId: dto.campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: netPaymentDollars, // Positive for income
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.PENDING, // Will be updated when Stripe payment succeeds
      description: `Payment from advertiser ${user.name} for campaign ${campaign.title}`,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
    });

    const savedPromoterTransaction =
      await this.transactionRepo.save(promoterTransaction);

    // 8. Update advertiser wallet
    advertiserWallet.currentBalance -= amountDollars;
    advertiserWallet.heldForCampaigns =
      (advertiserWallet.heldForCampaigns || 0) - amountDollars;
    await this.walletRepo.save(advertiserWallet);

    // 9. Update promoter wallet
    let promoterWallet = await this.walletRepo.findOne({
      where: { userId: dto.promoterId, userType: UserType.PROMOTER },
    });

    if (!promoterWallet) {
      // Create promoter wallet if it doesn't exist
      promoterWallet = this.walletRepo.create({
        userId: dto.promoterId,
        userType: UserType.PROMOTER,
        currentBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarned: 0,
      });
    }

    promoterWallet.currentBalance += netPaymentDollars;
    promoterWallet.totalEarned =
      (promoterWallet.totalEarned || 0) + netPaymentDollars;
    await this.walletRepo.save(promoterWallet);

    // 10. Update campaign budget tracking
    budgetTracking.spentBudgetCents += dto.amount;
    budgetTracking.platformFeesCollectedCents += platformFeeCents;
    await this.budgetTrackingRepo.save(budgetTracking);

    // 11. Update promoter campaign record
    promoterCampaign.earnings =
      (promoterCampaign.earnings || 0) + netPaymentDollars;
    promoterCampaign.spentBudget =
      (promoterCampaign.spentBudget || 0) + amountDollars;
    promoterCampaign.finalPayoutAmount =
      (promoterCampaign.finalPayoutAmount || 0) + amountDollars;
    const temp = await this.promoterCampaignRepo.save(promoterCampaign);
    console.log('saved promotercampaign: ', temp);

    // 12. Calculate total amount paid to this promoter for this campaign
    const totalPaidToPromoter: { total: string | null } | undefined =
      await this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(ABS(transaction.grossAmountCents))', 'total')
        .where('transaction.userId = :advertiserId', { advertiserId: user.id })
        .andWhere('transaction.campaignId = :campaignId', {
          campaignId: dto.campaignId,
        })
        .andWhere('transaction.type = :type', {
          type: TransactionType.DIRECT_PAYMENT,
        })
        .andWhere('transaction.userType = :userType', {
          userType: UserType.ADVERTISER,
        })
        .andWhere('transaction.description LIKE :promoterPattern', {
          promoterPattern: `%${promoter.name}%`,
        })
        .getRawOne();

    const newBudgetAllocated = parseInt(
      totalPaidToPromoter?.total || dto.amount.toString(),
    );

    // 13. Process actual Stripe payment to promoter
    try {
      const stripeTransferResult = await this.processPromoterPayment(
        promoter,
        netPaymentCents,
        `Payment from campaign: ${campaign.title}`,
      );

      // Update promoter transaction with Stripe transfer info
      savedPromoterTransaction.stripeTransactionId =
        stripeTransferResult.transferId;
      savedPromoterTransaction.status = TransactionStatus.COMPLETED;
      savedPromoterTransaction.processedAt = new Date();
      await this.transactionRepo.save(savedPromoterTransaction);

      this.logger.log(
        `Stripe transfer successful: ${stripeTransferResult.transferId} for promoter ${dto.promoterId}`,
      );
    } catch (stripeError) {
      // If Stripe transfer fails, log error but don't fail the entire operation
      // The promoter transaction will remain in PENDING status
      const errorMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error';
      this.logger.error(
        `Stripe transfer failed for promoter ${dto.promoterId}: ${errorMessage}`,
      );

      // Optionally, you could set the transaction to FAILED status or implement retry logic
      savedPromoterTransaction.description += ` (Stripe transfer failed: ${errorMessage})`;
      await this.transactionRepo.save(savedPromoterTransaction);
    }

    this.logger.log(
      `Promoter payment processed: Advertiser ${user.id} paid $${amountDollars} to promoter ${dto.promoterId} for campaign ${dto.campaignId}. ` +
        `Platform fee: $${(platformFeeCents / 100).toFixed(2)}, Net to promoter: $${netPaymentDollars.toFixed(2)}`,
    );

    return {
      paymentId: savedAdvertiserTransaction.id,
      newBudgetAllocated: newBudgetAllocated,
    };
  }

  /**
   * Process payment to promoter via Stripe Connect
   * Since advertisers have already funded their wallet (money is in platform's Stripe account),
   * we just need to transfer from platform account to promoter's connected account
   *
   * @param promoter - Promoter user entity
   * @param amountCents - Amount to transfer in cents
   * @param description - Payment description
   * @returns Transfer result with ID and status
   */
  private async processPromoterPayment(
    promoter: UserEntity,
    amountCents: number,
    description: string,
  ): Promise<{ transferId: string; status: string }> {
    try {
      this.logger.log(
        `Processing Stripe Connect transfer: $${amountCents / 100} USD to promoter ${promoter.name} (${promoter.id})`,
      );

      // Get promoter's Stripe Connect account ID (using firebase UID, not internal ID)
      const stripeConnectAccount = await this.stripeConnectAccountRepo.findOne({
        where: { userId: promoter.firebaseUid },
      });

      if (!stripeConnectAccount || !stripeConnectAccount.stripeAccountId) {
        this.logger.error(
          `Stripe Connect account not found for promoter ${promoter.id} (${promoter.firebaseUid})`,
        );
        throw new Error(
          'Promoter does not have a Stripe Connect account setup. Please complete payment onboarding.',
        );
      }

      // Verify the Stripe Connect account is active and can receive payouts
      const account = await this.stripe.accounts.retrieve(
        stripeConnectAccount.stripeAccountId,
      );

      if (!account.payouts_enabled) {
        throw new Error(
          "Promoter's Stripe Connect account is not enabled for payouts. Please complete account verification.",
        );
      }

      if (!account.charges_enabled) {
        this.logger.warn(
          `Promoter ${promoter.id} Connect account has charges disabled, but payouts are enabled. Proceeding with transfer.`,
        );
      }

      // Create Stripe transfer from platform account to promoter's connected account
      const transfer = await this.stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: stripeConnectAccount.stripeAccountId,
        description: description,
        metadata: {
          promoterId: promoter.id,
          promoterName: promoter.name,
          paymentType: 'campaign_work_payment',
          platformUserId: promoter.id,
        },
      });

      this.logger.log(
        `Stripe Connect transfer successful: ${transfer.id} - $${amountCents / 100} USD to promoter ${promoter.name}`,
      );

      return {
        transferId: transfer.id,
        status: 'completed', // Stripe transfers are processed immediately
      };
    } catch (error) {
      this.logger.error(
        `Stripe Connect transfer failed for promoter ${promoter.id}:`,
        error,
      );

      // Provide more specific error messages based on Stripe error types
      if (error && typeof error === 'object' && 'type' in error) {
        const stripeError = error as { type: string; message: string };
        if (stripeError.type === 'StripeInvalidRequestError') {
          throw new Error(
            `Transfer failed: ${stripeError.message}. Please verify promoter's payment setup.`,
          );
        } else if (stripeError.type === 'StripeConnectionError') {
          throw new Error(
            'Payment processing temporarily unavailable. Please try again.',
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown transfer error';
      throw new Error(`Payment transfer failed: ${errorMessage}`);
    }
  }

  /**
   * Process bank transfer for promoter payment (ACH/Wire transfer)
   * This method is a placeholder since we primarily use Stripe Connect
   *
   * @param promoter - Promoter user entity
   * @param amountCents - Amount to transfer in cents
   * @param description - Transfer description
   * @returns Transfer result with ID and status
   */
  private async processBankTransfer(
    promoter: UserEntity,
    amountCents: number,
    description: string,
  ): Promise<{ transferId: string; status: string }> {
    try {
      const amountDollars = amountCents / 100;

      this.logger.log(
        `Bank transfer requested: $${amountDollars} USD to promoter ${promoter.name} (${promoter.id}). Description: ${description}`,
      );

      // Check if promoter has completed payment onboarding
      const promoterDetails = await this.promoterDetailsRepo.findOne({
        where: { userId: promoter.id },
      });

      if (!promoterDetails) {
        throw new Error(
          'Promoter details not found. Payment onboarding required.',
        );
      }

      // For now, we don't support direct bank transfers
      // All promoters should use Stripe Connect for instant transfers
      this.logger.warn(
        `Direct bank transfer not supported for promoter ${promoter.id}. ` +
          `Promoter should complete Stripe Connect onboarding for instant payments.`,
      );

      // Create a placeholder transfer record for tracking
      const transferId = `bank_pending_${Date.now()}_${promoter.id}`;

      // Log transfer details for manual processing
      this.logger.log(
        `Bank transfer requires manual processing: ID ${transferId}, Amount: $${amountDollars}, ` +
          `Promoter: ${promoter.name}. Recommend promoter complete Stripe Connect setup.`,
      );

      return {
        transferId,
        status: 'requires_stripe_connect_setup',
      };
    } catch (error) {
      this.logger.error(
        `Bank transfer error for promoter ${promoter.id}:`,
        error,
      );
      throw new Error(
        `Bank transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate US routing number format (9 digits)
   */
  private isValidRoutingNumber(routingNumber: string): boolean {
    // US routing numbers are exactly 9 digits
    const routingRegex = /^\d{9}$/;
    return routingRegex.test(routingNumber);
  }

  /**
   * Validate US bank account number format (4-17 digits)
   */
  private isValidAccountNumber(accountNumber: string): boolean {
    // US bank account numbers are typically 4-17 digits
    const accountRegex = /^\d{4,17}$/;
    return accountRegex.test(accountNumber);
  }

  /**
   * Determine the best payout method for a promoter based on their Stripe Connect setup
   *
   * @param promoter - Promoter user entity
   * @returns Payout method and any additional setup required
   */
  private async getPromoterPayoutMethod(promoter: UserEntity): Promise<{
    method: 'stripe_connect' | 'manual' | 'direct_deposit';
    requiresSetup: boolean;
    setupInstructions?: string;
  }> {
    try {
      // Check if promoter has Stripe Connect account (using firebase UID)
      const stripeConnectAccount = await this.stripeConnectAccountRepo.findOne({
        where: { userId: promoter.firebaseUid },
      });

      if (stripeConnectAccount?.stripeAccountId) {
        // Verify the Stripe Connect account is complete and active
        try {
          const account = await this.stripe.accounts.retrieve(
            stripeConnectAccount.stripeAccountId,
          );

          if (account.charges_enabled && account.payouts_enabled) {
            return {
              method: 'stripe_connect',
              requiresSetup: false,
            };
          } else {
            return {
              method: 'stripe_connect',
              requiresSetup: true,
              setupInstructions: `Complete Stripe Connect account verification. Status: charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`,
            };
          }
        } catch (stripeError) {
          this.logger.warn(
            `Stripe Connect account verification failed for promoter ${promoter.id}:`,
            stripeError,
          );
          return {
            method: 'manual',
            requiresSetup: true,
            setupInstructions:
              'Stripe Connect account is invalid or inaccessible. Please re-setup payment method.',
          };
        }
      }

      // No Stripe Connect account found - require setup
      return {
        method: 'manual',
        requiresSetup: true,
        setupInstructions:
          'Promoter needs to complete Stripe Connect onboarding for instant payments. Please set up Stripe Connect account.',
      };
    } catch (error) {
      this.logger.error(
        `Error determining payout method for promoter ${promoter.id}:`,
        error,
      );

      // Fallback to manual processing on any error
      return {
        method: 'manual',
        requiresSetup: true,
        setupInstructions:
          'Payment method verification failed. Please contact support to setup payment processing.',
      };
    }
  }

  /**
   * Add test funds to platform Stripe account balance (TEST MODE ONLY)
   *
   * In test mode, payments made through addFunds don't add to available balance
   * for Connect transfers. This method uses Stripe's topup functionality to
   * simulate adding funds to the platform account for testing purposes.
   *
   * @param amountCents - Amount in cents to add to platform balance
   * @returns Topup object with status and details
   */
  async addTestFundsToPlatform(amountCents: number) {
    // Only allow in test mode
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Test funds can only be added in test mode',
      );
    }

    try {
      console.log(`Adding ${amountCents} cents to platform test balance...`);

      // Create a topup to add funds to platform account
      const topup = await this.stripe.topups.create({
        amount: amountCents,
        currency: 'usd',
        description: 'Test funds for Connect transfers',
        statement_descriptor: 'Test funds',
      });

      console.log('Topup created:', topup.id, 'Status:', topup.status);

      // Check current balance
      const balance = await this.stripe.balance.retrieve();
      console.log(
        'Platform balance after topup:',
        JSON.stringify(balance, null, 2),
      );

      return {
        topupId: topup.id,
        status: topup.status,
        amount: topup.amount,
        balance: balance.available,
      };
    } catch (error) {
      console.error('Error adding test funds to platform:', error);
      throw new BadRequestException(`Failed to add test funds: ${error}`);
    }
  }
}
