import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  StripeConnectService,
  CreateConnectedAccountDto,
} from '../services/stripe-connect.service';
import { User } from '../../auth/user.decorator';
import { FirebaseUser } from '../../interfaces/firebase-user.interface';
import { BusinessType } from '../../database/entities/stripe-enums';
import { StripeConnectAccount } from 'src/database/entities';

// DTOs
export class CreateAccountDto {
  email: string;
  country: string; // 'US' or 'CA'
  isBusiness: boolean;
  businessName?: string;
  firstName?: string;
  lastName?: string;
}

@Controller('connect')
export class ConnectController {
  private readonly logger = new Logger(ConnectController.name);

  constructor(private readonly stripeConnectService: StripeConnectService) {}

  /**
   * Map string business type to enum
   */
  private mapBusinessType(businessType?: string): BusinessType | undefined {
    if (!businessType) return undefined;

    switch (businessType.toLowerCase()) {
      case 'llc':
        return BusinessType.LLC;
      case 'corporation':
        return BusinessType.CORPORATION;
      case 'partnership':
        return BusinessType.PARTNERSHIP;
      case 'sole_proprietorship':
        return BusinessType.SOLE_PROPRIETORSHIP;
      default:
        throw new HttpException(
          `Invalid business type: ${businessType}`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  /**
   * Create the Stripe Connect account, then redirect the user to Stripe’s onboarding page.
   */
  @Post('create-account')
  async createAccount(
    @User() user: FirebaseUser,
    @Body() createAccountDto: CreateAccountDto,
  ) {
    try {
      // Check if user is authenticated
      if (!user || !user.uid) {
        throw new HttpException(
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      this.logger.log(`Creating Stripe Connect account for user ${user.uid}`);

      // Check if user already has an account first
      const existingAccount = await this.stripeConnectService.getAccountStatus(
        user.uid,
      );

      if (existingAccount) {
        this.logger.log(
          `User ${user.uid} already has a connected account: ${existingAccount.stripeAccountId}`,
        );

        return {
          success: true,
          data: {
            accountId: existingAccount.id,
            stripeAccountId: existingAccount.stripeAccountId,
            status: existingAccount.status,
            accountType: existingAccount.accountType,
            businessType: existingAccount.businessType,
            country: existingAccount.country,
            chargesEnabled: existingAccount.chargesEnabled,
            payoutsEnabled: existingAccount.payoutsEnabled,
          },
          message: 'Stripe Connect account already exists',
        };
      }

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
        `Failed to create account for user ${user?.uid || 'unknown'}:`,
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
      if (!user || !user.uid) {
        throw new HttpException(
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        );
      }

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
        `Failed to get onboarding link for user ${user?.uid || 'unknown'}:`,
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

      const account: StripeConnectAccount | null =
        await this.stripeConnectService.getAccountStatus(user.uid);

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
   * Get account status for a specific user (ADMIN METHOD!!! PLEASE NEVER USE IN FRONTEND)
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
   * OAuth callback endpoint for Stripe Connect onboarding completion
   * This handles the redirect from Stripe after onboarding is completed or cancelled
   */
  @Get('oauth/callback')
  async handleOAuthCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Query('user_id') userId?: string,
    @Query('account_id') accountId?: string,
    @Res() res?: Response,
  ) {
    try {
      console.log('HEHEHEHEHEHEHE');
      this.logger.log('Received Stripe Connect callback', {
        code: code ? 'present' : 'missing',
        state,
        error,
        errorDescription,
        userId,
        accountId,
      });

      if (!res) {
        throw new HttpException(
          'Response object not available',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Handle error cases (user denied access or other error)
      if (error) {
        this.logger.warn('OAuth callback received error', {
          error,
          errorDescription,
        });

        // Redirect to frontend with error
        const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=error&error=${encodeURIComponent(error)}`;
        return res.redirect(frontendUrl);
      }

      // Handle Account Links (Express onboarding) - most common case
      if (userId && accountId) {
        try {
          this.logger.log(
            `Processing Account Links callback for user ${userId}, account ${accountId}`,
          );

          // Verify account status with Stripe
          const accountStatus =
            await this.stripeConnectService.verifyAccountCompleteness(
              accountId,
            );

          if (accountStatus.isComplete) {
            // Mark as onboarded in our database
            await this.stripeConnectService.markAccountAsOnboarded(accountId);

            const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=success&account=${accountId}`;
            return res.redirect(frontendUrl);
          } else {
            const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=incomplete&account=${accountId}`;
            return res.redirect(frontendUrl);
          }
        } catch (verifyError) {
          this.logger.error(
            'Failed to verify account completeness',
            verifyError,
          );

          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=error&error=verification_failed`;
          return res.redirect(frontendUrl);
        }
      }

      // Handle OAuth flow (if using OAuth instead of Account Links)
      if (code && !userId && !accountId) {
        try {
          // Exchange code for access token and account info
          const oauthResult = await this.stripeConnectService.exchangeOAuthCode(
            code,
            state,
          );

          this.logger.log('Successfully exchanged OAuth code', {
            accountId: oauthResult.stripeAccountId,
            userId: oauthResult.userId,
          });

          // Update account status in database
          await this.stripeConnectService.markAccountAsOnboarded(
            oauthResult.stripeAccountId,
          );

          // Redirect to frontend with success
          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=success&account=${oauthResult.stripeAccountId}`;
          return res.redirect(frontendUrl);
        } catch (exchangeError) {
          this.logger.error('Failed to exchange OAuth code', exchangeError);

          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=error&error=exchange_failed`;
          return res.redirect(frontendUrl);
        }
      }

      // Handle Account Links (Express onboarding) - no code exchange needed
      // Just check if state contains user info and update status
      if (state) {
        try {
          // State should contain user identifier or account info
          interface StateData {
            userId?: string;
            accountId?: string;
          }

          const stateData: StateData = JSON.parse(
            decodeURIComponent(state),
          ) as StateData;

          if (stateData.userId || stateData.accountId) {
            // Verify account status with Stripe
            const accountStatus =
              await this.stripeConnectService.verifyAccountCompleteness(
                stateData.accountId || stateData.userId!,
              );

            if (accountStatus.isComplete) {
              // Mark as onboarded in our database
              await this.stripeConnectService.markAccountAsOnboarded(
                stateData.accountId!,
              );

              const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=success`;
              return res.redirect(frontendUrl);
            } else {
              const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=incomplete`;
              return res.redirect(frontendUrl);
            }
          }
        } catch (stateError) {
          this.logger.error('Failed to process state parameter', stateError);
        }
      }

      // Fallback - redirect to dashboard
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=unknown`;
      return res.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('OAuth callback handler failed', error);

      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard?onboarded=error&error=callback_failed`;
      if (res) {
        return res.redirect(frontendUrl);
      }
      throw new HttpException(
        'Callback processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint to check onboarding status (called from frontend)
   * Alternative to reading URL parameters on frontend
   */
  @Get('onboarding-status/:userId')
  async getOnboardingStatus(@Param('userId') userId: string) {
    try {
      const account =
        await this.stripeConnectService.getConnectedAccount(userId);

      if (!account) {
        return {
          success: false,
          onboarded: false,
          message: 'No Stripe account found',
        };
      }

      const status = await this.stripeConnectService.verifyAccountCompleteness(
        account.stripeAccountId,
      );

      return {
        success: true,
        onboarded: status.isComplete,
        data: {
          accountId: account.stripeAccountId,
          chargesEnabled: account.chargesEnabled,
          payoutsEnabled: account.payoutsEnabled,
          status: account.status,
          requirementsComplete: status.isComplete,
          requirements: status.requirements, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        },
        message: status.isComplete
          ? 'Account fully onboarded'
          : 'Account setup incomplete',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get onboarding status for user ${userId}`,
        error,
      );

      throw new HttpException(
        'Failed to check onboarding status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
