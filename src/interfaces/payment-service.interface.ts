/**
 * Payment Service Interface - Simplified Schema
 * Uses new minimal schema: PaymentRecord, Transaction, Wallet
 */

import { UserType } from 'src/enums/user-type';
import { PaymentRecord } from '../database/entities/payment-record.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';

export const PAYMENT_CONSTANTS = {
  MINIMUM_PAYOUT_THRESHOLD: 2000, // $20.00 in cents
  PLATFORM_FEE_PERCENTAGE: 10, // 10% platform fee
  STRIPE_FEE_PERCENTAGE: 2.9, // 2.9% + 30¢ Stripe fee
} as const;

export interface PaymentServiceInterface {
  // Payment Records Management
  createPaymentRecord(
    userId: string,
    amount: number,
    method: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentRecord>;

  getPaymentRecord(id: string): Promise<PaymentRecord | null>;

  getPaymentHistory(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<PaymentRecord[]>;

  // Transaction Management
  createTransaction(
    fromWalletId: string | null,
    toWalletId: string | null,
    amount: number,
    type: string,
    description?: string,
    campaignId?: string,
    paymentRecordId?: string,
  ): Promise<Transaction>;

  getTransaction(id: string): Promise<Transaction | null>;

  getTransactionHistory(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Transaction[]>;

  // Wallet Management
  createWallet(userId: string, type: string): Promise<Wallet>;

  getWallet(userId: string, type: string): Promise<Wallet | null>;

  getWalletBalance(userId: string, type: string): Promise<number>;

  updateWalletBalance(
    userId: string,
    type: string,
    amount: number,
    operation: 'add' | 'subtract',
  ): Promise<Wallet>;

  // Financial Reporting
  calculateMonthlyEarnings(
    promoterId: string,
    year: number,
    month: number,
  ): Promise<{
    totalEarnings: number;
    earningsByType: Record<string, number>;
    transactionCount: number;
  }>;

  calculateMonthlySpend(
    advertiserId: string,
    year: number,
    month: number,
  ): Promise<{
    totalSpent: number;
    spendByType: Record<string, number>;
    transactionCount: number;
  }>;

  // Payout Processing
  processPayouts(minimumThreshold?: number): Promise<Transaction[]>;

  getPendingPayouts(userId: string): Promise<number>;

  // Dashboard Data
  getPaymentDashboard(
    userId: string,
    userType: UserType,
  ): Promise<{
    currentBalance: number;
    pendingPayouts: number;
    totalEarningsThisMonth: number;
    totalSpentThisMonth: number;
    recentTransactions: Transaction[];
    recentPayments: PaymentRecord[];
  }>;

  // Stripe Integration
  validateStripeAccount(userId: string): Promise<boolean>;

  createStripeConnectAccount(userId: string): Promise<string>;

  getStripeAccountStatus(
    userId: string,
  ): Promise<'pending' | 'active' | 'rejected'>;
}
