import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotificationPreferenceEntity } from 'src/database/entities/user-notification-preference.entity';
import { NotificationType } from 'src/enums/notification-type';
import { NotificationDeliveryMethod } from 'src/enums/notification-delivery-method';

@Injectable()
export class NotificationHelperService {
  constructor(
    @InjectRepository(UserNotificationPreferenceEntity)
    private userNotificationPreferenceRepository: Repository<UserNotificationPreferenceEntity>,
  ) {}

  /**
   * Get user's preferred notification delivery methods for a specific notification type
   */
  async getNotificationMethods(
    userId: string,
    notificationType: NotificationType,
  ): Promise<NotificationDeliveryMethod[]> {
    try {
      // Get user's notification preferences
      const preference =
        await this.userNotificationPreferenceRepository.findOne({
          where: { userId, notificationType },
        });

      const methods: NotificationDeliveryMethod[] = [];

      if (preference) {
        // Use user's specific preferences
        if (preference.emailEnabled) {
          methods.push(NotificationDeliveryMethod.EMAIL);
        }
        if (preference.smsEnabled) {
          methods.push(NotificationDeliveryMethod.SMS);
        }
        if (preference.pushEnabled) {
          methods.push(NotificationDeliveryMethod.PUSH);
        }
        if (preference.inAppEnabled) {
          methods.push(NotificationDeliveryMethod.IN_APP);
        }
      } else {
        // No specific preference found, use defaults for this notification type
        const isImportant = this.isImportantNotification(notificationType);

        // Default delivery methods
        methods.push(NotificationDeliveryMethod.EMAIL); // Always include email
        methods.push(NotificationDeliveryMethod.PUSH); // Always include push
        methods.push(NotificationDeliveryMethod.IN_APP); // Always include in-app

        // Only include SMS for important notifications
        if (isImportant) {
          methods.push(NotificationDeliveryMethod.SMS);
        }
      }

      return methods.length > 0 ? methods : [NotificationDeliveryMethod.IN_APP]; // Fallback to in-app only
    } catch (error) {
      console.error('Failed to get notification methods:', error);
      return [NotificationDeliveryMethod.IN_APP]; // Fallback to in-app only
    }
  }

  /**
   * Determine if a notification type is considered important (should include SMS by default)
   */
  private isImportantNotification(notificationType: NotificationType): boolean {
    const importantNotifications = [
      NotificationType.CAMPAIGN_APPLICATION_RECEIVED,
      NotificationType.CAMPAIGN_APPLICATION_ACCEPTED,
      NotificationType.CAMPAIGN_APPLICATION_REJECTED,
      NotificationType.PAYMENT_RECEIVED,
      NotificationType.PAYMENT_SENT,
      NotificationType.PAYMENT_FAILED,
      NotificationType.PAYOUT_PROCESSED,
      NotificationType.SECURITY_ALERT,
      NotificationType.ACCOUNT_VERIFICATION_REQUIRED,
      NotificationType.STRIPE_ACCOUNT_ISSUE,
    ];

    return importantNotifications.includes(notificationType);
  }

  /**
   * Get all user's notification preferences
   */
  async getUserNotificationPreferences(
    userId: string,
  ): Promise<UserNotificationPreferenceEntity[]> {
    return this.userNotificationPreferenceRepository.find({
      where: { userId },
    });
  }

  /**
   * Check if user has notifications enabled for a specific type
   */
  async hasNotificationsEnabled(
    userId: string,
    notificationType: NotificationType,
  ): Promise<boolean> {
    const methods = await this.getNotificationMethods(userId, notificationType);
    return methods.length > 0;
  }
}
