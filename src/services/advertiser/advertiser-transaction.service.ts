import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { AdvertiserTransaction } from '../../interfaces/advertiser-dashboard';
import { UserEntity } from 'src/database/entities';
import { getTransactionAmountInUserCurrency } from 'src/helpers/currency.helper';

@Injectable()
export class AdvertiserTransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async getRecentTransactions(
    advertiser: UserEntity,
    limit: number,
  ): Promise<AdvertiserTransaction[]> {
    const advertiserCurrency = advertiser.usedCurrency || 'USD';
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.campaign', 'campaign')
      .leftJoinAndSelect('transaction.promoter', 'promoter')
      .where('campaign.advertiserId = :advertiserId', {
        advertiserId: advertiser.id,
      })
      .orderBy('transaction.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: getTransactionAmountInUserCurrency(
        advertiserCurrency,
        transaction,
      ),
      status: transaction.status as
        | 'COMPLETED'
        | 'PENDING'
        | 'FAILED'
        | 'CANCELLED',
      date: transaction.createdAt.toISOString(),
      campaign: transaction.campaign?.title || 'N/A',
      campaignId: transaction.campaignId || '',
      promoter: transaction.user?.name,
      promoterId: transaction.userId,
      type: this.mapTransactionType(transaction.type),
      paymentMethod: transaction.paymentMethod as
        | 'WALLET'
        | 'CREDIT_CARD'
        | 'BANK_TRANSFER',
      description: transaction.description,
      estimatedDeliveryDate: transaction.estimatedPaymentDate?.toISOString(),
    }));
  }

  private mapTransactionType(
    type: string,
  ):
    | 'CAMPAIGN_PAYMENT'
    | 'PROMOTER_PAYMENT'
    | 'COMMISSION_PAYMENT'
    | 'REFUND'
    | 'WALLET_DEPOSIT' {
    const typeMapping: Record<
      string,
      | 'CAMPAIGN_PAYMENT'
      | 'PROMOTER_PAYMENT'
      | 'COMMISSION_PAYMENT'
      | 'REFUND'
      | 'WALLET_DEPOSIT'
    > = {
      VIEW_EARNING: 'PROMOTER_PAYMENT',
      SALESMAN_COMMISSION: 'COMMISSION_PAYMENT',
      MONTHLY_PAYOUT: 'PROMOTER_PAYMENT',
      DIRECT_PAYMENT: 'CAMPAIGN_PAYMENT',
    };

    return typeMapping[type] || 'CAMPAIGN_PAYMENT';
  }
}
