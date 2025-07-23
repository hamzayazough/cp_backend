import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  StripePaymentService,
  CreateCampaignPaymentConfigDto,
} from '../services/stripe-payment.service';
import { StripeConnectService } from '../services/stripe-connect.service';
import { User } from '../../auth/user.decorator';
import { FirebaseUser } from '../../interfaces/firebase-user.interface';
import { RecaptchaGuard } from '../../auth/recaptcha.guard';

// DTOs for request/response
export class CreatePaymentIntentDto {
  campaignId: string;
  payerId: string;
  recipientId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, string>;
}

export class CreateTransferDto {
  paymentIntentId: string;
  destinationAccountId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, string>;
}

export class ConfirmPaymentDto {
  paymentMethodId: string;
  returnUrl?: string;
}

export class CapturePaymentDto {
  amountToCapture?: number;
}

@Controller('stripe/payments')
export class PaymentController {
  constructor(
    private readonly stripePaymentService: StripePaymentService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RecaptchaGuard)
  async createPaymentIntent(
    @User() user: FirebaseUser,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    try {
      const {
        campaignId,
        payerId,
        recipientId,
        amount,
        description,
        metadata,
      } = createPaymentIntentDto;

      // Validate amount
      if (amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Create payment intent with fees calculated
      const result = await this.stripePaymentService.createPaymentIntent({
        campaignId,
        payerId,
        recipientId,
        amount,
        description: description || `Payment for campaign ${campaignId}`,
        metadata: {
          userId: user.uid,
          campaignId,
          ...metadata,
        },
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create payment intent';
      throw new BadRequestException(message);
    }
  }

  @Post('intent/:paymentIntentId/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RecaptchaGuard)
  async confirmPaymentIntent(
    @User() user: FirebaseUser,
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    try {
      const result = await this.stripePaymentService.confirmPaymentIntent(
        paymentIntentId,
        confirmPaymentDto.paymentMethodId,
        confirmPaymentDto.returnUrl,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to confirm payment intent';
      throw new BadRequestException(message);
    }
  }

  @Post('intent/:paymentIntentId/capture')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RecaptchaGuard)
  async capturePaymentIntent(
    @User() user: FirebaseUser,
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() capturePaymentDto: CapturePaymentDto,
  ) {
    try {
      const result = await this.stripePaymentService.capturePaymentIntent(
        paymentIntentId,
        capturePaymentDto.amountToCapture,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to capture payment intent';
      throw new BadRequestException(message);
    }
  }

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RecaptchaGuard)
  async createTransfer(
    @User() user: FirebaseUser,
    @Body() createTransferDto: CreateTransferDto,
  ) {
    try {
      const { paymentIntentId, destinationAccountId, amount } =
        createTransferDto;

      // Validate amount
      if (amount <= 0) {
        throw new BadRequestException('Transfer amount must be greater than 0');
      }

      // Create transfer
      const result = await this.stripePaymentService.createTransfer(
        paymentIntentId,
        destinationAccountId,
        amount,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create transfer';
      throw new BadRequestException(message);
    }
  }

  @Get('intent/:paymentIntentId')
  @UseGuards(RecaptchaGuard)
  async getPaymentIntent(
    @User() user: FirebaseUser,
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    try {
      const paymentIntent =
        await this.stripePaymentService.getPaymentIntent(paymentIntentId);

      if (!paymentIntent) {
        throw new NotFoundException('Payment intent not found');
      }

      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve payment intent';
      throw new BadRequestException(message);
    }
  }

  @Get('intent/:paymentIntentId/transfers')
  @UseGuards(RecaptchaGuard)
  async getPaymentIntentTransfers(
    @User() user: FirebaseUser,
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    try {
      const transfers =
        await this.stripePaymentService.getTransfersByPaymentIntent(
          paymentIntentId,
        );

      return {
        success: true,
        data: transfers,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to retrieve transfers';
      throw new BadRequestException(message);
    }
  }

  @Get('campaign/:campaignId/config')
  @UseGuards(RecaptchaGuard)
  async getCampaignPaymentConfig(
    @User() user: FirebaseUser,
    @Param('campaignId') campaignId: string,
  ) {
    try {
      const config =
        await this.stripePaymentService.getCampaignPaymentConfig(campaignId);

      if (!config) {
        throw new NotFoundException('Campaign payment configuration not found');
      }

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve campaign payment configuration';
      throw new BadRequestException(message);
    }
  }

  @Post('campaign/:campaignId/config')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RecaptchaGuard)
  async createCampaignPaymentConfig(
    @User() user: FirebaseUser,
    @Param('campaignId') campaignId: string,
    @Body() configData: CreateCampaignPaymentConfigDto,
  ) {
    try {
      const config =
        await this.stripePaymentService.createCampaignPaymentConfig({
          ...configData,
          campaignId, // Override with URL param to ensure consistency
        });

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create campaign payment configuration';
      throw new BadRequestException(message);
    }
  }

  @Get('fees/calculate')
  @UseGuards(RecaptchaGuard)
  calculateFees(
    @Query('amount') amount: number,
    @Query('currency') currency: string = 'usd',
  ) {
    try {
      if (!amount || amount <= 0) {
        throw new BadRequestException(
          'Amount must be provided and greater than 0',
        );
      }

      const fees = this.stripePaymentService.calculateFees(amount, currency);

      return {
        success: true,
        data: fees,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to calculate fees';
      throw new BadRequestException(message);
    }
  }
}
