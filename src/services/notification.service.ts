import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';
import { NotificationType } from '../enums/notification-type';
import { NotificationDeliveryMethod } from '../enums/notification-delivery-method';
import {
  CreateNotificationParams,
  UnreadCounts,
  PaginationParams,
} from '../interfaces/notification';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(UserNotificationPreferenceEntity)
    private readonly preferenceRepository: Repository<UserNotificationPreferenceEntity>,
  ) {}

  /**
   * Create a new notification for a user
   */
  async createNotification(params: CreateNotificationParams): Promise<string> {
    try {
      // Get user preferences for this notification type
      const preferences = await this.preferenceRepository.findOne({
        where: {
          userId: params.userId,
          notificationType: params.notificationType,
        },
      });

      // Determine delivery methods based on preferences
      const deliveryMethods: NotificationDeliveryMethod[] = [];

      if (preferences) {
        if (preferences.emailEnabled)
          deliveryMethods.push(NotificationDeliveryMethod.EMAIL);
        if (preferences.smsEnabled)
          deliveryMethods.push(NotificationDeliveryMethod.SMS);
        if (preferences.pushEnabled)
          deliveryMethods.push(NotificationDeliveryMethod.PUSH);
        if (preferences.inAppEnabled)
          deliveryMethods.push(NotificationDeliveryMethod.IN_APP);
      } else {
        // Default to in-app if no preferences found
        deliveryMethods.push(NotificationDeliveryMethod.IN_APP);
      }

      // Create the notification
      const notification = this.notificationRepository.create({
        userId: params.userId,
        notificationType: params.notificationType,
        title: params.title,
        message: params.message,
        campaignId: params.campaignId,
        conversationId: params.conversationId,
        meetingId: params.meetingId,
        paymentId: params.paymentId,
        metadata: params.metadata,
        expiresAt: params.expiresAt,
        deliveryMethods,
      });

      const savedNotification =
        await this.notificationRepository.save(notification);

      this.logger.log(
        `Created notification ${savedNotification.id} for user ${params.userId} of type ${params.notificationType}`,
      );

      return savedNotification.id;
    } catch (error) {
      this.logger.error(
        `Failed to create notification for user ${params.userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get notifications for a user with pagination
   */
  async getUserNotifications(
    userId: string,
    params: PaginationParams,
  ): Promise<NotificationEntity[]> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere(
        '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
        { now: new Date() },
      );

    if (params.unreadOnly) {
      queryBuilder.andWhere('notification.readAt IS NULL');
    }

    return queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .getMany();
  }

  /**
   * Get unread notification counts for a user
   */
  async getUnreadCounts(userId: string): Promise<UnreadCounts> {
    const baseQuery = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.readAt IS NULL')
      .andWhere(
        '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
        { now: new Date() },
      );

    const [total, payment, campaign, message] = await Promise.all([
      baseQuery.getCount(),
      baseQuery
        .clone()
        .andWhere('notification.notificationType LIKE :pattern', {
          pattern: '%PAYMENT%',
        })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('notification.notificationType LIKE :pattern', {
          pattern: '%CAMPAIGN%',
        })
        .getCount(),
      baseQuery
        .clone()
        .andWhere(
          '(notification.notificationType LIKE :pattern1 OR notification.notificationType LIKE :pattern2)',
          {
            pattern1: '%MESSAGE%',
            pattern2: '%CONVERSATION%',
          },
        )
        .getCount(),
    ]);

    return { total, payment, campaign, message };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      readAt: new Date(),
    });
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      clickedAt: new Date(),
    });
  }

  /**
   * Mark notification as dismissed
   */
  async markAsDismissed(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      dismissedAt: new Date(),
    });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(
    userId: string,
  ): Promise<UserNotificationPreferenceEntity[]> {
    return this.preferenceRepository.find({
      where: { userId },
      order: { notificationType: 'ASC' },
    });
  }

  /**
   * Update user notification preference
   */
  async updateUserPreference(
    userId: string,
    notificationType: NotificationType,
    updates: Partial<{
      emailEnabled: boolean;
      smsEnabled: boolean;
      pushEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<void> {
    await this.preferenceRepository.update(
      { userId, notificationType },
      updates,
    );
  }

  /**
   * Delete expired notifications (cleanup job)
   */
  async deleteExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt IS NOT NULL AND expiresAt < :now', { now: new Date() })
      .execute();

    this.logger.log(`Deleted ${result.affected} expired notifications`);
    return result.affected || 0;
  }

  /**
   * Helper method to create campaign-related notifications
   */
  async createCampaignNotification(
    userId: string,
    campaignId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return this.createNotification({
      userId,
      notificationType: type,
      title,
      message,
      campaignId,
      metadata,
    });
  }

  /**
   * Helper method to create payment-related notifications
   */
  async createPaymentNotification(
    userId: string,
    paymentId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return this.createNotification({
      userId,
      notificationType: type,
      title,
      message,
      paymentId,
      metadata,
    });
  }

  /**
   * Helper method to create message-related notifications
   */
  async createMessageNotification(
    userId: string,
    conversationId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return this.createNotification({
      userId,
      notificationType: type,
      title,
      message,
      conversationId,
      metadata,
    });
  }
}
