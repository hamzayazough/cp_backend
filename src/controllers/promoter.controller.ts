import { Controller, Post, Body, Request } from '@nestjs/common';
import { PromoterService } from '../services/promoter.service';
import {
  PromoterDashboardRequest,
  PromoterDashboardResponse,
} from '../interfaces/promoter-dashboard';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Controller('promoter')
export class PromoterController {
  constructor(private readonly promoterService: PromoterService) {}

  @Post('dashboard')
  async getDashboardData(
    @Body() request: PromoterDashboardRequest,
    @Request() req: { user: FirebaseUser },
  ): Promise<PromoterDashboardResponse> {
    try {
      const firebaseUid = req.user.uid;

      const data = await this.promoterService.getDashboardData(
        firebaseUid,
        request,
      );

      return {
        success: true,
        data,
        message: 'Dashboard data retrieved successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve dashboard data';
      return {
        success: false,
        data: {},
        message: errorMessage,
      };
    }
  }
}
