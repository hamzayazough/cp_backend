import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ViewsService } from '../services/views.service';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Controller('visit')
export class VisitController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get(':campaignId/:promoterId')
  async visit(
    @Param('campaignId') campaignId: string,
    @Param('promoterId') promoterId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // 1) Ensure browserToken cookie
      const cookies = req.cookies as Record<string, string> | undefined;
      let token = cookies?.browserToken;
      if (!token) {
        token = randomUUID();
        res.cookie('browserToken', token, {
          httpOnly: true,
          maxAge: 31536000000, // 1 year
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        });
      }

      // 2) Get client IP (handle proxy headers)
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

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
      // Log the error for debugging
      console.error('Error in visit controller:', error);

      const isNotFoundException =
        error instanceof NotFoundException ||
        (error instanceof HttpException && error.getStatus() === 404);

      if (isNotFoundException) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: String(error.message || 'Resource not found'),
        });
      }

      // Generic error response
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
}
