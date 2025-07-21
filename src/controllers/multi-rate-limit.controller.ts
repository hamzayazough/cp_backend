import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ViewsService } from '../services/views.service';
import {
  RateLimitService,
  RATE_LIMIT_CONFIGS,
} from '../services/rate-limit.service';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Controller('visit-enhanced')
export class MultiLevelRateLimitController {
  constructor(
    private readonly viewsService: ViewsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  // Multi-level rate limiting using custom service only
  @Get(':campaignId/:promoterId')
  async visit(
    @Param('campaignId') campaignId: string,
    @Param('promoterId') promoterId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Multi-level rate limiting using our custom service
      const keys = this.rateLimitService.createRateLimitKeys(
        req,
        campaignId,
        promoterId,
      );

      // Check multiple rate limits
      this.rateLimitService.checkMultipleRateLimits(keys.ipKey, [
        {
          suffix: 'second',
          config: RATE_LIMIT_CONFIGS.IP_PER_SECOND,
          message: 'Too many requests per second from your IP',
        },
        {
          suffix: 'minute',
          config: RATE_LIMIT_CONFIGS.IP_PER_MINUTE,
          message: 'Too many requests per minute from your IP',
        },
      ]);

      this.rateLimitService.checkMultipleRateLimits(keys.userKey, [
        {
          suffix: 'second',
          config: RATE_LIMIT_CONFIGS.USER_PER_SECOND,
          message: 'You are making requests too quickly',
        },
        {
          suffix: 'minute',
          config: RATE_LIMIT_CONFIGS.USER_PER_MINUTE,
          message: 'Too many requests per minute',
        },
      ]);

      this.rateLimitService.checkRateLimit(
        keys.userCampaignKey,
        RATE_LIMIT_CONFIGS.USER_PER_CAMPAIGN_PER_MINUTE,
        'You have visited this campaign too recently',
      );

      // Cookie management
      const cookies = req.cookies as Record<string, string> | undefined;
      let token = cookies?.browserToken;
      if (!token) {
        token = randomUUID();
        res.cookie('browserToken', token, {
          httpOnly: true,
          maxAge: 31536000000,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      const clientIp = this.extractRealIp(req);
      const redirectUrl = await this.viewsService.trackAndRedirect(
        campaignId,
        promoterId,
        clientIp,
        req.headers['user-agent'] || '',
        token,
      );

      return res.redirect(302, redirectUrl);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in multi-level rate limit controller:', error);
      throw new HttpException(
        'Unable to process visit request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private extractRealIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    const xRealIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string;

    return (
      cfConnectingIp ||
      xRealIp ||
      xForwardedFor?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    );
  }
}
