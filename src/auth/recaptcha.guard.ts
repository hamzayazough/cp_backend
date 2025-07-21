import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const recaptchaToken = request.headers['x-recaptcha-token'] as string;

    if (!recaptchaToken) {
      throw new HttpException(
        'reCAPTCHA token required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET');
    if (!secretKey) {
      // If no secret configured, allow through (development mode)
      return true;
    }

    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${secretKey}&response=${recaptchaToken}&remoteip=${request.ip}`,
        },
      );

      const result = (await response.json()) as {
        success: boolean;
        score?: number;
        'error-codes'?: string[];
      };

      if (!result.success) {
        throw new HttpException(
          'reCAPTCHA verification failed',
          HttpStatus.FORBIDDEN,
        );
      }

      // Optional: Check score for reCAPTCHA v3 (0.0 = bot, 1.0 = human)
      if (result.score && result.score < 0.5) {
        throw new HttpException(
          'Suspicious activity detected',
          HttpStatus.FORBIDDEN,
        );
      }

      return true;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      throw new HttpException(
        'reCAPTCHA verification failed',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
