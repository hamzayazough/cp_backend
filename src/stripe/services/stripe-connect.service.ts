import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe.constants';
import {
  StripeConnectAccount,
  StripeAccountStatus,
  CapabilityStatus,
} from '../../database/entities/stripe-connect-account.entity';
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
    // @InjectRepository(BusinessProfile)
    // private readonly businessProfileRepo: Repository<BusinessProfile>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Create a new Stripe Connect account for a promoter
   */
  async createConnectedAccount(
    dto: CreateConnectedAccountDto,
  ): Promise<StripeConnectAccount> {
    try {
      // Check if user already has a connected account
      const existingAccount = await this.stripeAccountRepo.findOne({
        where: { userId: dto.userId },
      });

      if (existingAccount) {
        throw new BadRequestException('User already has a connected account');
      }

      // Verify user exists
      const user = await this.userRepo.findOne({
        where: { firebaseUid: dto.userId },
      });
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

      // For non-US countries, explicitly specify capabilities
      if (dto.country !== 'US') {
        accountParams.capabilities = {
          card_payments: { requested: true },
          transfers: { requested: true },
        };
      }

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

      this.logger.log(
        `Created Stripe Connect account ${stripeAccount.id} for user ${dto.userId}`,
      );

      return savedAccount;
    } catch (error) {
      this.logger.error(
        `Failed to create connected account for user ${dto.userId}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create connected account',
      );
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
        return_url: `${this.config.returnUrl}?user_id=${userId}&account_id=${account.stripeAccountId}`,
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
      this.logger.error(
        `Failed to create onboarding link for user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to create onboarding link',
      );
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
      const stripeAccount =
        await this.stripe.accounts.retrieve(stripeAccountId);

      // Find the existing account in our database
      const existingAccount = await this.stripeAccountRepo.findOne({
        where: { stripeAccountId },
      });

      if (!existingAccount) {
        this.logger.warn(`Account ${stripeAccountId} not found in database`);
        return;
      }

      // Update the account data
      existingAccount.chargesEnabled = stripeAccount.charges_enabled;
      existingAccount.payoutsEnabled = stripeAccount.payouts_enabled;
      existingAccount.detailsSubmitted = stripeAccount.details_submitted;
      existingAccount.currentlyDue =
        stripeAccount.requirements?.currently_due || [];
      existingAccount.eventuallyDue =
        stripeAccount.requirements?.eventually_due || [];
      existingAccount.pastDue = stripeAccount.requirements?.past_due || [];
      existingAccount.pendingVerification =
        stripeAccount.requirements?.pending_verification || [];

      // Determine overall status
      if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
        existingAccount.status = StripeAccountStatus.ACTIVE;
      } else if (
        stripeAccount.requirements?.currently_due &&
        stripeAccount.requirements.currently_due.length > 0
      ) {
        existingAccount.status = StripeAccountStatus.RESTRICTED;
      } else {
        existingAccount.status = StripeAccountStatus.PENDING;
      }

      // Update capabilities
      const capabilities = stripeAccount.capabilities;
      if (capabilities) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        existingAccount.cardPaymentsCapability =
          capabilities.card_payments as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        existingAccount.transfersCapability = capabilities.transfers as any;
      }

      // Save the updated account (this handles JSON serialization properly)
      await this.stripeAccountRepo.save(existingAccount);

      this.logger.log(`Synced account status for ${stripeAccountId}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync account status for ${stripeAccountId}:`,
        error,
      );
      throw error;
    }
  }

  // /** DEPRECATED: This method is not used anymore
  // -------------------------------------------------------------
  //  * Create business profile for business accounts
  //  */
  // async createBusinessProfile(
  //   userId: string,
  //   businessData: Partial<BusinessProfile>,
  // ): Promise<BusinessProfile> {
  //   try {
  //     // Check if business profile already exists
  //     const existingProfile = await this.businessProfileRepo.findOne({
  //       where: { userId },
  //     });

  //     if (existingProfile) {
  //       throw new BadRequestException('Business profile already exists');
  //     }

  //     const businessProfile = this.businessProfileRepo.create({
  //       userId,
  //       ...businessData,
  //       verificationStatus: VerificationStatus.PENDING,
  //     });

  //     return await this.businessProfileRepo.save(businessProfile);
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to create business profile for user ${userId}:`,
  //       error,
  //     );
  //     throw new InternalServerErrorException(
  //       'Failed to create business profile',
  //     );
  //   }
  // }
  // -----------------------------------------------------------

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
  async getAccountByUserId(
    userId: string,
  ): Promise<StripeConnectAccount | null> {
    return this.stripeAccountRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  /**
   * Get account by Stripe account ID
   */
  async getAccountByStripeId(
    stripeAccountId: string,
  ): Promise<StripeConnectAccount | null> {
    return this.stripeAccountRepo.findOne({
      where: { stripeAccountId },
      relations: ['user'],
    });
  }

  /**
   * Sync account data from Stripe
   */
  async syncAccountFromStripe(stripeAccountId: string): Promise<void> {
    try {
      const stripeAccount =
        await this.stripe.accounts.retrieve(stripeAccountId);
      const localAccount = await this.getAccountByStripeId(stripeAccountId);

      if (!localAccount) {
        this.logger.warn(
          `Local account not found for Stripe ID: ${stripeAccountId}`,
        );
        return;
      }

      // Update account data
      localAccount.status = this.mapStripeAccountStatus(stripeAccount);
      const capabilities = this.mapCapabilityStatuses(
        stripeAccount.capabilities,
      );
      localAccount.transfersCapability =
        capabilities.transfers || CapabilityStatus.INACTIVE;
      localAccount.cardPaymentsCapability =
        capabilities.card_payments || CapabilityStatus.INACTIVE;
      localAccount.chargesEnabled = stripeAccount.charges_enabled;
      localAccount.payoutsEnabled = stripeAccount.payouts_enabled;
      localAccount.detailsSubmitted = stripeAccount.details_submitted;
      localAccount.updatedAt = new Date();

      await this.stripeAccountRepo.save(localAccount);
      this.logger.log(`Synced account data for ${stripeAccountId}`);
    } catch (error) {
      this.logger.error('Error syncing account from Stripe:', error);
      throw error;
    }
  }

  /**
   * Handle account deauthorization
   */
  async handleAccountDeauthorization(stripeAccountId: string): Promise<void> {
    try {
      const localAccount = await this.getAccountByStripeId(stripeAccountId);

      if (localAccount) {
        localAccount.status = StripeAccountStatus.DEAUTHORIZED;
        localAccount.chargesEnabled = false;
        localAccount.payoutsEnabled = false;
        localAccount.updatedAt = new Date();

        await this.stripeAccountRepo.save(localAccount);
        this.logger.log(`Marked account as deauthorized: ${stripeAccountId}`);
      }
    } catch (error) {
      this.logger.error('Error handling account deauthorization:', error);
      throw error;
    }
  }

  /**
   * Update payout status for an account
   */
  async updatePayoutStatus(
    stripeAccountId: string,
    payoutId: string,
    status: string,
  ): Promise<void> {
    try {
      // Note: We could create a separate payouts table if needed
      // For now, just log the payout status change
      this.logger.log(
        `Payout ${payoutId} for account ${stripeAccountId} status: ${status}`,
      );

      // Update last activity
      const localAccount = await this.getAccountByStripeId(stripeAccountId);
      if (localAccount) {
        localAccount.updatedAt = new Date();
        await this.stripeAccountRepo.save(localAccount);
      }
    } catch (error) {
      this.logger.error('Error updating payout status:', error);
      throw error;
    }
  }

  // /** DEPRECATED: This method is not used anymore
  // -------------------------------------------------------------
  //  * Handle person updates for business accounts
  //  */
  // async handlePersonUpdate(
  //   stripeAccountId: string,
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   _person: any,
  // ): Promise<void> {
  //   try {
  //     const localAccount = await this.getAccountByStripeId(stripeAccountId);

  //     if (!localAccount) {
  //       this.logger.warn(
  //         `Local account not found for person update: ${stripeAccountId}`,
  //       );
  //       return;
  //     }

  //     // Update business profile if exists
  //     const businessProfile = await this.businessProfileRepo.findOne({
  //       where: { userId: localAccount.userId },
  //     });

  //     if (businessProfile) {
  //       // Update person-related fields
  //       businessProfile.updatedAt = new Date();
  //       await this.businessProfileRepo.save(businessProfile);
  //     }

  //     // Update account last updated timestamp
  //     localAccount.updatedAt = new Date();
  //     await this.stripeAccountRepo.save(localAccount);

  //     this.logger.log(`Updated person data for account ${stripeAccountId}`);
  //   } catch (error) {
  //     this.logger.error('Error handling person update:', error);
  //     throw error;
  //   }
  // }
  // -----------------------------------------------------------

  /**
   * Map Stripe account status to our enum
   */
  private mapStripeAccountStatus(
    stripeAccount: Stripe.Account,
  ): StripeAccountStatus {
    if (!stripeAccount.details_submitted) {
      return StripeAccountStatus.PENDING;
    }

    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      return StripeAccountStatus.ACTIVE;
    }

    if (
      stripeAccount.requirements?.currently_due?.length &&
      stripeAccount.requirements.currently_due.length > 0
    ) {
      return StripeAccountStatus.RESTRICTED;
    }

    return StripeAccountStatus.PENDING;
  }

  /**
   * Map Stripe capabilities to our enum
   */
  private mapCapabilityStatuses(
    capabilities: Stripe.Account.Capabilities | undefined,
  ): Record<string, CapabilityStatus> {
    const result: Record<string, CapabilityStatus> = {};

    if (!capabilities) {
      return result;
    }

    for (const [capability, status] of Object.entries(capabilities)) {
      switch (status) {
        case 'active':
          result[capability] = CapabilityStatus.ACTIVE;
          break;
        case 'inactive':
          result[capability] = CapabilityStatus.INACTIVE;
          break;
        case 'pending':
          result[capability] = CapabilityStatus.PENDING;
          break;
        default:
          result[capability] = CapabilityStatus.INACTIVE;
      }
    }

    return result;
  }

  /**
   * Get Stripe instance for webhook service
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }

  /**
   * Update account from webhook event
   */
  async updateAccountFromWebhook(
    stripeAccountId: string,
    updates: Partial<{
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
      status: string;
    }>,
  ): Promise<void> {
    try {
      const localAccount = await this.getAccountByStripeId(stripeAccountId);

      if (!localAccount) {
        this.logger.warn(
          `Local account not found for webhook update: ${stripeAccountId}`,
        );
        return;
      }

      // Map string status to enum if provided
      let mappedStatus = localAccount.status;
      if (updates.status) {
        switch (updates.status) {
          case 'active':
            mappedStatus = StripeAccountStatus.ACTIVE;
            break;
          case 'pending':
            mappedStatus = StripeAccountStatus.PENDING;
            break;
          case 'restricted':
            mappedStatus = StripeAccountStatus.RESTRICTED;
            break;
          case 'deauthorized':
            mappedStatus = StripeAccountStatus.RESTRICTED; // Map deauthorized to restricted
            break;
          default:
            mappedStatus = StripeAccountStatus.PENDING;
        }
      }

      await this.stripeAccountRepo.update(localAccount.id, {
        ...updates,
        status: mappedStatus,
        updatedAt: new Date(),
      });

      this.logger.log(`Updated account ${stripeAccountId} from webhook`);
    } catch (error) {
      this.logger.error(
        `Failed to update account ${stripeAccountId} from webhook:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Exchange OAuth authorization code for access token and account information
   */
  async exchangeOAuthCode(
    code: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _state?: string,
  ): Promise<{
    stripeAccountId: string;
    userId: string;
    accessToken: string;
    refreshToken?: string;
  }> {
    try {
      this.logger.log('Exchanging OAuth code for access token');

      // Exchange the code for an access token using Stripe's OAuth
      const response = await this.stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
      });

      const {
        stripe_user_id: stripeAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
      } = response;

      // Validate required fields from Stripe response
      if (!stripeAccountId || !accessToken) {
        throw new InternalServerErrorException(
          'Invalid response from Stripe OAuth: missing required fields',
        );
      }

      // Find the local account to get the userId
      const account = await this.stripeAccountRepo.findOne({
        where: { stripeAccountId },
        relations: ['user'],
      });

      if (!account) {
        throw new BadRequestException(
          'Account not found for the provided authorization code',
        );
      }

      // Note: We're not storing OAuth tokens in the current schema
      // They would need to be added to the database schema if needed for future operations

      this.logger.log(
        `Successfully exchanged OAuth code for account ${stripeAccountId}`,
      );

      return {
        stripeAccountId,
        userId: account.user.id,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error('Failed to exchange OAuth code:', error);
      throw new InternalServerErrorException(
        'Failed to exchange authorization code',
      );
    }
  }

  /**
   * Mark an account as fully onboarded
   */
  async markAccountAsOnboarded(stripeAccountId: string): Promise<void> {
    try {
      this.logger.log(`Marking account ${stripeAccountId} as onboarded`);

      const account = await this.stripeAccountRepo.findOne({
        where: { stripeAccountId },
      });

      if (!account) {
        throw new BadRequestException(`Account ${stripeAccountId} not found`);
      }

      // Sync the latest status from Stripe
      await this.syncAccountStatus(stripeAccountId);

      // Update the onboarded status
      await this.stripeAccountRepo.update(account.id, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(
        `Successfully marked account ${stripeAccountId} as onboarded`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark account ${stripeAccountId} as onboarded:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify account completeness and requirements
   */
  async verifyAccountCompleteness(accountIdOrUserId: string): Promise<{
    isComplete: boolean;
    requirements: any;
    capabilities: any;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    try {
      this.logger.log(
        `Verifying account completeness for ${accountIdOrUserId}`,
      );

      // Try to find account by Stripe account ID first, then by user ID
      let account = await this.stripeAccountRepo.findOne({
        where: { stripeAccountId: accountIdOrUserId },
      });

      if (!account) {
        account = await this.stripeAccountRepo.findOne({
          where: { user: { id: accountIdOrUserId } },
          relations: ['user'],
        });
      }

      if (!account) {
        throw new BadRequestException(
          `Account not found for identifier: ${accountIdOrUserId}`,
        );
      }

      // Get the latest status from Stripe
      const stripeAccount = await this.stripe.accounts.retrieve(
        account.stripeAccountId,
      );

      const isComplete =
        stripeAccount.charges_enabled &&
        stripeAccount.payouts_enabled &&
        (!stripeAccount.requirements?.currently_due?.length ||
          stripeAccount.requirements.currently_due.length === 0);

      return {
        isComplete,
        requirements: stripeAccount.requirements,
        capabilities: stripeAccount.capabilities,
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify account completeness for ${accountIdOrUserId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get connected account by user ID (alias for getAccountByUserId)
   */
  async getConnectedAccount(
    userId: string,
  ): Promise<StripeConnectAccount | null> {
    return this.getAccountByUserId(userId);
  }
}
