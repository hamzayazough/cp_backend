import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  StripeConnectService,
  CreateConnectedAccountDto,
} from '../services/stripe-connect.service';
import { User } from '../../auth/user.decorator';
import { FirebaseUser } from '../../interfaces/firebase-user.interface';

// DTOs
export class CreateAccountDto {
  email: string;
  country: string; // 'US' or 'CA'
  isBusiness: boolean;
  businessName?: string;
  firstName?: string;
  lastName?: string;
}

export class CreateBusinessProfileDto {
  businessName: string;
  businessType?: string; // 'llc', 'corporation', 'partnership', 'sole_proprietorship'
  taxId?: string;
  businessAddressLine1?: string;
  businessAddressLine2?: string;
  businessCity?: string;
  businessState?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  businessPhone?: string;
  businessWebsite?: string;
  representativeFirstName?: string;
  representativeLastName?: string;
  representativeEmail?: string;
  representativeDob?: string;
  representativePhone?: string;
}

@Controller('connect')
export class ConnectController {
  private readonly logger = new Logger(ConnectController.name);

  constructor(private readonly stripeConnectService: StripeConnectService) {}

  /**
   * Create a new Stripe Connect account for the authenticated user
   */
  @Post('create-account')
  async createAccount(
    @User() user: FirebaseUser,
    @Body() createAccountDto: CreateAccountDto,
  ) {
    try {
      this.logger.log(`Creating Stripe Connect account for user ${user.uid}`);

      const accountData: CreateConnectedAccountDto = {
        userId: user.uid,
        email: createAccountDto.email || user.email,
        country: createAccountDto.country,
        isBusiness: createAccountDto.isBusiness,
        businessName: createAccountDto.businessName,
        firstName: createAccountDto.firstName,
        lastName: createAccountDto.lastName,
      };

      const account =
        await this.stripeConnectService.createConnectedAccount(accountData);

      this.logger.log(
        `Successfully created account ${account.stripeAccountId} for user ${user.uid}`,
      );

      return {
        success: true,
        data: {
          accountId: account.id,
          stripeAccountId: account.stripeAccountId,
          status: account.status,
          accountType: account.accountType,
          businessType: account.businessType,
          country: account.country,
          chargesEnabled: account.chargesEnabled,
          payoutsEnabled: account.payoutsEnabled,
        },
        message: 'Stripe Connect account created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create account for user ${user.uid}:`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to create Stripe Connect account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get onboarding link for the authenticated user
   */
  @Get('onboard')
  async getOnboardingLink(@User() user: FirebaseUser) {
    try {
      this.logger.log(`Getting onboarding link for user ${user.uid}`);

      const onboardingLink =
        await this.stripeConnectService.createOnboardingLink(user.uid);

      return {
        success: true,
        data: {
          url: onboardingLink.url,
          expiresAt: onboardingLink.expiresAt,
        },
        message: 'Onboarding link generated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get onboarding link for user ${user.uid}:`,
        error,
      );

      throw new HttpException(
        'Failed to generate onboarding link',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get onboarding link for a specific user (admin use)
   */
  @Get('onboard/:userId')
  async getOnboardingLinkForUser(@Param('userId') userId: string) {
    try {
      this.logger.log(`Getting onboarding link for user ${userId}`);

      const onboardingLink =
        await this.stripeConnectService.createOnboardingLink(userId);

      return {
        success: true,
        data: {
          url: onboardingLink.url,
          expiresAt: onboardingLink.expiresAt,
        },
        message: 'Onboarding link generated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get onboarding link for user ${userId}:`,
        error,
      );

      throw new HttpException(
        'Failed to generate onboarding link',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Refresh onboarding link for the authenticated user
   */
  @Post('refresh-onboarding')
  async refreshOnboardingLink(@User() user: FirebaseUser) {
    try {
      this.logger.log(`Refreshing onboarding link for user ${user.uid}`);

      const onboardingLink =
        await this.stripeConnectService.refreshOnboardingLink(user.uid);

      return {
        success: true,
        data: {
          url: onboardingLink.url,
          expiresAt: onboardingLink.expiresAt,
        },
        message: 'Onboarding link refreshed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh onboarding link for user ${user.uid}:`,
        error,
      );

      throw new HttpException(
        'Failed to refresh onboarding link',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get account status for the authenticated user
   */
  @Get('status')
  async getAccountStatus(@User() user: FirebaseUser) {
    try {
      this.logger.log(`Getting account status for user ${user.uid}`);

      const account = await this.stripeConnectService.getAccountStatus(
        user.uid,
      );

      if (!account) {
        return {
          success: true,
          data: null,
          message: 'No Stripe Connect account found',
        };
      }

      return {
        success: true,
        data: {
          accountId: account.id,
          stripeAccountId: account.stripeAccountId,
          status: account.status,
          accountType: account.accountType,
          businessType: account.businessType,
          country: account.country,
          defaultCurrency: account.defaultCurrency,
          chargesEnabled: account.chargesEnabled,
          payoutsEnabled: account.payoutsEnabled,
          detailsSubmitted: account.detailsSubmitted,
          requirements: {
            currentlyDue: account.currentlyDue,
            eventuallyDue: account.eventuallyDue,
            pastDue: account.pastDue,
            pendingVerification: account.pendingVerification,
          },
          capabilities: {
            cardPayments: account.cardPaymentsCapability,
            transfers: account.transfersCapability,
          },
          onboarding: {
            link: account.onboardingLink,
            expiresAt: account.onboardingExpiresAt,
            lastAttempt: account.lastOnboardingAttempt,
          },
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
        message: 'Account status retrieved successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get account status for user ${user.uid}:`,
        error,
      );

      throw new HttpException(
        'Failed to get account status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get account status for a specific user (admin use)
   */
  @Get('status/:userId')
  async getAccountStatusForUser(@Param('userId') userId: string) {
    try {
      this.logger.log(`Getting account status for user ${userId}`);

      const account = await this.stripeConnectService.getAccountStatus(userId);

      if (!account) {
        return {
          success: true,
          data: null,
          message: 'No Stripe Connect account found',
        };
      }

      return {
        success: true,
        data: {
          accountId: account.id,
          stripeAccountId: account.stripeAccountId,
          status: account.status,
          accountType: account.accountType,
          businessType: account.businessType,
          country: account.country,
          defaultCurrency: account.defaultCurrency,
          chargesEnabled: account.chargesEnabled,
          payoutsEnabled: account.payoutsEnabled,
          detailsSubmitted: account.detailsSubmitted,
          requirements: {
            currentlyDue: account.currentlyDue,
            eventuallyDue: account.eventuallyDue,
            pastDue: account.pastDue,
            pendingVerification: account.pendingVerification,
          },
          capabilities: {
            cardPayments: account.cardPaymentsCapability,
            transfers: account.transfersCapability,
          },
          onboarding: {
            link: account.onboardingLink,
            expiresAt: account.onboardingExpiresAt,
            lastAttempt: account.lastOnboardingAttempt,
          },
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
        message: 'Account status retrieved successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get account status for user ${userId}:`,
        error,
      );

      throw new HttpException(
        'Failed to get account status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if account is ready for payments
   */
  @Get('ready')
  async isAccountReady(@User() user: FirebaseUser) {
    try {
      const isReady = await this.stripeConnectService.isAccountReady(user.uid);

      return {
        success: true,
        data: {
          ready: isReady,
        },
        message: isReady
          ? 'Account is ready for payments'
          : 'Account setup required',
      };
    } catch (error) {
      this.logger.error(
        `Failed to check account readiness for user ${user.uid}:`,
        error,
      );

      throw new HttpException(
        'Failed to check account readiness',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create business profile for business accounts
   */
  @Post('business-profile')
  async createBusinessProfile(
    @User() user: FirebaseUser,
    @Body() businessProfileDto: CreateBusinessProfileDto,
  ) {
    try {
      this.logger.log(`Creating business profile for user ${user.uid}`);

      const businessProfile =
        await this.stripeConnectService.createBusinessProfile(user.uid, {
          businessName: businessProfileDto.businessName,
          businessType: businessProfileDto.businessType,
          taxId: businessProfileDto.taxId,
          businessAddressLine1: businessProfileDto.businessAddressLine1,
          businessAddressLine2: businessProfileDto.businessAddressLine2,
          businessCity: businessProfileDto.businessCity,
          businessState: businessProfileDto.businessState,
          businessPostalCode: businessProfileDto.businessPostalCode,
          businessCountry: businessProfileDto.businessCountry,
          businessPhone: businessProfileDto.businessPhone,
          businessWebsite: businessProfileDto.businessWebsite,
          representativeFirstName: businessProfileDto.representativeFirstName,
          representativeLastName: businessProfileDto.representativeLastName,
          representativeEmail: businessProfileDto.representativeEmail,
          representativeDob: businessProfileDto.representativeDob
            ? new Date(businessProfileDto.representativeDob)
            : undefined,
          representativePhone: businessProfileDto.representativePhone,
        });

      return {
        success: true,
        data: {
          id: businessProfile.id,
          businessName: businessProfile.businessName,
          businessType: businessProfile.businessType,
          verificationStatus: businessProfile.verificationStatus,
          createdAt: businessProfile.createdAt,
        },
        message: 'Business profile created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create business profile for user ${user.uid}:`,
        error,
      );

      throw new HttpException(
        'Failed to create business profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
