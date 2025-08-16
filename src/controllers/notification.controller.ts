import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Request,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { NotificationType } from '../enums/notification-type';
import { NotificationQueryService } from '../services/notifications/notification-query.service';

/**
 * Controller for managing user notifications
 * Provides endpoints for fetching, marking as read, and managing in-app notifications
 */
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationQueryService: NotificationQueryService,
  ) {}

  /**
   * Get user's notifications with pagination and filtering
   * GET /notifications?page=1&limit=20&unread=true&type=PAYMENT_RECEIVED
   */
  @Get()
  async getUserNotifications(
    @Request() req: { user: FirebaseUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unread') unread?: string,
    @Query('type') notificationType?: NotificationType,
    @Query('campaignId') campaignId?: string,
  ) {
    try {
      return await this.notificationQueryService.getUserNotifications({
        firebaseUid: req.user.uid,
        page,
        limit,
        unread,
        notificationType,
        campaignId,
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      this.logger.error(
        `Failed to get notifications for user ${req.user?.uid}:`,
        error,
      );
      throw new InternalServerErrorException('Failed to get notifications');
    }
  }

  /**
   * Get count of unread notifications
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: { user: FirebaseUser }) {
    try {
      return await this.notificationQueryService.getUnreadCount(req.user.uid);
    } catch (error) {
      console.error('Error getting unread count:', error);
      this.logger.error(
        `Failed to get unread count for user ${req.user?.uid}:`,
        error,
      );
      throw new InternalServerErrorException('Failed to get unread count');
    }
  }

  /**
   * Get notification by ID
   * GET /notifications/:id
   */
  @Get(':id')
  async getNotificationById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: FirebaseUser },
  ) {
    return await this.notificationQueryService.getNotificationById(
      id,
      req.user.uid,
    );
  }

  /**
   * Mark notification as read
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: FirebaseUser },
  ) {
    return await this.notificationQueryService.markAsRead(id, req.user.uid);
  }

  /**
   * Mark notification as clicked
   * PATCH /notifications/:id/click
   */
  @Patch(':id/click')
  async markAsClicked(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: FirebaseUser },
  ) {
    return await this.notificationQueryService.markAsClicked(id, req.user.uid);
  }

  /**
   * Mark notification as dismissed
   * PATCH /notifications/:id/dismiss
   */
  @Patch(':id/dismiss')
  async markAsDismissed(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: FirebaseUser },
  ) {
    return await this.notificationQueryService.markAsDismissed(
      id,
      req.user.uid,
    );
  }

  /**
   * Mark all notifications as read
   * PATCH /notifications/mark-all-read
   */
  @Patch('mark-all-read')
  async markAllAsRead(@Request() req: { user: FirebaseUser }) {
    return await this.notificationQueryService.markAllAsRead(req.user.uid);
  }

  /**
   * Delete notification (optional - for cleanup)
   * DELETE /notifications/:id
   */
  @Delete(':id')
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: FirebaseUser },
  ) {
    return await this.notificationQueryService.deleteNotification(
      id,
      req.user.uid,
    );
  }

  /**
   * Bulk delete dismissed notifications (cleanup)
   * DELETE /notifications/dismissed
   */
  @Delete('dismissed')
  async deleteDismissedNotifications(@Request() req: { user: FirebaseUser }) {
    return await this.notificationQueryService.deleteDismissedNotifications(
      req.user.uid,
    );
  }
}
