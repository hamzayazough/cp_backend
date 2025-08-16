import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { NotificationType } from '../../enums/notification-type';

export interface GetNotificationsParams {
  firebaseUid: string;
  page: number;
  limit: number;
  unread?: string;
  notificationType?: NotificationType;
  campaignId?: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isUnread: boolean;
  createdAt: Date;
  readAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  campaignId?: string;
  campaignTitle?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedNotificationsResponse {
  notifications: NotificationResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalUnread: number;
    totalAll: number;
  };
}

@Injectable()
export class NotificationQueryService {
  private readonly logger = new Logger(NotificationQueryService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Helper method to get database user ID from Firebase UID
   */
  private async getUserId(firebaseUid: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      select: ['id'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.id;
  }

  /**
   * Get user's notifications with pagination and filtering
   */
  async getUserNotifications(
    params: GetNotificationsParams,
  ): Promise<PaginatedNotificationsResponse> {
    const { firebaseUid, page, limit, unread, notificationType, campaignId } =
      params;

    const userId = await this.getUserId(firebaseUid);
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
   */
  async getUnreadCount(firebaseUid: string): Promise<{ count: number }> {
    const userId = await this.getUserId(firebaseUid);

    const count = await this.notificationRepository.count({
      where: {
        userId,
        readAt: IsNull(),
      },
    });

    return { count };
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    id: string,
    firebaseUid: string,
  ): Promise<NotificationResponse> {
    const userId = await this.getUserId(firebaseUid);
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
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
   */
  async markAsRead(
    id: string,
    firebaseUid: string,
  ): Promise<{ success: boolean; message: string; readAt: Date }> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: await this.getUserId(firebaseUid) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsRead();
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${firebaseUid} marked notification ${id} as read`);

    return {
      success: true,
      message: 'Notification marked as read',
      readAt: notification.readAt!, // Using non-null assertion since markAsRead() sets it
    };
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(
    id: string,
    firebaseUid: string,
  ): Promise<{
    success: boolean;
    message: string;
    clickedAt: Date;
    readAt?: Date;
  }> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: await this.getUserId(firebaseUid) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsClicked();
    if (!notification.readAt) {
      notification.markAsRead(); // Auto-mark as read when clicked
    }
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${firebaseUid} clicked notification ${id}`);

    return {
      success: true,
      message: 'Notification marked as clicked',
      clickedAt: notification.clickedAt!, // Using non-null assertion since markAsClicked() sets it
      readAt: notification.readAt,
    };
  }

  /**
   * Mark notification as dismissed
   */
  async markAsDismissed(
    id: string,
    firebaseUid: string,
  ): Promise<{
    success: boolean;
    message: string;
    dismissedAt: Date;
    readAt?: Date;
  }> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: await this.getUserId(firebaseUid) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsDismissed();
    if (!notification.readAt) {
      notification.markAsRead(); // Auto-mark as read when dismissed
    }
    await this.notificationRepository.save(notification);

    this.logger.log(`User ${firebaseUid} dismissed notification ${id}`);

    return {
      success: true,
      message: 'Notification marked as dismissed',
      dismissedAt: notification.dismissedAt!, // Using non-null assertion since markAsDismissed() sets it
      readAt: notification.readAt,
    };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(
    firebaseUid: string,
  ): Promise<{ success: boolean; message: string; markedCount: number }> {
    const userId = await this.getUserId(firebaseUid);

    const result = await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    this.logger.log(
      `User ${firebaseUid} marked ${result.affected} notifications as read`,
    );

    return {
      success: true,
      message: `Marked ${result.affected} notifications as read`,
      markedCount: result.affected || 0,
    };
  }

  /**
   * Delete notification
   */
  async deleteNotification(
    id: string,
    firebaseUid: string,
  ): Promise<{ success: boolean; message: string }> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId: await this.getUserId(firebaseUid) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.remove(notification);

    this.logger.log(`User ${firebaseUid} deleted notification ${id}`);

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }

  /**
   * Bulk delete dismissed notifications
   */
  async deleteDismissedNotifications(
    firebaseUid: string,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    const userId = await this.getUserId(firebaseUid);

    const result = await this.notificationRepository.delete({
      userId,
      dismissedAt: Not(IsNull()),
    });

    this.logger.log(
      `User ${firebaseUid} deleted ${result.affected} dismissed notifications`,
    );

    return {
      success: true,
      message: `Deleted ${result.affected} dismissed notifications`,
      deletedCount: result.affected || 0,
    };
  }
}
