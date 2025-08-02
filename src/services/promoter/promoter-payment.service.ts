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
  ) {}

  /**
   * Pay a promoter for their work on a campaign
   */
  async payPromoter(
    firebaseUid: string,
    dto: PayPromoterDto,
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
        status: PromoterCampaignStatus.ONGOING,
      },
    });

    if (!promoterCampaign) {
      throw new NotFoundException(
        'Promoter is not actively working on this campaign',
      );
    }

    // 4. Get campaign budget tracking
    let budgetTracking = await this.budgetTrackingRepo.findOne({
      where: {
        campaignId: dto.campaignId,
        advertiserId: campaign.advertiserId,
      },
    });

    if (!budgetTracking) {
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

    // 6. Calculate platform fee (20%) and net payment with currency conversion
    const platformFeeCents = Math.round(dto.amount * 0.2);
    const netPaymentCents = dto.amount - platformFeeCents;
    const netPaymentDollars = netPaymentCents / 100;

    // 7. Get promoter user
    const promoter = await this.userRepo.findOne({
      where: { id: dto.promoterId },
    });
    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    // 8. Convert payment amount to promoter's currency if different
    const advertiserCurrency = user.usedCurrency || 'USD';
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
    if (!dto.transactionType) {
      dto.transactionType = TransactionType.DIRECT_PAYMENT;
    }

    // 8. Create transaction record for advertiser (deduction)
    const advertiserTransaction = this.transactionRepo.create({
      userId: user.id,
      userType: UserType.ADVERTISER,
      campaignId: dto.campaignId,
      type: dto.transactionType,
      amount: -amountDollars, // Always in advertiser's currency
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.COMPLETED,
      description: `Payment to promoter ${promoter.name} for campaign ${campaign.title}`,
      paymentMethod: TxnPaymentMethod.WALLET,
    });

    const savedAdvertiserTransaction = await this.transactionRepo.save(
      advertiserTransaction,
    );

    // 9. Create transaction record for promoter (earning) - in promoter's currency
    const promoterTransaction = this.transactionRepo.create({
      userId: dto.promoterId,
      userType: UserType.PROMOTER,
      campaignId: dto.campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: convertedNetPaymentDollars, // In promoter's currency
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.COMPLETED,
      description: `Payment from advertiser ${user.name} for campaign ${campaign.title}${
        advertiserCurrency !== promoterCurrency
          ? ` (converted from ${netPaymentDollars} ${advertiserCurrency})`
          : ''
      }`,
      paymentMethod: TxnPaymentMethod.BANK_TRANSFER,
    });

    const savedPromoterTransaction =
      await this.transactionRepo.save(promoterTransaction);

    // 10. Update advertiser wallet
    advertiserWallet.currentBalance -= amountDollars;
    advertiserWallet.heldForCampaigns =
      (advertiserWallet.heldForCampaigns || 0) - amountDollars;
    await this.walletRepo.save(advertiserWallet);

    // 11. Update promoter wallet
    let promoterWallet = await this.walletRepo.findOne({
      where: { userId: dto.promoterId, userType: UserType.PROMOTER },
    });

    if (!promoterWallet) {
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

    promoterWallet.currentBalance += convertedNetPaymentDollars;
    promoterWallet.totalEarned =
      (promoterWallet.totalEarned || 0) + convertedNetPaymentDollars;
    await this.walletRepo.save(promoterWallet);

    // 12. Update campaign budget tracking
    budgetTracking.spentBudgetCents += dto.amount;
    budgetTracking.platformFeesCollectedCents += platformFeeCents;
    await this.budgetTrackingRepo.save(budgetTracking);

    // 13. Process actual Stripe payment to promoter
    try {
      const stripeTransferResult = await this.processPromoterPayment(
        promoter,
        Math.round(convertedNetPaymentDollars * 100), // Convert to cents in promoter's currency
        `Payment from campaign: ${campaign.title}`,
        dto.campaignId,
      );

      // Update promoter transaction with Stripe transfer info
      savedPromoterTransaction.stripeTransactionId =
        stripeTransferResult.transferId;
      savedPromoterTransaction.status = TransactionStatus.COMPLETED;
      savedPromoterTransaction.processedAt = new Date();
      await this.transactionRepo.save(savedPromoterTransaction);

      // 14. Now calculate and update promoter campaign earnings (after transaction is completed)
      const totalPaidToPromoter = await this.calculatePromoterCampaignEarnings(
        dto.promoterId,
        dto.campaignId,
      );
      console.log('totoal paid to promoter:', totalPaidToPromoter);
      promoterCampaign.earnings = totalPaidToPromoter;
      await this.promoterCampaignRepo.save(promoterCampaign);

      this.logger.log(
        `Stripe transfer successful: ${stripeTransferResult.transferId} for promoter ${dto.promoterId}`,
      );
    } catch (stripeError) {
      const errorMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error';
      this.logger.error(
        `Stripe transfer failed for promoter ${dto.promoterId}: ${errorMessage}`,
      );

      savedPromoterTransaction.description += ` (Stripe transfer failed: ${errorMessage})`;
      await this.transactionRepo.save(savedPromoterTransaction);

      // Don't update promoter campaign earnings if payment failed
    }

    // Calculate final earnings for return value (this will be correct regardless of Stripe success/failure)
    const finalEarnings = await this.calculatePromoterCampaignEarnings(
      dto.promoterId,
      dto.campaignId,
    );
    const newBudgetAllocated = Math.round(finalEarnings * 100); // Convert to cents

    this.logger.log(
      `Promoter payment processed: Advertiser ${user.id} paid $${amountDollars} ${advertiserCurrency} to promoter ${dto.promoterId} for campaign ${dto.campaignId}. ` +
        `Platform fee: $${(platformFeeCents / 100).toFixed(2)} ${advertiserCurrency}, Net to promoter: $${convertedNetPaymentDollars.toFixed(2)} ${promoterCurrency}` +
        (advertiserCurrency !== promoterCurrency
          ? ` (converted from $${netPaymentDollars.toFixed(2)} ${advertiserCurrency})`
          : ''),
    );

    return {
      paymentId: savedAdvertiserTransaction.id,
      newBudgetAllocated: newBudgetAllocated,
    };
  }

  /**
   * Process payment to promoter via Stripe Connect
   */
  async processPromoterPayment(
    promoter: UserEntity,
    amountCents: number,
    description: string,
    campaignId: string,
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

      // Create Stripe transfer
      const transfer = await this.stripe.transfers.create({
        amount: amountCents,
        currency: promoter.usedCurrency.toLowerCase() || 'usd',
        destination: stripeConnectAccount.stripeAccountId,
        transfer_group: `campaign_${campaignId}`,
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
