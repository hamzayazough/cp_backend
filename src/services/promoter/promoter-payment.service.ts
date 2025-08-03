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
import { STRIPE_CLIENT } from '../../stripe/stripe.constants';
import { UserEntity } from 'src/database/entities';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { CampaignBudgetTracking } from '../../database/entities/campaign-budget-tracking.entity';
import { StripeConnectAccount } from '../../database/entities/stripe-connect-account.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { PaymentRecord } from '../../database/entities/payment-record.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod as TxnPaymentMethod,
} from '../../database/entities/transaction.entity';
import {
  PromoterCampaign,
  PromoterCampaignStatus,
} from '../../database/entities/promoter-campaign.entity';
import { CampaignStatus } from '../../enums/campaign-status';
import { UserType } from '../../enums/user-type';
import { PayPromoterDto } from '../../controllers/advertiser.controller';
import { getCachedFxRate } from '../../helpers/currency.helper';

export interface PayPromoterResult {
  paymentId: string;
  newBudgetAllocated: number;
}

/**
 * Service responsible for processing promoter payments
 * Handles paying promoters via Stripe Connect transfers
 */
@Injectable()
export class PromoterPaymentService {
  private readonly logger = new Logger(PromoterPaymentService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private readonly budgetTrackingRepo: Repository<CampaignBudgetTracking>,
    @InjectRepository(StripeConnectAccount)
    private readonly stripeConnectAccountRepo: Repository<StripeConnectAccount>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(PromoterCampaign)
    private readonly promoterCampaignRepo: Repository<PromoterCampaign>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
  ) {}

  /**
   * Pay a promoter for their work on a campaign
   */
  async payPromoter(
    firebaseUid: string,
    dto: PayPromoterDto,
  ): Promise<PayPromoterResult> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Validate and get campaign data
    const { campaign, promoterCampaign } =
      await this.validateCampaignAndPromoter(
        user.id,
        dto.campaignId,
        dto.promoterId,
      );

    // Get or create budget tracking
    const budgetTracking = await this.getOrCreateBudgetTracking(
      dto.campaignId,
      campaign.advertiserId,
    );

    // Validate wallet balance
    await this.validateAdvertiserWalletBalance(user.id, dto.amount);

    // Calculate fees and payment amounts
    const { platformFeeCents, netPaymentDollars } =
      this.calculatePaymentAmounts(dto.amount);

    // Get promoter user details
    const promoter = await this.getPromoterUser(dto.promoterId);

    // Handle currency conversion if needed
    const { convertedNetPaymentDollars, advertiserCurrency, promoterCurrency } =
      this.handleCurrencyConversion(user, promoter, netPaymentDollars);

    // Create transaction records
    const { advertiserTransaction, promoterTransaction } =
      await this.createTransactionRecords(
        user,
        promoter,
        campaign,
        dto,
        platformFeeCents,
        netPaymentDollars,
        convertedNetPaymentDollars,
        advertiserCurrency,
        promoterCurrency,
      );

    // Update wallets
    await this.updateWallets(
      user.id,
      dto.promoterId,
      dto.amount / 100,
      convertedNetPaymentDollars,
    );

    // Update budget tracking
    await this.updateBudgetTracking(
      budgetTracking,
      dto.amount,
      platformFeeCents,
    );

    // Process Stripe payment
    const stripeResult = await this.processStripePayment(
      promoter,
      convertedNetPaymentDollars,
      campaign,
      dto.campaignId,
      promoterTransaction,
      advertiserCurrency,
      netPaymentDollars,
    );

    // Update promoter campaign earnings
    await this.updatePromoterCampaignEarnings(
      dto.promoterId,
      dto.campaignId,
      promoterCampaign,
      stripeResult.success,
    );

    // Calculate final earnings for return
    const finalEarnings = await this.calculatePromoterCampaignEarnings(
      dto.promoterId,
      dto.campaignId,
    );

    this.logPaymentCompletion(
      user,
      dto,
      platformFeeCents,
      convertedNetPaymentDollars,
      netPaymentDollars,
      advertiserCurrency,
      promoterCurrency,
    );

