import { Injectable, Logger } from '@nestjs/common';

import { PaymentService } from '../interfaces/payment-service.interface';
import {
  PayoutRecord,
  AdvertiserCharge,
  PromoterBalance,
  AdvertiserSpend,
  MonthlyPromoterEarnings,
  MonthlyAdvertiserSpend,
  PaymentDashboard,
} from '../interfaces/payment';
import { Campaign } from '../interfaces/campaign';
import { CampaignType } from '../enums/campaign-type';

// Import modular services
import { PaymentProcessingService } from './payment-processing.service';
import { AccountingService } from './accounting.service';
import { StripeIntegrationService } from './stripe-integration.service';

/**
 * Main PaymentService that orchestrates the modular payment services
 * This service acts as a facade pattern, delegating to specialized services
 */
@Injectable()
export class PaymentServiceImpl implements PaymentService {
  private readonly logger = new Logger(PaymentServiceImpl.name);

  constructor(
    private readonly paymentProcessingService: PaymentProcessingService,
    private readonly accountingService: AccountingService,
    private readonly stripeService: StripeIntegrationService,
  ) {}

  // Campaign Payment Processing - delegated to PaymentProcessingService
  async chargeCampaignBudget(
    campaign: Campaign,
    paymentMethodId: string,
  ): Promise<AdvertiserCharge> {
    return this.paymentProcessingService.chargeCampaignBudget(
      campaign,
      paymentMethodId,
    );
  }

  async executePromoterPayout(
    campaignId: string,
    finalAmount?: number,
  ): Promise<PayoutRecord> {
    return this.paymentProcessingService.executePromoterPayout(
      campaignId,
      finalAmount,
    );
  }

  async refundCampaignBudget(
    campaignId: string,
    amount?: number,
  ): Promise<AdvertiserCharge> {
    return this.paymentProcessingService.refundCampaignBudget(
      campaignId,
      amount,
    );
  }

  // Payment History - delegated to PaymentProcessingService
  async getPayoutHistory(
    promoterId: string,
    limit: number = 50,
  ): Promise<PayoutRecord[]> {
    return this.paymentProcessingService.getPayoutHistory(promoterId, limit);
  }

  async getChargeHistory(
    advertiserId: string,
    limit: number = 50,
  ): Promise<AdvertiserCharge[]> {
    return this.paymentProcessingService.getChargeHistory(advertiserId, limit);
  }

  // Accounting and Balance Management - delegated to AccountingService
  async calculateMonthlyPromoterEarnings(
    promoterId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MonthlyPromoterEarnings> {
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    return this.accountingService.calculateMonthlyPromoterEarnings(
      promoterId,
      year,
      month,
    );
  }

  async calculateMonthlyAdvertiserSpend(
    advertiserId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MonthlyAdvertiserSpend> {
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    return this.accountingService.calculateMonthlyAdvertiserSpend(
      advertiserId,
      year,
      month,
    );
  }

  async processMonthlyPayouts(
    minimumThreshold?: number,
  ): Promise<PayoutRecord[]> {
    const processedPayouts =
      await this.accountingService.processMonthlyPayouts(minimumThreshold);
    // Convert entities to interfaces
    return processedPayouts.map((entity) => ({
      id: entity.id,
      promoterId: entity.promoterId,
      campaignId: entity.campaignId,
      amount: entity.amount,
      status: entity.status as any,
      stripeTransferId: entity.stripeTransferId,
      description: entity.description,
      payoutDate: entity.processedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));
  }

  async getPromoterBalance(
    promoterId: string,
  ): Promise<PromoterBalance | null> {
    return this.accountingService.getPromoterBalance(promoterId);
  }

  async getAdvertiserSpend(
    advertiserId: string,
  ): Promise<AdvertiserSpend | null> {
    return this.accountingService.getAdvertiserSpend(advertiserId);
  }

  async updatePromoterBalance(
    promoterId: string,
    campaignType: CampaignType,
    amount: number,
  ): Promise<void> {
    return this.accountingService.updatePromoterBalance(
      promoterId,
      campaignType,
      amount,
    );
  }

  async getPaymentDashboard(
    userId: string,
    userType: 'PROMOTER' | 'ADVERTISER',
  ): Promise<PaymentDashboard> {
    return this.accountingService.getPaymentDashboard(userId, userType);
  }

  // Stripe Integration - delegated to StripeIntegrationService
  async validateStripeAccount(userId: string): Promise<boolean> {
    return this.stripeService.validateStripeAccount(userId);
  }

  async createStripeConnectAccount(userId: string): Promise<string> {
    return this.stripeService.createStripeConnectAccount(userId);
  }

  async getStripeAccountStatus(
    userId: string,
  ): Promise<'pending' | 'active' | 'rejected'> {
    return this.stripeService.getStripeAccountStatus(userId);
  }
}
