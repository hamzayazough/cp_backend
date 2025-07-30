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

    // 6. Calculate platform fee (20%) and net payment
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

    // 8. Create transaction record for advertiser (deduction)
    const advertiserTransaction = this.transactionRepo.create({
      userId: user.id,
      userType: UserType.ADVERTISER,
      campaignId: dto.campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: -amountDollars,
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.COMPLETED,
      description: `Payment to promoter ${promoter.name} for campaign ${campaign.title}`,
      paymentMethod: TxnPaymentMethod.WALLET,
    });

    const savedAdvertiserTransaction = await this.transactionRepo.save(
      advertiserTransaction,
    );

    // 9. Create transaction record for promoter (earning)
    const promoterTransaction = this.transactionRepo.create({
      userId: dto.promoterId,
      userType: UserType.PROMOTER,
      campaignId: dto.campaignId,
      type: TransactionType.DIRECT_PAYMENT,
      amount: netPaymentDollars,
      grossAmountCents: dto.amount,
      platformFeeCents: platformFeeCents,
      status: TransactionStatus.PENDING,
      description: `Payment from advertiser ${user.name} for campaign ${campaign.title}`,
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

    promoterWallet.currentBalance += netPaymentDollars;
    promoterWallet.totalEarned =
      (promoterWallet.totalEarned || 0) + netPaymentDollars;
    await this.walletRepo.save(promoterWallet);

    // 12. Update campaign budget tracking
    budgetTracking.spentBudgetCents += dto.amount;
    budgetTracking.platformFeesCollectedCents += platformFeeCents;
    const temp = await this.budgetTrackingRepo.save(budgetTracking);
    console.log('temp: ', temp);
    // 13. Update promoter campaign record (keep only essential fields)
    // Note: earnings and spentBudget are now calculated from transactions
    await this.promoterCampaignRepo.save(promoterCampaign);

    // 14. Calculate total amount paid to this promoter for this campaign from transactions
    const totalPaidToPromoter = await this.calculatePromoterCampaignEarnings(
      dto.promoterId,
      dto.campaignId,
    );

    const newBudgetAllocated = Math.round(totalPaidToPromoter * 100); // Convert to cents

    // 15. Process actual Stripe payment to promoter
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
      const errorMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error';
      this.logger.error(
        `Stripe transfer failed for promoter ${dto.promoterId}: ${errorMessage}`,
      );

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
   * Add test funds to platform Stripe account balance (TEST MODE ONLY)
   */
  async addTestFundsToPlatform(amountCents: number) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Test funds can only be added in test mode',
      );
    }

    try {
      console.log(`Adding ${amountCents} cents to platform test balance...`);

      const topup = await this.stripe.topups.create({
        amount: amountCents,
        currency: 'usd',
        description: 'Test funds for Connect transfers',
        statement_descriptor: 'Test funds',
      });

      console.log('Topup created:', topup.id, 'Status:', topup.status);

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
