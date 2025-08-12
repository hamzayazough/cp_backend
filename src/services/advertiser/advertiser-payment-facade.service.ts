import { Injectable } from '@nestjs/common';
import { PaymentMethodService } from '../../stripe/services/payment-method.service';
import { WalletService } from '../wallet.service';
import { CampaignFundingService } from '../campaign/campaign-funding.service';
import { PromoterPaymentService } from '../promoter/promoter-payment.service';
import {
  CompletePaymentSetupDto,
  AddPaymentMethodDto,
  AddFundsDto,
  FundCampaignDto,
  TransactionQueryDto,
  WithdrawFundsDto,
  CheckCampaignFundingDto,
  PayPromoterDto,
} from '../../controllers/advertiser.controller';
import { PaymentRecord } from 'src/database/entities';

/**
 * Responsibilities:
 * - Acts as a facade for payment operations
 * - Delegates to specialized services
 * - Maintains backward compatibility with existing controller
 */
@Injectable()
export class AdvertiserPaymentService {
  constructor(
    private readonly paymentMethodService: PaymentMethodService,
    private readonly walletService: WalletService,
    private readonly campaignFundingService: CampaignFundingService,
    private readonly promoterPaymentService: PromoterPaymentService,
  ) {}

  // === Payment Method Management ===
  async getPaymentSetupStatus(firebaseUid: string) {
    return this.paymentMethodService.getPaymentSetupStatus(firebaseUid);
  }

  async completePaymentSetup(
    firebaseUid: string,
    dto: CompletePaymentSetupDto,
  ) {
    return this.paymentMethodService.completePaymentSetup(firebaseUid, dto);
  }

  async createSetupIntent(firebaseUid: string) {
    return this.paymentMethodService.createSetupIntent(firebaseUid);
  }

  async getPaymentMethods(firebaseUid: string) {
    return this.paymentMethodService.getPaymentMethods(firebaseUid);
  }

  async addPaymentMethod(firebaseUid: string, dto: AddPaymentMethodDto) {
    return this.paymentMethodService.addPaymentMethod(firebaseUid, dto);
  }

  async removePaymentMethod(firebaseUid: string, paymentMethodId: string) {
    return this.paymentMethodService.removePaymentMethod(
      firebaseUid,
      paymentMethodId,
    );
  }

  async setDefaultPaymentMethod(firebaseUid: string, paymentMethodId: string) {
    return this.paymentMethodService.setDefaultPaymentMethod(
      firebaseUid,
      paymentMethodId,
    );
  }

  // === Wallet Management ===
  async getWalletBalance(firebaseUid: string) {
    return this.walletService.getWalletBalance(firebaseUid);
  }

  async addFunds(firebaseUid: string, dto: AddFundsDto) {
    return this.walletService.addFunds(firebaseUid, dto);
  }

  async withdrawFunds(firebaseUid: string, dto: WithdrawFundsDto) {
    return this.walletService.withdrawFunds(firebaseUid, dto);
  }

  async getWithdrawalLimits(firebaseUid: string) {
    return this.walletService.getWithdrawalLimits(firebaseUid);
  }

  async getTransactions(firebaseUid: string, query: TransactionQueryDto) {
    return this.walletService.getTransactions(firebaseUid, query);
  }

  //TODO: maybe remove this method if not needed
  async processSuccessfulDeposit(
    userId: string,
    netAmountCents: number,
    paymentRecord: PaymentRecord,
  ) {
    return this.walletService.processSuccessfulDeposit(
      userId,
      netAmountCents,
      paymentRecord,
    );
  }

  // === Campaign Funding ===
  async fundCampaign(
    firebaseUid: string,
    campaignId: string,
    dto: FundCampaignDto,
  ) {
    return this.campaignFundingService.fundCampaign(
      firebaseUid,
      campaignId,
      dto,
    );
  }

  async getCampaignFundingStatus(firebaseUid: string, campaignId: string) {
    return this.campaignFundingService.getCampaignFundingStatus(
      firebaseUid,
      campaignId,
    );
  }

  async checkCampaignFundingFeasibility(
    firebaseUid: string,
    dto: CheckCampaignFundingDto,
  ) {
    return this.campaignFundingService.checkCampaignFundingFeasibility(
      firebaseUid,
      dto,
    );
  }

  // === Promoter Payments ===
  async payPromoter(firebaseUid: string, dto: PayPromoterDto) {
    return this.promoterPaymentService.payPromoter(firebaseUid, dto);
  }
}
