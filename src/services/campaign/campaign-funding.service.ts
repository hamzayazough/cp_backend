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
import { STRIPE_CLIENT } from 'src/stripe/stripe.constants';
import { UserEntity } from 'src/database/entities';
import { AdvertiserDetailsEntity } from 'src/database/entities/advertiser-details.entity';
import { CampaignEntity } from 'src/database/entities/campaign.entity';
import { CampaignBudgetTracking } from 'src/database/entities/campaign-budget-tracking.entity';
import { PaymentRecord } from 'src/database/entities/payment-record.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod as TxnPaymentMethod,
} from 'src/database/entities/transaction.entity';
import { UserType } from 'src/enums/user-type';
import {
  FundCampaignDto,
  UpdateBudgetDto,
  CheckCampaignFundingDto,
} from 'src/controllers/advertiser.controller';

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

export interface CampaignFundingFeasibility {
  canAfford: boolean;
  currentAvailableBalance: number;
  estimatedBudget: number;
  shortfallAmount: number;
  recommendedDeposit: number;
  walletSummary?: {
    totalBalance: number;
    heldForExistingCampaigns: number;
    pendingTransactions: number;
  };
}

/**
 * Service responsible for campaign funding operations
 * Handles funding campaigns from wallet or direct payment, budget management
 */
@Injectable()
export class CampaignFundingService {
  private readonly logger = new Logger(CampaignFundingService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepo: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignBudgetTracking)
    private readonly budgetTrackingRepo: Repository<CampaignBudgetTracking>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepo: Repository<PaymentRecord>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

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

  /**
   * Check if advertiser has sufficient funds for a new campaign
   */
  async checkCampaignFundingFeasibility(
    firebaseUid: string,
    dto: CheckCampaignFundingDto,
  ): Promise<CampaignFundingFeasibility> {
    const user = await this.findUserByFirebaseUid(firebaseUid);

    // Get wallet entity for held_for_campaigns amount
    const wallet = await this.walletRepo.findOne({
      where: { userId: user.id, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      return {
        canAfford: false,
        currentAvailableBalance: 0,
        estimatedBudget: dto.estimatedBudgetCents / 100,
        shortfallAmount: dto.estimatedBudgetCents / 100,
        recommendedDeposit: this.calculateRecommendedDeposit(
          dto.estimatedBudgetCents / 100,
        ),
      };
    }

    // Calculate available balance for new campaigns
    const availableForNewCampaigns = Math.max(
      0,
      wallet.currentBalance - (wallet.heldForCampaigns || 0),
    );

    const estimatedBudgetDollars = dto.estimatedBudgetCents / 100;
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
        totalBalance: wallet.currentBalance,
        heldForExistingCampaigns: Number(
          (wallet.heldForCampaigns || 0).toFixed(2),
        ),
        pendingTransactions: 0, // This would need to be calculated separately
      },
    };
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

    const wallet = await this.walletRepo.findOne({
      where: { userId, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    const amountDollars = amount / 100;

    if (wallet.currentBalance < amountDollars) {
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

    // Update wallet balance
    wallet.currentBalance -= amountDollars;
    wallet.heldForCampaigns = (wallet.heldForCampaigns || 0) + amountDollars;
    await this.walletRepo.save(wallet);

    return {};
  }

  private async fundDirectly(
    user: UserEntity,
    campaignId: string,
    amount: number,
    paymentMethodId: string,
  ): Promise<FundingResult> {
    const advertiserDetails = await this.findAdvertiserDetails(user.id);
    const transferGroup = `campaign_${campaignId}`;

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: user.usedCurrency.toLowerCase(),
      customer: advertiserDetails.stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      transfer_group: transferGroup,
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
      currency: user.usedCurrency,
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

  /**
   * Calculate recommended deposit amount including a buffer and accounting for Stripe fees
   */
  private calculateRecommendedDeposit(shortfallAmount: number): number {
    // Add 20% buffer to the shortfall
    const amountWithBuffer = shortfallAmount * 1.2;

    // Calculate gross amount needed to get the net amount after Stripe fees
    const grossAmountCents = this.calculateTotalAmountForNetDeposit(
      amountWithBuffer * 100,
    );

    return Number((grossAmountCents / 100).toFixed(2));
  }

  /**
   * Calculate total amount needed to be charged to get a specific net deposit amount
   */
  private calculateTotalAmountForNetDeposit(netAmountCents: number): number {
    // Formula: grossAmount = (netAmount + 30) / (1 - 0.029)
    return Math.round((netAmountCents + 30) / (1 - 0.029));
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