    return {
      paymentId: advertiserTransaction.id,
      newBudgetAllocated: Math.round(finalEarnings * 100),
    };
  }

  /**
   * Validate campaign ownership and promoter participation
   */
  private async validateCampaignAndPromoter(
    advertiserId: string,
    campaignId: string,
    promoterId: string,
  ): Promise<{ campaign: CampaignEntity; promoterCampaign: PromoterCampaign }> {
    // Validate campaign ownership
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, advertiserId },
    });

    if (!campaign) {
      throw new NotFoundException(
        'Campaign not found or you do not have permission to access it',
      );
    }

    // Validate campaign status
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Campaign must be active to process payments',
      );
    }

    // Validate promoter participation
    const promoterCampaign = await this.promoterCampaignRepo.findOne({
      where: {
        campaignId,
        promoterId,
        status: PromoterCampaignStatus.ONGOING,
      },
    });

    if (!promoterCampaign) {
      throw new NotFoundException(
        'Promoter is not actively working on this campaign',
      );
    }

    return { campaign, promoterCampaign };
  }

  /**
   * Get or create campaign budget tracking
   */
  private async getOrCreateBudgetTracking(
    campaignId: string,
    advertiserId: string,
  ): Promise<CampaignBudgetTracking> {
    let budgetTracking = await this.budgetTrackingRepo.findOne({
      where: { campaignId, advertiserId },
    });

    if (!budgetTracking) {
      budgetTracking = this.budgetTrackingRepo.create({
        campaignId,
        advertiserId,
        allocatedBudgetCents: 0,
        spentBudgetCents: 0,
        platformFeesCollectedCents: 0,
      });
      await this.budgetTrackingRepo.save(budgetTracking);
    }

    return budgetTracking;
  }

  /**
   * Validate advertiser wallet balance
   */
  private async validateAdvertiserWalletBalance(
    userId: string,
    amountCents: number,
  ): Promise<void> {
    const advertiserWallet = await this.walletRepo.findOne({
      where: { userId, userType: UserType.ADVERTISER },
    });

    if (!advertiserWallet) {
      throw new BadRequestException('Advertiser wallet not found');
    }

    const amountDollars = amountCents / 100;
    if (advertiserWallet.currentBalance < amountDollars) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: $${advertiserWallet.currentBalance.toFixed(2)}, Required: $${amountDollars.toFixed(2)}`,
      );
    }
  }

  /**
   * Calculate platform fee and payment amounts
   */
  private calculatePaymentAmounts(amountCents: number): {
    platformFeeCents: number;
    netPaymentDollars: number;
  } {
    const platformFeeCents = Math.round(amountCents * 0.2);
    const netPaymentCents = amountCents - platformFeeCents;
    const netPaymentDollars = netPaymentCents / 100;

    return { platformFeeCents, netPaymentDollars };
  }

  /**
   * Get promoter user details
   */
  private async getPromoterUser(promoterId: string): Promise<UserEntity> {
    const promoter = await this.userRepo.findOne({
      where: { id: promoterId },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    return promoter;
  }

  /**
   * Handle currency conversion if needed
   */
  private handleCurrencyConversion(
    advertiser: UserEntity,
    promoter: UserEntity,
    netPaymentDollars: number,
  ): {
    convertedNetPaymentDollars: number;
    advertiserCurrency: string;
    promoterCurrency: string;
  } {
    const advertiserCurrency = advertiser.usedCurrency || 'USD';
    const promoterCurrency = promoter.usedCurrency || 'USD';

    let convertedNetPaymentDollars = netPaymentDollars;

    if (advertiserCurrency !== promoterCurrency) {
      const fxRate = getCachedFxRate(advertiserCurrency, promoterCurrency);
      convertedNetPaymentDollars = Number(
        (netPaymentDollars * fxRate).toFixed(2),
      );
      this.logger.log(
        `Currency conversion: ${netPaymentDollars} ${advertiserCurrency} = ${convertedNetPaymentDollars} ${promoterCurrency} (rate: ${fxRate})`,
      );
    }

    return {
      convertedNetPaymentDollars,
      advertiserCurrency,
      promoterCurrency,
    };
  }

  /**
   * Create transaction records for both advertiser and promoter
   */
  private async createTransactionRecords(
    advertiser: UserEntity,
    promoter: UserEntity,
    campaign: CampaignEntity,
    dto: PayPromoterDto,
    platformFeeCents: number,
    netPaymentDollars: number,
    convertedNetPaymentDollars: number,
    advertiserCurrency: string,
    promoterCurrency: string,
  ): Promise<{
    advertiserTransaction: Transaction;
    promoterTransaction: Transaction;
  }> {
    const transactionType =
      dto.transactionType || TransactionType.DIRECT_PAYMENT;

    // Create advertiser transaction (deduction) - always in campaign currency
    const advertiserTransaction = this.transactionRepo.create({
      userId: advertiser.id,
      userType: UserType.ADVERTISER,
      campaignId: dto.campaignId,
      type: transactionType,
      amount: -(dto.amount / 100), // Gross amount in campaign currency (as dollars)
      grossAmountCents: dto.amount, // Gross amount in campaign currency (before fees)
      platformFeeCents: platformFeeCents, // Platform fee in campaign currency
      status: TransactionStatus.COMPLETED,
      description: `Payment to promoter ${promoter.name} for campaign ${campaign.title}`,
      paymentMethod: TxnPaymentMethod.WALLET,
    });

    const savedAdvertiserTransaction = await this.transactionRepo.save(
      advertiserTransaction,
    );

    // Create promoter transaction (earning) - net amount in promoter's currency
    const promoterTransaction = this.transactionRepo.create({
      userId: dto.promoterId,
      userType: UserType.PROMOTER,
      campaignId: dto.campaignId,
      type: transactionType,
      amount: convertedNetPaymentDollars, // Net amount in promoter's currency (after fees & conversion)
      grossAmountCents: dto.amount, // Original gross amount in campaign currency (before fees)
      platformFeeCents: platformFeeCents, // Platform fee in campaign currency
      status: TransactionStatus.COMPLETED,
      description: `Payment from advertiser ${advertiser.name} for campaign ${campaign.title}${
        advertiserCurrency !== promoterCurrency
          ? ` (converted from ${netPaymentDollars} ${advertiserCurrency})`
          : ''
      }`,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
    });

    const savedPromoterTransaction =
      await this.transactionRepo.save(promoterTransaction);

    return {
      advertiserTransaction: savedAdvertiserTransaction,
      promoterTransaction: savedPromoterTransaction,
    };
  }

  /**
   * Update advertiser and promoter wallets
   */
  private async updateWallets(
    advertiserId: string,
    promoterId: string,
    amountDollars: number,
    convertedNetPaymentDollars: number,
  ): Promise<void> {
    // Update advertiser wallet
    const advertiserWallet = await this.walletRepo.findOne({
      where: { userId: advertiserId, userType: UserType.ADVERTISER },
    });

    if (advertiserWallet) {
      advertiserWallet.currentBalance -= amountDollars;
      advertiserWallet.heldForCampaigns =
        (advertiserWallet.heldForCampaigns || 0) - amountDollars;
      await this.walletRepo.save(advertiserWallet);
    }

    // Update promoter wallet
    let promoterWallet = await this.walletRepo.findOne({
      where: { userId: promoterId, userType: UserType.PROMOTER },
    });

    if (!promoterWallet) {
      promoterWallet = this.walletRepo.create({
        userId: promoterId,
        userType: UserType.PROMOTER,
        currentBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarned: 0,
      });
    }

    promoterWallet.currentBalance += convertedNetPaymentDollars;
    promoterWallet.totalEarned =
      (promoterWallet.totalEarned || 0) + convertedNetPaymentDollars;
    await this.walletRepo.save(promoterWallet);
  }

  /**
   * Update campaign budget tracking
   */
  private async updateBudgetTracking(
    budgetTracking: CampaignBudgetTracking,
    amountCents: number,
    platformFeeCents: number,
  ): Promise<void> {
    budgetTracking.spentBudgetCents += amountCents;
    budgetTracking.platformFeesCollectedCents += platformFeeCents;
    await this.budgetTrackingRepo.save(budgetTracking);
  }

  /**
   * Process Stripe payment and create payment record
   */
  private async processStripePayment(
    promoter: UserEntity,
    convertedNetPaymentDollars: number,
    campaign: CampaignEntity,
    campaignId: string,
    promoterTransaction: Transaction,
    advertiserCurrency: string,
    netPaymentDollars: number,
  ): Promise<{ success: boolean; transferId?: string }> {
    try {
      // Use net payment amount in campaign currency for Stripe transfer
      const netPaymentCents = Math.round(netPaymentDollars * 100);

      const stripeTransferResult = await this.processPromoterPayment(
        promoter,
        netPaymentCents, // Net amount in campaign currency (after 20% fee)
        `Payment from campaign: ${campaign.title}`,
        campaignId,
        advertiserCurrency,
      );

      // Create payment record - store in campaign currency
      await this.createPaymentRecord({
        stripePaymentIntentId: stripeTransferResult.transferId,
        campaignId,
        userId: promoter.id,
        amountCents: netPaymentCents, // Net amount in campaign currency
        currency: advertiserCurrency, // Campaign currency
        paymentType: 'PROMOTER_PAYOUT',
        status: 'completed',
        description: `Stripe transfer to promoter ${promoter.name} for campaign ${campaign.title}`,
      });

      // Update promoter transaction with Stripe transfer info
      promoterTransaction.stripeTransactionId = stripeTransferResult.transferId;
      promoterTransaction.status = TransactionStatus.COMPLETED;
      promoterTransaction.processedAt = new Date();
      await this.transactionRepo.save(promoterTransaction);

      this.logger.log(
        `Stripe transfer successful: ${stripeTransferResult.transferId} for promoter ${promoter.id}`,
      );

      return { success: true, transferId: stripeTransferResult.transferId };
    } catch (stripeError) {
      const errorMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error';

      this.logger.error(
        `Stripe transfer failed for promoter ${promoter.id}: ${errorMessage}`,
      );

      // Create payment record for failed transfer
      const netPaymentCents = Math.round(netPaymentDollars * 100);
      await this.createPaymentRecord({
        stripePaymentIntentId: `failed_${Date.now()}_${promoter.id}`,
        campaignId,
        userId: promoter.id,
        amountCents: netPaymentCents,
        currency: advertiserCurrency,
        paymentType: 'PROMOTER_PAYOUT',
        status: 'failed',
        description: `Failed Stripe transfer to promoter ${promoter.name}: ${errorMessage}`,
      });

      // Update transaction with failure info
      promoterTransaction.description += ` (Stripe transfer failed: ${errorMessage})`;
      await this.transactionRepo.save(promoterTransaction);

      return { success: false };
    }
  }

  /**
   * Create a payment record for tracking Stripe transactions
   */
  private async createPaymentRecord(data: {
    stripePaymentIntentId: string;
    campaignId: string;
    userId: string;
    amountCents: number;
    currency: string;
    paymentType: string;
    status: string;
    description: string;
  }): Promise<PaymentRecord> {
    const paymentRecord = this.paymentRecordRepo.create({
      stripePaymentIntentId: data.stripePaymentIntentId,
      campaignId: data.campaignId,
      userId: data.userId,
      amountCents: data.amountCents,
      currency: data.currency,
      paymentType: data.paymentType,
      status: data.status,
      description: data.description,
    });

    return await this.paymentRecordRepo.save(paymentRecord);
  }

  /**
   * Update promoter campaign earnings
   */
  private async updatePromoterCampaignEarnings(
    promoterId: string,
    campaignId: string,
    promoterCampaign: PromoterCampaign,
    paymentSuccessful: boolean,
  ): Promise<void> {
    if (paymentSuccessful) {
      const totalPaidToPromoter = await this.calculatePromoterCampaignEarnings(
        promoterId,
        campaignId,
      );
      promoterCampaign.earnings = totalPaidToPromoter;
      await this.promoterCampaignRepo.save(promoterCampaign);
    }
  }

  /**
   * Log payment completion details
   */
  private logPaymentCompletion(
    user: UserEntity,
    dto: PayPromoterDto,
    platformFeeCents: number,
    convertedNetPaymentDollars: number,
    netPaymentDollars: number,
    advertiserCurrency: string,
    promoterCurrency: string,
  ): void {
    const amountDollars = dto.amount / 100;

    this.logger.log(
      `Promoter payment processed: Advertiser ${user.id} paid $${amountDollars} ${advertiserCurrency} to promoter ${dto.promoterId} for campaign ${dto.campaignId}. ` +
        `Platform fee: $${(platformFeeCents / 100).toFixed(2)} ${advertiserCurrency}, Net to promoter: $${convertedNetPaymentDollars.toFixed(2)} ${promoterCurrency}` +
        (advertiserCurrency !== promoterCurrency
          ? ` (converted from $${netPaymentDollars.toFixed(2)} ${advertiserCurrency})`
          : ''),
    );
  }

  /**
   * Process payment to promoter via Stripe Connect
   */
  async processPromoterPayment(
    promoter: UserEntity,
    amountCents: number,
    description: string,
    campaignId: string,
    transferCurrency: string,
  ): Promise<{ transferId: string; status: string }> {
    try {
      this.logger.log(
        `Processing Stripe Connect transfer: $${amountCents / 100} ${promoter.usedCurrency || 'USD'} to promoter ${promoter.name} (${promoter.id})`,
      );

      // Get promoter's Stripe Connect account ID
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

      // Verify the Stripe Connect account is active
      const account = await this.stripe.accounts.retrieve(
        stripeConnectAccount.stripeAccountId,
      );

      if (!account.payouts_enabled) {
        throw new Error(
          "Promoter's Stripe Connect account is not enabled for payouts. Please complete account verification.",
        );
      }

      // Use the advertiser's currency for the transfer
      // This ensures we transfer in the same currency as the campaign/advertiser
      const transferCurrencyLower = transferCurrency.toLowerCase();

      this.logger.log(
        `Using ${transferCurrency} for Stripe transfer as per advertiser/campaign currency. Promoter currency: ${promoter.usedCurrency || 'USD'}`,
      );

      // Create Stripe transfer in advertiser's currency
      const transfer = await this.stripe.transfers.create({
        amount: amountCents,
        currency: transferCurrencyLower,
        destination: stripeConnectAccount.stripeAccountId,
        transfer_group: `campaign_${campaignId}`,
        description: description,
        metadata: {
          promoterId: promoter.id,
          promoterName: promoter.name,
          paymentType: 'campaign_work_payment',
          platformUserId: promoter.id,
          transferAmount: amountCents,
          transferCurrency: transferCurrency,
          promoterCurrency: promoter.usedCurrency || 'USD',
        },
      });

      this.logger.log(
        `Stripe Connect transfer successful: ${transfer.id} - ${amountCents / 100} ${transferCurrency} transferred to promoter ${promoter.name}`,
      );

      return {
        transferId: transfer.id,
        status: 'completed',
      };
    } catch (error) {
      this.logger.error(
        `Stripe Connect transfer failed for promoter ${promoter.id}:`,
        error,
      );

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
   * Calculate total earnings for a promoter in a specific campaign from transactions
   */
  private async calculatePromoterCampaignEarnings(
    promoterId: string,
    campaignId: string,
  ): Promise<number> {
    const result: { total: string } | undefined = await this.transactionRepo
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.campaignId = :campaignId', { campaignId })
      .andWhere('transaction.userType = :userType', {
        userType: UserType.PROMOTER,
      })
      .andWhere('transaction.amount > 0') // Only positive amounts (earnings)
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .getRawOne();

    return Number(result?.total || 0);
  }

  /**
   * Calculate total spent budget for a promoter in a specific campaign from transactions
   */
  private async calculatePromoterCampaignSpentBudget(
    promoterId: string,
    campaignId: string,
  ): Promise<number> {
    const result: { total: string } | undefined = await this.transactionRepo
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(ABS(transaction.grossAmountCents)), 0)', 'total')
      .where('transaction.userId = :promoterId', { promoterId })
      .andWhere('transaction.campaignId = :campaignId', { campaignId })
      .andWhere('transaction.userType = :userType', {
        userType: UserType.PROMOTER,
      })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .getRawOne();

    return Number(result?.total || 0) / 100; // Convert cents to dollars
  }

  /**
   * Get comprehensive financial data for a promoter campaign based on transactions
   */
  async getPromoterCampaignFinancials(
    promoterId: string,
    campaignId: string,
  ): Promise<{
    totalEarnings: number;
    totalSpentBudget: number;
    transactionCount: number;
    lastPaymentDate: Date | null;
  }> {
    const earnings = await this.calculatePromoterCampaignEarnings(
      promoterId,
      campaignId,
    );

    const spentBudget = await this.calculatePromoterCampaignSpentBudget(
      promoterId,
      campaignId,
    );

    // Get additional stats
    const stats: { count: string; lastPayment: Date | null } | undefined =
      await this.transactionRepo
        .createQueryBuilder('transaction')
        .select('COUNT(*)', 'count')
        .addSelect('MAX(transaction.processedAt)', 'lastPayment')
        .where('transaction.userId = :promoterId', { promoterId })
        .andWhere('transaction.campaignId = :campaignId', { campaignId })
        .andWhere('transaction.userType = :userType', {
          userType: UserType.PROMOTER,
        })
        .andWhere('transaction.status = :status', {
          status: TransactionStatus.COMPLETED,
        })
        .getRawOne();

    return {
      totalEarnings: earnings,
      totalSpentBudget: spentBudget,
      transactionCount: Number(stats?.count || 0),
      lastPaymentDate: stats?.lastPayment || null,
    };
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
}
