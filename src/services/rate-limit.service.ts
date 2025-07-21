import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

@Injectable()
export class RateLimitService {
  // In-memory storage (use Redis in production)
  private static rateLimitStore = new Map<string, number[]>();

  constructor(private configService: ConfigService) {}

  /**
   * Check if a specific key (IP, user, or combination) has exceeded rate limit
   */
  checkRateLimit(
    key: string,
    config: RateLimitConfig,
    errorMessage: string = 'Rate limit exceeded',
  ): void {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing requests for this key
    const requests = RateLimitService.rateLimitStore.get(key) || [];

    // Filter out requests outside the current window
    const recentRequests = requests.filter(
      (timestamp) => timestamp > windowStart,
    );

    // Check if limit exceeded
    if (recentRequests.length >= config.maxRequests) {
      throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Add current request timestamp
    recentRequests.push(now);
    RateLimitService.rateLimitStore.set(key, recentRequests);

    // Clean up old entries periodically (prevent memory leaks)
    this.cleanupOldEntries();
  }

  /**
   * Check multiple rate limits for different time windows
   */
  checkMultipleRateLimits(
    baseKey: string,
    limits: Array<{ suffix: string; config: RateLimitConfig; message: string }>,
  ): void {
    for (const limit of limits) {
      const key = `${baseKey}:${limit.suffix}`;
      this.checkRateLimit(key, limit.config, limit.message);
    }
  }

  /**
   * Get rate limit status without incrementing counter
   */
  getRateLimitStatus(
    key: string,
    config: RateLimitConfig,
  ): {
    remaining: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const requests = RateLimitService.rateLimitStore.get(key) || [];
    const recentRequests = requests.filter(
      (timestamp) => timestamp > windowStart,
    );

    const remaining = Math.max(0, config.maxRequests - recentRequests.length);
    const resetTime =
      recentRequests.length > 0
        ? recentRequests[0] + config.windowMs
        : now + config.windowMs;

    return {
      remaining,
      resetTime,
      isLimited: remaining === 0,
    };
  }

  private cleanupOldEntries(): void {
    // Run cleanup every 1000 requests to prevent memory leaks
    if (Math.random() < 0.001) {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      for (const [
        key,
        timestamps,
      ] of RateLimitService.rateLimitStore.entries()) {
        const recentTimestamps = timestamps.filter((t) => t > oneHourAgo);
        if (recentTimestamps.length === 0) {
          RateLimitService.rateLimitStore.delete(key);
        } else {
          RateLimitService.rateLimitStore.set(key, recentTimestamps);
        }
      }
    }
  }

  /**
   * Create rate limit keys for different scenarios
   */
  createRateLimitKeys(
    req: Request,
    campaignId?: string,
    promoterId?: string,
  ): {
    ipKey: string;
    userKey: string;
    campaignKey: string;
    userCampaignKey: string;
  } {
    const ip = this.extractRealIp(req);
    const cookies = req.cookies as Record<string, string> | undefined;
    const browserToken = cookies?.browserToken || 'anonymous';

    return {
      ipKey: `ip:${ip}`,
      userKey: `user:${browserToken}`,
      campaignKey: `campaign:${campaignId}:${ip}`,
      userCampaignKey: `user_campaign:${browserToken}:${campaignId}:${promoterId}`,
    };
  }

  private extractRealIp(req: Request): string {
    const headers = req.headers;
    const xForwardedFor = headers['x-forwarded-for'] as string;
    const xRealIp = headers['x-real-ip'] as string;
    const cfConnectingIp = headers['cf-connecting-ip'] as string;

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

// Rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // IP-based limits
  IP_PER_SECOND: { windowMs: 1000, maxRequests: 2 },
  IP_PER_MINUTE: { windowMs: 60000, maxRequests: 10 },
  IP_PER_HOUR: { windowMs: 3600000, maxRequests: 100 },

  // User-based limits (more generous for legitimate users)
  USER_PER_SECOND: { windowMs: 1000, maxRequests: 1 },
  USER_PER_MINUTE: { windowMs: 60000, maxRequests: 5 },
  USER_PER_HOUR: { windowMs: 3600000, maxRequests: 50 },

  // Campaign-specific limits
  USER_PER_CAMPAIGN_PER_MINUTE: { windowMs: 60000, maxRequests: 2 },
  USER_PER_CAMPAIGN_PER_DAY: { windowMs: 86400000, maxRequests: 10 },
};
