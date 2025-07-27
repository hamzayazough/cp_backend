import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { AdvertiserWallet } from '../interfaces/advertiser-dashboard';
import { QueryResult } from 'src/types/query-result.types';
import { UserType } from '../enums/user-type';

@Injectable()
export class AdvertiserWalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async getWalletInfo(advertiserId: string): Promise<AdvertiserWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId: advertiserId, userType: UserType.ADVERTISER },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId: advertiserId,
        userType: UserType.ADVERTISER,
        currentBalance: 0,
        pendingBalance: 0,
      });
      await this.walletRepository.save(wallet);
    }

    const totalSpent = await this.calculateTotalSpent(advertiserId);
    const totalDeposited = await this.calculateTotalDeposited(advertiserId);
    const pendingPayments = await this.calculatePendingPayments(advertiserId);

    return {
      balance: {
        currentBalance: wallet.currentBalance,
        pendingCharges: wallet.pendingBalance || 0,
        totalSpent,
        totalDeposited,
        lastDepositDate: wallet.updatedAt?.toISOString(),
        minimumBalance: 100,
      },
      campaignBudgets: {
        totalAllocated: totalDeposited,
        totalUsed: totalSpent,
        pendingPayments,
        lastPaymentDate: wallet.updatedAt?.toISOString(),
      },
      totalLifetimeSpent: totalSpent,
      totalAvailableBalance: wallet.currentBalance - pendingPayments,
    };
  }

  private async calculateTotalSpent(advertiserId: string): Promise<number> {
    const totalSpentResult = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type IN (:...types)', {
        types: ['CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 'DIRECT_PAYMENT'],
      })
      .getRawOne()) as QueryResult;

    return parseFloat(totalSpentResult?.total || '0');
  }

  private async calculateTotalDeposited(advertiserId: string): Promise<number> {
    const totalDepositedResult = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'COMPLETED' })
      .andWhere('transaction.type = :type', { type: 'DIRECT_PAYMENT' })
      .getRawOne()) as QueryResult;

    return parseFloat(totalDepositedResult?.total || '0');
  }

  private async calculatePendingPayments(
    advertiserId: string,
  ): Promise<number> {
    const pendingPaymentsResult = (await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.campaign', 'campaign')
      .select('SUM(transaction.amount)', 'total')
      .where('campaign.advertiserId = :advertiserId', { advertiserId })
      .andWhere('transaction.status = :status', { status: 'PENDING' })
      .getRawOne()) as QueryResult;

    return parseFloat(pendingPaymentsResult?.total || '0');
  }
}
