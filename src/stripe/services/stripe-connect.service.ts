import { Injectable, Inject, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.module';
import { StripeConnectAccount, StripeAccountStatus, CapabilityStatus } from '../../database/entities/stripe-connect-account.entity';
import { BusinessProfile } from '../../database/entities/business-profile.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { stripeConfig } from '../../config/stripe.config';

export interface CreateConnectedAccountDto {
  userId: string;
  email: string;
  country: string; // 'US' or 'CA'
  isBusiness: boolean;
  businessName?: string;
  firstName?: string;
  lastName?: string;
}

export interface OnboardingLinkResponse {
  url: string;
  expiresAt: Date;
}

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly config = stripeConfig();

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @InjectRepository(StripeConnectAccount)
    private readonly stripeAccountRepo: Repository<StripeConnectAccount>,
    @InjectRepository(BusinessProfile)
    private readonly businessProfileRepo: Repository<BusinessProfile>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Create a new Stripe Connect account for a promoter
   */
  async createConnectedAccount(dto: CreateConnectedAccountDto): Promise<StripeConnectAccount> {
    try {
      // Check if user already has a connected account
      const existingAccount = await this.stripeAccountRepo.findOne({
        where: { userId: dto.userId },
      });

      if (existingAccount) {
        throw new BadRequestException('User already has a connected account');
      }

      // Verify user exists
      const user = await this.userRepo.findOne({ where: { id: dto.userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Create Stripe Connect account
      const accountParams: Stripe.AccountCreateParams = {
        type: 'express',
        country: dto.country,
        email: dto.email,
        business_type: dto.isBusiness ? 'company' : 'individual',
      };

      // Add business or individual specific data
      if (dto.isBusiness && dto.businessName) {
        accountParams.company = {
          name: dto.businessName,
        };
      } else if (!dto.isBusiness && dto.firstName && dto.lastName) {
        accountParams.individual = {
          first_name: dto.firstName,
          last_name: dto.lastName,
        };
      }

      const stripeAccount = await this.stripe.accounts.create(accountParams);

      // Save to database
      const connectAccount = this.stripeAccountRepo.create({
        userId: dto.userId,
        stripeAccountId: stripeAccount.id,
        country: dto.country,
        defaultCurrency: this.config.currency,
        status: StripeAccountStatus.PENDING,
        accountType: 'express',
        businessType: dto.isBusiness ? 'company' : 'individual',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });

      const savedAccount = await this.stripeAccountRepo.save(connectAccount);

      this.logger.log(`Created Stripe Connect account ${stripeAccount.id} for user ${dto.userId}`);

      return savedAccount;
    } catch (error) {
      this.logger.error(`Failed to create connected account for user ${dto.userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create connected account');
    }
  }

  /**
   * Generate onboarding link for account setup
   */
  async createOnboardingLink(userId: string): Promise<OnboardingLinkResponse> {
    try {
      const account = await this.stripeAccountRepo.findOne({
        where: { userId },
      });

      if (!account) {
        throw new BadRequestException('No connected account found for user');
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: account.stripeAccountId,
        refresh_url: this.config.refreshUrl,
        return_url: this.config.returnUrl,
        type: 'account_onboarding',
      });

      // Update account with onboarding link info
      await this.stripeAccountRepo.update(account.id, {
        onboardingLink: accountLink.url,
        onboardingExpiresAt: new Date(accountLink.expires_at * 1000),
        lastOnboardingAttempt: new Date(),
      });

      return {
        url: accountLink.url,
        expiresAt: new Date(accountLink.expires_at * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to create onboarding link for user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to create onboarding link');
    }
  }

  /**
   * Refresh onboarding link if expired or needed
   */
  async refreshOnboardingLink(userId: string): Promise<OnboardingLinkResponse> {
    return this.createOnboardingLink(userId);
  }

  /**
   * Get account status and requirements
   */
  async getAccountStatus(userId: string): Promise<StripeConnectAccount | null> {
    const account = await this.stripeAccountRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!account) {
      return null;
    }

    // Sync with Stripe for latest status
    await this.syncAccountStatus(account.stripeAccountId);

    // Return updated account
    return this.stripeAccountRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  /**
   * Sync account status with Stripe
   */
  async syncAccountStatus(stripeAccountId: string): Promise<void> {
    try {
      const stripeAccount = await this.stripe.accounts.retrieve(stripeAccountId);
      
      const updateData: Partial<StripeConnectAccount> = {
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        detailsSubmitted: stripeAccount.details_submitted,
        currentlyDue: stripeAccount.requirements?.currently_due || [],
        eventuallyDue: stripeAccount.requirements?.eventually_due || [],
        pastDue: stripeAccount.requirements?.past_due || [],
        pendingVerification: stripeAccount.requirements?.pending_verification || [],
      };

      // Determine overall status
      if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
        updateData.status = StripeAccountStatus.ACTIVE;
      } else if (stripeAccount.requirements?.currently_due && stripeAccount.requirements.currently_due.length > 0) {
        updateData.status = StripeAccountStatus.RESTRICTED;
      } else {
        updateData.status = StripeAccountStatus.PENDING;
      }

      // Update capabilities
      const capabilities = stripeAccount.capabilities;
      if (capabilities) {
        updateData.cardPaymentsCapability = capabilities.card_payments as any;
        updateData.transfersCapability = capabilities.transfers as any;
      }

      await this.stripeAccountRepo.update(
        { stripeAccountId },
        updateData,
      );

      this.logger.log(`Synced account status for ${stripeAccountId}`);
    } catch (error) {
      this.logger.error(`Failed to sync account status for ${stripeAccountId}:`, error);
      throw error;
    }
  }

  /**
   * Create business profile for business accounts
   */
  async createBusinessProfile(userId: string, businessData: Partial<BusinessProfile>): Promise<BusinessProfile> {
    try {
      // Check if business profile already exists
      const existingProfile = await this.businessProfileRepo.findOne({
        where: { userId },
      });

      if (existingProfile) {
        throw new BadRequestException('Business profile already exists');
      }

      const businessProfile = this.businessProfileRepo.create({
        userId,
        ...businessData,
        verificationStatus: 'pending',
      });

      return await this.businessProfileRepo.save(businessProfile);
    } catch (error) {
      this.logger.error(`Failed to create business profile for user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to create business profile');
    }
  }

  /**
   * Check if account is ready for payments
   */
  async isAccountReady(userId: string): Promise<boolean> {
    const account = await this.stripeAccountRepo.findOne({
      where: { userId },
    });

    return Boolean(account?.chargesEnabled && account?.payoutsEnabled);
  }

  /**
   * Get account by user ID
   */
  async getAccountByUserId(userId: string): Promise<StripeConnectAccount | null> {
    return this.stripeAccountRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  /**
   * Get account by Stripe account ID
   */
  async getAccountByStripeId(stripeAccountId: string): Promise<StripeConnectAccount | null> {
    return this.stripeAccountRepo.findOne({
      where: { stripeAccountId },
      relations: ['user'],
    });
  }
}
