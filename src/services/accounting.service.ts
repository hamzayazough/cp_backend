import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { PAYMENT_CONSTANTS } from '../interfaces/payment-service.interface';
import {
  PromoterBalance,
  AdvertiserSpend,
  MonthlyPromoterEarnings,
  MonthlyAdvertiserSpend,
  PaymentDashboard,
  PayoutStatus,
  ChargeStatus,
} from '../interfaces/payment';
import { CampaignType } from '../enums/campaign-type';

// Entities
import { PayoutRecord as PayoutRecordEntity } from '../database/entities/payout-record.entity';
import { AdvertiserCharge as AdvertiserChargeEntity } from '../database/entities/advertiser-charge.entity';
import { PromoterBalance as PromoterBalanceEntity } from '../database/entities/promoter-balance.entity';
import { AdvertiserSpend as AdvertiserSpendEntity } from '../database/entities/advertiser-spend.entity';

/**
 * Service responsible for accounting, balance tracking, and financial reporting
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(PayoutRecordEntity)
    private readonly payoutRepository: Repository<PayoutRecordEntity>,
    @InjectRepository(AdvertiserChargeEntity)
    private readonly chargeRepository: Repository<AdvertiserChargeEntity>,
    @InjectRepository(PromoterBalanceEntity)
    private readonly promoterBalanceRepository: Repository<PromoterBalanceEntity>,
    @InjectRepository(AdvertiserSpendEntity)
    private readonly advertiserSpendRepository: Repository<AdvertiserSpendEntity>,
  ) {}

  /**
   * Calculate monthly earnings for a specific promoter
   */
  async calculateMonthlyPromoterEarnings(
    promoterId: string,
    year: number,
    month: number,
  ): Promise<MonthlyPromoterEarnings> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const payouts = await this.payoutRepository.find({
        where: {
          promoterId,
          processedAt: Between(startDate, endDate),
          status: PayoutStatus.COMPLETED,
        },
        relations: ['campaign'],
      });

      const earnings: MonthlyPromoterEarnings = {
        promoterId,
        promoterName: '', // Will be filled later
        periodStart: startDate,
        periodEnd: endDate,
        earningsByType: {
          visibility: 0,
          consultant: 0,
          seller: 0,
          salesman: 0,
        },
        totalEarnings: 0,
        paidOut: false,
        payoutDate: undefined,
      };

      for (const payout of payouts) {
        earnings.totalEarnings += payout.amount;

        // Categorize by campaign type
        const campaignType = payout.campaign?.type as CampaignType;
        switch (campaignType) {
          case CampaignType.VISIBILITY:
            earnings.earningsByType.visibility += payout.amount;
            break;
          case CampaignType.CONSULTANT:
            earnings.earningsByType.consultant += payout.amount;
            break;
          case CampaignType.SELLER:
            earnings.earningsByType.seller += payout.amount;
            break;
          case CampaignType.SALESMAN:
            earnings.earningsByType.salesman += payout.amount;
            break;
        }
      }

      return earnings;
    } catch (error) {
      this.logger.error(
        `Failed to calculate monthly promoter earnings: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate monthly earnings',
      );
    }
  }

  /**
   * Calculate monthly spend for a specific advertiser
   */
  async calculateMonthlyAdvertiserSpend(
    advertiserId: string,
    year: number,
    month: number,
  ): Promise<MonthlyAdvertiserSpend> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const charges = await this.chargeRepository.find({
        where: {
          advertiserId,
          createdAt: Between(startDate, endDate),
          status: ChargeStatus.SUCCEEDED,
        },
        relations: ['campaign'],
      });

      const spend: MonthlyAdvertiserSpend = {
        advertiserId,
        advertiserName: '', // Will be filled later
        periodStart: startDate,
        periodEnd: endDate,
        campaignsFunded: 0,
        totalSpent: 0,
        totalCharged: 0,
        remainingBalance: 0,
      };

      for (const charge of charges) {
        spend.totalCharged += charge.amount;
        spend.campaignsFunded += 1;
      }

      return spend;
    } catch (error) {
      this.logger.error(
        `Failed to calculate monthly advertiser spend: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate monthly spend',
      );
    }
  }

  /**
   * Process monthly payouts for all promoters above threshold
   */
  async processMonthlyPayouts(
    minimumThreshold: number = PAYMENT_CONSTANTS.MINIMUM_PAYOUT_THRESHOLD,
  ): Promise<PayoutRecordEntity[]> {
    this.logger.log(
      `Processing monthly payouts with threshold $${minimumThreshold / 100}`,
    );

    try {
      // Find all promoter balances above threshold
      const promoterBalances = await this.promoterBalanceRepository
        .createQueryBuilder('balance')
        .where('balance.totalEarnings >= :threshold', {
          threshold: minimumThreshold,
        })
        .andWhere('balance.paidOut = :paidOut', { paidOut: false })
        .getMany();

      const processedPayouts: PayoutRecordEntity[] = [];

      for (const balance of promoterBalances) {
        try {
          // Create monthly payout record
          const payoutEntity = this.payoutRepository.create({
            promoterId: balance.promoterId,
            amount: balance.totalEarnings,
            status: PayoutStatus.PENDING,
            description: `Monthly earnings payout - ${new Date().toISOString().slice(0, 7)}`,
            processedAt: new Date(),
          });

          const savedPayout = await this.payoutRepository.save(payoutEntity);
          processedPayouts.push(savedPayout);

          // Reset promoter balance after payout
          await this.promoterBalanceRepository.update(balance.id, {
            totalEarnings: 0,
            visibilityEarnings: 0,
            consultantEarnings: 0,
            sellerEarnings: 0,
            salesmanEarnings: 0,
            paidOut: true,
            payoutRecordId: savedPayout.id,
          });

          this.logger.log(
            `Created monthly payout of $${balance.totalEarnings / 100} for promoter ${balance.promoterId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process payout for promoter ${balance.promoterId}: ${error.message}`,
          );
          // Continue with other promoters
        }
      }

      this.logger.log(`Processed ${processedPayouts.length} monthly payouts`);
      return processedPayouts;
    } catch (error) {
      this.logger.error(
        `Failed to process monthly payouts: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to process monthly payouts',
      );
    }
  }

  /**
   * Get current promoter balance
   */
  async getPromoterBalance(
    promoterId: string,
  ): Promise<PromoterBalance | null> {
    const balance = await this.promoterBalanceRepository.findOne({
      where: { promoterId },
    });

    return balance ? this.mapPromoterBalanceEntityToInterface(balance) : null;
  }

  /**
   * Get current advertiser spend
   */
  async getAdvertiserSpend(
    advertiserId: string,
  ): Promise<AdvertiserSpend | null> {
    const spend = await this.advertiserSpendRepository.findOne({
      where: { advertiserId },
    });

    return spend ? this.mapAdvertiserSpendEntityToInterface(spend) : null;
  }

  /**
   * Update promoter balance after earnings
   */
  async updatePromoterBalance(
    promoterId: string,
    campaignType: CampaignType,
    amount: number,
  ): Promise<void> {
    try {
      let balance = await this.promoterBalanceRepository.findOne({
        where: {
          promoterId,
          periodStart: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          periodEnd: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
          ),
        },
      });

      if (!balance) {
        // Create new balance record for current month
        const now = new Date();
        balance = this.promoterBalanceRepository.create({
          promoterId,
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          totalEarnings: 0,
          visibilityEarnings: 0,
          consultantEarnings: 0,
          sellerEarnings: 0,
          salesmanEarnings: 0,
          paidOut: false,
        });
      }

      // Update total earnings
      balance.totalEarnings += amount;

      // Update category-specific earnings
      switch (campaignType) {
        case CampaignType.VISIBILITY:
          balance.visibilityEarnings += amount;
          break;
        case CampaignType.CONSULTANT:
          balance.consultantEarnings += amount;
          break;
        case CampaignType.SELLER:
          balance.sellerEarnings += amount;
          break;
        case CampaignType.SALESMAN:
          balance.salesmanEarnings += amount;
          break;
      }

      await this.promoterBalanceRepository.save(balance);
      this.logger.log(
        `Updated promoter ${promoterId} balance by $${amount / 100} for ${campaignType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update promoter balance: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update promoter balance',
      );
    }
  }

  /**
   * Update advertiser spend after charges
   */
  async updateAdvertiserSpend(
    advertiserId: string,
    campaignType: CampaignType,
    amount: number,
  ): Promise<void> {
    try {
      let spend = await this.advertiserSpendRepository.findOne({
        where: {
          advertiserId,
          periodStart: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          periodEnd: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
          ),
        },
      });

      if (!spend) {
        // Create new spend record for current month
        const now = new Date();
        spend = this.advertiserSpendRepository.create({
          advertiserId,
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          campaignsFunded: 0,
          totalSpent: 0,
          totalCharged: 0,
          remainingBalance: 0,
        });
      }

      // Update spend tracking
      spend.totalCharged += amount;
      spend.campaignsFunded += 1;

      await this.advertiserSpendRepository.save(spend);
      this.logger.log(
        `Updated advertiser ${advertiserId} spend by $${amount / 100} for ${campaignType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update advertiser spend: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update advertiser spend',
      );
    }
  }

  /**
   * Get payment dashboard for user
   */
  async getPaymentDashboard(
    userId: string,
    userType: 'PROMOTER' | 'ADVERTISER',
  ): Promise<PaymentDashboard> {
    try {
      if (userType === 'PROMOTER') {
        const balance = await this.getPromoterBalance(userId);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const monthlyEarnings = await this.calculateMonthlyPromoterEarnings(
          userId,
          currentYear,
          currentMonth,
        );

        return {
          currentBalance: balance?.totalEarnings || 0,
          pendingPayouts: balance?.totalEarnings || 0,
          totalEarningsThisMonth: monthlyEarnings.totalEarnings,
          totalEarningsLastMonth: 0, // Would need last month calculation
          nextPayoutDate: undefined,
          recentPayouts: [], // Would need to fetch recent payouts
          totalSpentThisMonth: 0, // Not applicable for promoters
          totalSpentLastMonth: 0, // Not applicable for promoters
          activeCampaignsBudget: 0, // Not applicable for promoters
          prepaidBalance: 0, // Not applicable for promoters
          recentCharges: [], // Not applicable for promoters
        };
      } else {
        const spend = await this.getAdvertiserSpend(userId);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const monthlySpend = await this.calculateMonthlyAdvertiserSpend(
          userId,
          currentYear,
          currentMonth,
        );

        return {
          currentBalance: 0, // Not applicable for advertisers
          pendingPayouts: 0, // Not applicable for advertisers
          totalEarningsThisMonth: 0, // Not applicable for advertisers
          totalEarningsLastMonth: 0, // Not applicable for advertisers
          nextPayoutDate: undefined, // Not applicable for advertisers
          recentPayouts: [], // Not applicable for advertisers
          totalSpentThisMonth: monthlySpend.totalCharged,
          totalSpentLastMonth: 0, // Would need last month calculation
          activeCampaignsBudget: 0, // Would need calculation
          prepaidBalance: spend?.remainingBalance || 0,
          recentCharges: [], // Would need to fetch recent charges
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get payment dashboard: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get payment dashboard');
    }
  }

  // Entity to interface mapping methods
  private mapPromoterBalanceEntityToInterface = (
    entity: PromoterBalanceEntity,
  ): PromoterBalance => ({
    id: entity.id,
    promoterId: entity.promoterId,
    periodStart: entity.periodStart,
    periodEnd: entity.periodEnd,
    totalEarnings: entity.totalEarnings,
    visibilityEarnings: entity.visibilityEarnings,
    consultantEarnings: entity.consultantEarnings,
    sellerEarnings: entity.sellerEarnings,
    salesmanEarnings: entity.salesmanEarnings,
    paidOut: entity.paidOut,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });

  private mapAdvertiserSpendEntityToInterface = (
    entity: AdvertiserSpendEntity,
  ): AdvertiserSpend => ({
    id: entity.id,
    advertiserId: entity.advertiserId,
    periodStart: entity.periodStart,
    periodEnd: entity.periodEnd,
    campaignsFunded: entity.campaignsFunded,
    totalSpent: entity.totalSpent,
    totalCharged: entity.totalCharged,
    remainingBalance: entity.remainingBalance,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}
