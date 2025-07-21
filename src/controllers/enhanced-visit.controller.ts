import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ViewsService } from '../services/views.service';
import { RecaptchaGuard } from '../auth/recaptcha.guard';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('visit')
@UseGuards(ThrottlerGuard) // Rate limiting
export class EnhancedVisitController {
  constructor(private readonly viewsService: ViewsService) {}

  // Stricter rate limiting for the main endpoint: 5 requests per minute per IP
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get(':campaignId/:promoterId')
  // @UseGuards(RecaptchaGuard) // Uncomment to enable reCAPTCHA
  async visit(
    @Param('campaignId') campaignId: string,
    @Param('promoterId') promoterId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      // Bot detection checks
      this.performBotDetection(req, headers);

      // 1) Ensure browserToken cookie
      const cookies = req.cookies as Record<string, string> | undefined;
      let token = cookies?.browserToken;
      if (!token) {
        token = randomUUID();
        res.cookie('browserToken', token, {
          httpOnly: true,
          maxAge: 31536000000, // 1 year
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      // 2) Get client IP (handle proxy headers)
      const clientIp = this.extractRealIp(req);

      // 3) Track & get redirect URL
      const redirectUrl = await this.viewsService.trackAndRedirect(
        campaignId,
        promoterId,
        clientIp,
        req.headers['user-agent'] || '',
        token,
      );

      // 4) Redirect the user
      return res.redirect(302, redirectUrl);
    } catch (error: any) {
      console.error('Error in visit controller:', error);

      const isNotFoundException =
        error instanceof HttpException && error.getStatus() === 404;

      if (isNotFoundException) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: String(error.message || 'Resource not found'),
        });
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Unable to process visit request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':campaignId/:promoterId/stats')
  async getStats(
    @Param('campaignId') campaignId: string,
    @Param('promoterId') promoterId: string,
  ) {
    try {
      const stats = await this.viewsService.getUniqueViewStats(
        campaignId,
        promoterId,
      );
      return stats;
    } catch {
      throw new HttpException(
        'Unable to fetch view statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private extractRealIp(req: Request): string {
    // Handle various proxy headers in order of preference
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    const xRealIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string; // Cloudflare

    return (
      cfConnectingIp ||
      xRealIp ||
      xForwardedFor?.split(',')[0]?.trim() ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    );
  }

  private performBotDetection(req: Request, headers: Record<string, string>) {
    const userAgent = headers['user-agent']?.toLowerCase() || '';

    // Common bot signatures
    const botSignatures = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'curl',
      'wget',
      'python',
      'java',
      'go-http',
      'okhttp',
      'apache-httpclient',
      'googlebot',
      'bingbot',
      'slurp',
      'duckduckbot',
      'baiduspider',
      'yandexbot',
    ];

    // Check for bot signatures in user agent
    if (botSignatures.some((sig) => userAgent.includes(sig))) {
      throw new HttpException('Bot access not allowed', HttpStatus.FORBIDDEN);
    }

    // Check for missing or suspicious user agent
    if (!userAgent || userAgent.length < 10) {
      throw new HttpException('Invalid user agent', HttpStatus.FORBIDDEN);
    }

    // Check for missing common browser headers
    const hasAccept = headers['accept'];
    const hasAcceptLanguage = headers['accept-language'];
    const hasAcceptEncoding = headers['accept-encoding'];

    if (!hasAccept || !hasAcceptLanguage || !hasAcceptEncoding) {
      throw new HttpException('Missing browser headers', HttpStatus.FORBIDDEN);
    }

    // Check for suspicious header combinations
    const referer = headers['referer'] || '';
    const origin = headers['origin'] || '';

    // Legitimate browsers usually have referer or origin for navigation
    // (though this can be bypassed, so it's just one signal)
    if (!referer && !origin && userAgent.includes('mozilla')) {
      // This is suspicious but not definitive - log for analysis
      console.warn('Suspicious request: Mozilla UA but no referer/origin', {
        userAgent,
        ip: this.extractRealIp(req),
      });
    }
  }
}
