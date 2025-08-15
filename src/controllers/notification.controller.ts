import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Request,
  Logger,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { NotificationEntity } from '../database/entities/notification.entity';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { NotificationType } from '../enums/notification-type';

/**
 * Controller for managing user notifications
 * Provides endpoints for fetching, marking as read, and managing in-app notifications
 */
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
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
    const userId = req.user.uid;
    const offset = (page - 1) * limit;

    // Build query conditions
    const whereConditions: Partial<NotificationEntity> = { userId };

    if (unread === 'true') {
      whereConditions.readAt = undefined;
    }

    if (notificationType) {
      whereConditions.notificationType = notificationType;
    }

    if (campaignId) {
      whereConditions.campaignId = campaignId;
    }

    // Get notifications with pagination
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.campaign', 'campaign')
      .where('notification.userId = :userId', { userId });

    if (unread === 'true') {
      queryBuilder.andWhere('notification.readAt IS NULL');
    }

    if (notificationType) {
      queryBuilder.andWhere(
        'notification.notificationType = :notificationType',
        { notificationType },
      );
    }

    if (campaignId) {
      queryBuilder.andWhere('notification.campaignId = :campaignId', {
        campaignId,
      });
    }

    const [notifications, total] = await queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.notificationType,
        title: notification.title,
        message: notification.message,
        isUnread: notification.isUnread,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        clickedAt: notification.clickedAt,
        dismissedAt: notification.dismissedAt,
        campaignId: notification.campaignId,
        campaignTitle: notification.campaign?.title,
        metadata: notification.metadata,
        // Don't expose sensitive delivery tracking info to frontend
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNext,
        hasPrev,
      },
      summary: {
        totalUnread: await this.notificationRepository.count({
          where: {
            userId,
            readAt: IsNull(),
          },
        }),
        totalAll: total,
      },
    };
  }

  /**
   * Get count of unread notifications
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: { user: FirebaseUser }) {
    try {
      const userId = req.user.uid;
      const count = await this.notificationRepository.count({
        where: {
          userId,
          readAt: IsNull(),
        },
      });

      return { count };
    } catch {
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
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: req.user.uid },
      relations: ['campaign'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return {
      id: notification.id,
      type: notification.notificationType,
      title: notification.title,
      message: notification.message,
      isUnread: notification.isUnread,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      clickedAt: notification.clickedAt,
      dismissedAt: notification.dismissedAt,
      campaignId: notification.campaignId,
      campaignTitle: notification.campaign?.title,
      metadata: notification.metadata,
    };
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
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: req.user.uid },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsRead();
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${req.user.uid} marked notification ${id} as read`);

    return {
      success: true,
      message: 'Notification marked as read',
      readAt: notification.readAt,
    };
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
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: req.user.uid },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsClicked();
    if (!notification.readAt) {
      notification.markAsRead(); // Auto-mark as read when clicked
    }
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${req.user.uid} clicked notification ${id}`);

    return {
      success: true,
      message: 'Notification marked as clicked',
      clickedAt: notification.clickedAt,
      readAt: notification.readAt,
    };
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
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: req.user.uid },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsDismissed();
    if (!notification.readAt) {
      notification.markAsRead(); // Auto-mark as read when dismissed
    }
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${req.user.uid} dismissed notification ${id}`);

    return {
      success: true,
      message: 'Notification marked as dismissed',
      dismissedAt: notification.dismissedAt,
      readAt: notification.readAt,
    };
  }

  /**
   * Mark all notifications as read
   * PATCH /notifications/mark-all-read
   */
  @Patch('mark-all-read')
  async markAllAsRead(@Request() req: { user: FirebaseUser }) {
    const userId = req.user.uid;

    const result = await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    this.logger.log(
      `User ${userId} marked ${result.affected} notifications as read`,
    );

    return {
      success: true,
      message: `Marked ${result.affected} notifications as read`,
      markedCount: result.affected,
    };
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
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: req.user.uid },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.remove(notification);

    this.logger.log(`User ${req.user.uid} deleted notification ${id}`);

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }

  /**
   * Bulk delete dismissed notifications (cleanup)
   * DELETE /notifications/dismissed
   */
  @Delete('dismissed')
  async deleteDismissedNotifications(@Request() req: { user: FirebaseUser }) {
    const userId = req.user.uid;

    const result = await this.notificationRepository.delete({
      userId,
      dismissedAt: Not(IsNull()),
    });

    this.logger.log(
      `User ${userId} deleted ${result.affected} dismissed notifications`,
    );

    return {
      success: true,
      message: `Deleted ${result.affected} dismissed notifications`,
      deletedCount: result.affected,
    };
  }
}
