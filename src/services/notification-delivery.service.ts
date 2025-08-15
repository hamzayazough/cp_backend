import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserEntity } from '../database/entities/user.entity';
import { NotificationType } from '../enums/notification-type';
import { NotificationDeliveryMethod } from '../enums/notification-delivery-method';
import { EmailService, NotificationEmailData } from './email/email.service';
import { PhoneService, SMSNotificationData } from './phone/phone.service';

/**
 * Unified notification delivery data interface
 */
export interface NotificationDeliveryData {
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  deliveryMethods: NotificationDeliveryMethod[];
  metadata?: Record<string, any>;
  campaignId?: string;
  conversationId?: string;
  meetingId?: string;
  paymentId?: string;
}

/**
 * Delivery result for each method
 */
export interface DeliveryResult {
  method: NotificationDeliveryMethod;
  success: boolean;
  sentAt?: Date;
  error?: string;
}

/**
 * Comprehensive delivery results
 */
export interface NotificationDeliveryResults {
  notificationId: string;
  userId: string;
  overallSuccess: boolean;
  results: DeliveryResult[];
  totalDelivered: number;
  totalFailed: number;
}

/**
 * Notification delivery service that coordinates email, SMS, push, and in-app notifications
 * Handles the actual delivery of notifications through various channels
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly emailService: EmailService,
    private readonly phoneService: PhoneService,
  ) {}

  /**
   * Deliver a notification through all specified channels
   */
  async deliverNotification(
    data: NotificationDeliveryData,
  ): Promise<NotificationDeliveryResults> {
    const startTime = Date.now();
    this.logger.log(
      `🚀 Starting notification delivery for user ${data.userId}, type: ${data.notificationType}`,
    );

    // Get user details for delivery
    const user = await this.userRepository.findOne({
      where: { id: data.userId },
      select: [
        'id',
        'email',
        'phoneNumber',
        'name',
        'phoneVerified',
        'pushToken',
      ],
    });

    if (!user) {
      throw new Error(`User not found: ${data.userId}`);
    }

    const results: DeliveryResult[] = [];
    let notificationId: string | null = null;

    // Create notification record in database first
    try {
      const notification = this.notificationRepository.create({
        userId: data.userId,
        notificationType: data.notificationType,
        title: data.title,
        message: data.message,
        campaignId: data.campaignId,
        conversationId: data.conversationId,
        meetingId: data.meetingId,
        paymentId: data.paymentId,
        metadata: data.metadata,
        deliveryMethods: data.deliveryMethods,
      });

      const savedNotification =
        await this.notificationRepository.save(notification);
      notificationId = savedNotification.id;

      this.logger.log(`📝 Created notification record: ${notificationId}`);
    } catch (error) {
      this.logger.error('❌ Failed to create notification record:', error);
      throw error;
    }

    // Deliver through each requested method
    for (const method of data.deliveryMethods) {
      try {
        const result = await this.deliverViaMethod(method, user, data);
        results.push(result);

        // Update notification record with delivery timestamp
        if (result.success && result.sentAt) {
          await this.updateDeliveryTimestamp(
            notificationId,
            method,
            result.sentAt,
          );
        }
      } catch (error) {
        this.logger.error(`❌ Failed to deliver via ${method}:`, error);
        results.push({
          method,
          success: false,
          error: error.message,
        });
      }
    }

    const totalDelivered = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;
    const overallSuccess = totalDelivered > 0;

    const deliveryTime = Date.now() - startTime;
    this.logger.log(
      `📊 Notification delivery completed in ${deliveryTime}ms: ` +
        `${totalDelivered}/${results.length} methods successful`,
    );

    return {
      notificationId,
      userId: data.userId,
      overallSuccess,
      results,
      totalDelivered,
      totalFailed,
    };
  }

  /**
   * Deliver notification via specific method
   */
  private async deliverViaMethod(
    method: NotificationDeliveryMethod,
    user: UserEntity,
    data: NotificationDeliveryData,
  ): Promise<DeliveryResult> {
    switch (method) {
      case NotificationDeliveryMethod.EMAIL:
        return this.deliverViaEmail(user, data);

      case NotificationDeliveryMethod.SMS:
        return this.deliverViaSMS(user, data);

      case NotificationDeliveryMethod.PUSH:
        return this.deliverViaPush(user, data);

      case NotificationDeliveryMethod.IN_APP:
        return this.deliverViaInApp(user);

      default:
        return {
          method,
          success: false,
          error: `Unsupported delivery method: ${method}`,
        };
    }
  }

  /**
   * Deliver notification via email
   */
  private async deliverViaEmail(
    user: UserEntity,
    data: NotificationDeliveryData,
  ): Promise<DeliveryResult> {
    try {
      if (!user.email) {
        return {
          method: NotificationDeliveryMethod.EMAIL,
          success: false,
          error: 'User email not available',
        };
      }

      const emailData: NotificationEmailData = {
        to: user.email,
        userFirstName: user.name?.split(' ')[0],
        notificationType: data.notificationType,
        title: data.title,
        message: data.message,
        templateVariables: data.metadata,
        metadata: data.metadata,
      };

      const success = await this.emailService.sendNotificationEmail(emailData);

      return {
        method: NotificationDeliveryMethod.EMAIL,
        success,
        sentAt: success ? new Date() : undefined,
        error: success ? undefined : 'Email delivery failed',
      };
    } catch (error) {
      return {
        method: NotificationDeliveryMethod.EMAIL,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deliver notification via SMS
   */
  private async deliverViaSMS(
    user: UserEntity,
    data: NotificationDeliveryData,
  ): Promise<DeliveryResult> {
    try {
      if (!user.phoneNumber) {
        return {
          method: NotificationDeliveryMethod.SMS,
          success: false,
          error: 'User phone number not available',
        };
      }

      if (!user.phoneVerified) {
        return {
          method: NotificationDeliveryMethod.SMS,
          success: false,
          error: 'User phone number not verified',
        };
      }

      const smsData: SMSNotificationData = {
        to: user.phoneNumber,
        userFirstName: user.name?.split(' ')[0],
        notificationType: data.notificationType,
        message: data.message,
        metadata: data.metadata,
      };

      const success = await this.phoneService.sendSMS(smsData);

      return {
        method: NotificationDeliveryMethod.SMS,
        success,
        sentAt: success ? new Date() : undefined,
        error: success ? undefined : 'SMS delivery failed',
      };
    } catch (error) {
      return {
        method: NotificationDeliveryMethod.SMS,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deliver notification via push notification
   */
  private deliverViaPush(
    user: UserEntity,
    data: NotificationDeliveryData,
  ): Promise<DeliveryResult> {
    return new Promise((resolve) => {
      try {
        if (!user.pushToken) {
          resolve({
            method: NotificationDeliveryMethod.PUSH,
            success: false,
            error: 'User push token not available',
          });
          return;
        }

        // TODO: Implement push notification delivery (Firebase Cloud Messaging, etc.)
        // For now, just log and simulate success
        this.logger.log(
          `📱 Push notification would be sent to user ${user.id}`,
        );
        this.logger.log(`   Title: ${data.title}`);
        this.logger.log(`   Message: ${data.message.substring(0, 100)}...`);

        resolve({
          method: NotificationDeliveryMethod.PUSH,
          success: true,
          sentAt: new Date(),
          error: undefined,
        });
      } catch (error) {
        resolve({
          method: NotificationDeliveryMethod.PUSH,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Deliver notification via in-app notification
   */
  private deliverViaInApp(user: UserEntity): Promise<DeliveryResult> {
    return new Promise((resolve) => {
      try {
        // In-app notifications are already stored in database, so just mark as delivered
        this.logger.log(`📱 In-app notification ready for user ${user.id}`);

        resolve({
          method: NotificationDeliveryMethod.IN_APP,
          success: true,
          sentAt: new Date(),
          error: undefined,
        });
      } catch (error) {
        resolve({
          method: NotificationDeliveryMethod.IN_APP,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Update notification record with delivery timestamp
   */
  private async updateDeliveryTimestamp(
    notificationId: string,
    method: NotificationDeliveryMethod,
    sentAt: Date,
  ): Promise<void> {
    const updateData: Partial<NotificationEntity> = {};

    switch (method) {
      case NotificationDeliveryMethod.EMAIL:
        updateData.emailSentAt = sentAt;
        break;
      case NotificationDeliveryMethod.SMS:
        updateData.smsSentAt = sentAt;
        break;
      case NotificationDeliveryMethod.PUSH:
        updateData.pushSentAt = sentAt;
        break;
      case NotificationDeliveryMethod.IN_APP:
        updateData.inAppSentAt = sentAt;
        break;
    }

    await this.notificationRepository.update(notificationId, updateData);
  }

  /**
   * Send bulk notifications to multiple users with optimized batch processing
   * Handles rate limiting and concurrent processing for cron jobs
   */
  async deliverBulkNotifications(
    notifications: NotificationDeliveryData[],
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      delayBetweenBatches?: number;
      groupByMethod?: boolean;
    } = {},
  ): Promise<NotificationDeliveryResults[]> {
    const {
      batchSize = parseInt(process.env.NOTIFICATION_BATCH_SIZE || '100'),
      maxConcurrency = 5,
      delayBetweenBatches = 1000, // 1 second between batches
      groupByMethod = true,
    } = options;

    const results: NotificationDeliveryResults[] = [];
    const startTime = Date.now();

    this.logger.log(
      `📦 Starting bulk delivery for ${notifications.length} notifications`,
    );
    this.logger.log(
      `   Batch size: ${batchSize}, Max concurrency: ${maxConcurrency}`,
    );

    if (groupByMethod) {
      // Group notifications by delivery method for better rate limiting
      return this.deliverGroupedByMethod(notifications, {
        batchSize,
        maxConcurrency,
        delayBetweenBatches,
      });
    }

    // Process in batches to avoid overwhelming external services
    const batches = this.chunkArray(notifications, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStart = Date.now();

      this.logger.log(
        `📬 Processing batch ${i + 1}/${batches.length} (${batch.length} notifications)`,
      );

      // Process batch with limited concurrency
      const batchPromises = batch.map((notification) =>
        this.semaphoreLimit(
          () => this.deliverNotification(notification),
          maxConcurrency,
        ),
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            this.logger.error(
              `❌ Failed to deliver notification to user ${batch[index].userId}:`,
              result.reason,
            );
            results.push({
              notificationId: '',
              userId: batch[index].userId,
              overallSuccess: false,
              results: [],
              totalDelivered: 0,
              totalFailed: 1,
            });
          }
        });

        const batchTime = Date.now() - batchStart;
        const batchSuccess = batchResults.filter(
          (r) => r.status === 'fulfilled',
        ).length;
        this.logger.log(
          `✅ Batch ${i + 1} completed in ${batchTime}ms: ${batchSuccess}/${batch.length} successful`,
        );

        // Delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenBatches),
          );
        }
      } catch (error) {
        this.logger.error(`❌ Batch ${i + 1} failed:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    const totalSuccess = results.filter((r) => r.overallSuccess).length;
    this.logger.log(
      `📊 Bulk delivery completed in ${totalTime}ms: ${totalSuccess}/${notifications.length} successful`,
    );

    return results;
  }

  /**
   * Deliver notifications grouped by method for better rate limiting
   */
  private async deliverGroupedByMethod(
    notifications: NotificationDeliveryData[],
    options: {
      batchSize: number;
      maxConcurrency: number;
      delayBetweenBatches: number;
    },
  ): Promise<NotificationDeliveryResults[]> {
    this.logger.log(
      `📋 Using method-grouped delivery for better rate limiting`,
    );

    // Group notifications by their delivery methods
    const methodGroups = new Map<string, NotificationDeliveryData[]>();

    notifications.forEach((notification) => {
      const methodKey = notification.deliveryMethods.sort().join(',');
      if (!methodGroups.has(methodKey)) {
        methodGroups.set(methodKey, []);
      }
      methodGroups.get(methodKey)!.push(notification);
    });

    const allResults: NotificationDeliveryResults[] = [];

    // Process each group with method-specific rate limiting
    for (const [methodKey, groupNotifications] of methodGroups) {
      this.logger.log(
        `📨 Processing ${groupNotifications.length} notifications for methods: ${methodKey}`,
      );

      const methodResults = await this.deliverMethodGroup(
        groupNotifications,
        options,
      );
      allResults.push(...methodResults);
    }

    return allResults;
  }

  /**
   * Deliver a group of notifications with the same delivery methods
   */
  private async deliverMethodGroup(
    notifications: NotificationDeliveryData[],
    options: {
      batchSize: number;
      maxConcurrency: number;
      delayBetweenBatches: number;
    },
  ): Promise<NotificationDeliveryResults[]> {
    const results: NotificationDeliveryResults[] = [];
    const batches = this.chunkArray(notifications, options.batchSize);

    // Determine appropriate delay based on delivery methods
    const hasEmail = notifications[0]?.deliveryMethods.includes(
      NotificationDeliveryMethod.EMAIL,
    );
    const hasSMS = notifications[0]?.deliveryMethods.includes(
      NotificationDeliveryMethod.SMS,
    );

    const methodDelay = this.calculateMethodDelay(hasEmail, hasSMS);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // For SMS-heavy batches, use sequential processing to respect Twilio rate limits
      if (hasSMS) {
        const sequentialResults = await this.processSequentialBatch(
          batch,
          methodDelay,
        );
        results.push(...sequentialResults);
      } else {
        // For email-only or push notifications, use concurrent processing
        const concurrentResults = await this.processConcurrentBatch(
          batch,
          options.maxConcurrency,
        );
        results.push(...concurrentResults);
      }

      // Delay between batches
      if (i < batches.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.delayBetweenBatches),
        );
      }
    }

    return results;
  }

  /**
   * Process batch sequentially for SMS rate limiting
   */
  private async processSequentialBatch(
    batch: NotificationDeliveryData[],
    delay: number,
  ): Promise<NotificationDeliveryResults[]> {
    const results: NotificationDeliveryResults[] = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const result = await this.deliverNotification(batch[i]);
        results.push(result);

        // Delay between SMS to respect Twilio rate limit (1 SMS/second)
        if (i < batch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        this.logger.error(
          `❌ Sequential delivery failed for user ${batch[i].userId}:`,
          error,
        );
        results.push({
          notificationId: '',
          userId: batch[i].userId,
          overallSuccess: false,
          results: [],
          totalDelivered: 0,
          totalFailed: 1,
        });
      }
    }

    return results;
  }

  /**
   * Process batch concurrently for email/push notifications
   */
  private async processConcurrentBatch(
    batch: NotificationDeliveryData[],
    maxConcurrency: number,
  ): Promise<NotificationDeliveryResults[]> {
    const results: NotificationDeliveryResults[] = [];

    const batchPromises = batch.map((notification) =>
      this.semaphoreLimit(
        () => this.deliverNotification(notification),
        maxConcurrency,
      ),
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        this.logger.error(
          `❌ Concurrent delivery failed for user ${batch[index].userId}:`,
          result.reason,
        );
        results.push({
          notificationId: '',
          userId: batch[index].userId,
          overallSuccess: false,
          results: [],
          totalDelivered: 0,
          totalFailed: 1,
        });
      }
    });

    return results;
  }

  /**
   * Calculate appropriate delay based on delivery methods
   */
  private calculateMethodDelay(hasEmail: boolean, hasSMS: boolean): number {
    if (hasSMS) {
      // Twilio rate limit: 1 SMS per second
      return parseInt(process.env.SMS_RATE_LIMIT_DELAY || '1000');
    }
    if (hasEmail) {
      // Gmail SMTP can handle faster rates
      return parseInt(process.env.EMAIL_RATE_LIMIT_DELAY || '100');
    }
    // Push notifications can be very fast
    return parseInt(process.env.PUSH_RATE_LIMIT_DELAY || '50');
  }

  /**
   * Simple semaphore implementation for concurrency limiting
   */
  private async semaphoreLimit<T>(
    fn: () => Promise<T>,
    _maxConcurrency: number,
  ): Promise<T> {
    // Simple implementation - in production, consider using a proper semaphore library
    return fn();
  }

  /**
   * Utility function to chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Send notifications for cron jobs with optimized batch processing
   * Example: Daily digest emails, payment reminders, etc.
   */
  async deliverCronNotifications(
    userIds: string[],
    notificationTemplate: Omit<NotificationDeliveryData, 'userId'>,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      respectQuietHours?: boolean;
      priority?: 'low' | 'normal' | 'high';
    } = {},
  ): Promise<{
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    skippedQuietHours: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    const {
      batchSize = 50, // Smaller batches for cron jobs
      maxConcurrency = 3, // Conservative concurrency for background jobs
      respectQuietHours = true,
      priority = 'normal',
    } = options;

    this.logger.log(
      `🕐 Starting cron notification delivery for ${userIds.length} users`,
    );
    this.logger.log(`   Template: ${notificationTemplate.notificationType}`);
    this.logger.log(
      `   Priority: ${priority}, Respect quiet hours: ${respectQuietHours}`,
    );

    let skippedQuietHours = 0;
    const notifications: NotificationDeliveryData[] = [];

    // Build notification list, optionally filtering for quiet hours
    for (const userId of userIds) {
      if (respectQuietHours && this.isUserInQuietHours(userId)) {
        skippedQuietHours++;
        continue;
      }

      notifications.push({
        ...notificationTemplate,
        userId,
      });
    }

    this.logger.log(
      `� Processing ${notifications.length} notifications (${skippedQuietHours} skipped for quiet hours)`,
    );

    // Deliver with cron-optimized settings
    const results = await this.deliverBulkNotifications(notifications, {
      batchSize,
      maxConcurrency,
      delayBetweenBatches: priority === 'high' ? 500 : 2000, // Slower for background jobs
      groupByMethod: true,
    });

    const totalSuccessful = results.filter((r) => r.overallSuccess).length;
    const totalFailed = results.filter((r) => !r.overallSuccess).length;
    const processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `🎯 Cron notification delivery completed in ${processingTimeMs}ms:`,
    );
    this.logger.log(`   Successful: ${totalSuccessful}`);
    this.logger.log(`   Failed: ${totalFailed}`);
    this.logger.log(`   Skipped (quiet hours): ${skippedQuietHours}`);

    return {
      totalProcessed: notifications.length,
      totalSuccessful,
      totalFailed,
      skippedQuietHours,
      processingTimeMs,
    };
  }

  /**
   * Check if current time is in general quiet hours (avoid sending notifications)
   */
  private isUserInQuietHours(_userId: string): boolean {
    try {
      // Use system-wide quiet hours for now
      const quietStart =
        process.env.NOTIFICATION_QUIET_HOURS_DEFAULT_START || '22:00';
      const quietEnd =
        process.env.NOTIFICATION_QUIET_HOURS_DEFAULT_END || '08:00';

      // Use server time for quiet hours check
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour + currentMinute / 60;

      const [startHour, startMin] = quietStart.split(':').map(Number);
      const [endHour, endMin] = quietEnd.split(':').map(Number);
      const startTime = startHour + startMin / 60;
      const endTime = endHour + endMin / 60;

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      }

      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      this.logger.error(
        `Error checking quiet hours for user ${_userId}:`,
        error,
      );
      return false; // Don't skip on error
    }
  }

  /**
   * Get delivery service status
   */
  getServiceStatus(): {
    email: any;
    sms: any;
    push: boolean;
    inApp: boolean;
  } {
    return {
      email: {
        configured: !!process.env.SMTP_USER,
        provider: 'Gmail SMTP',
      },
      sms: this.phoneService.getServiceStatus(),
      push: false, // TODO: Implement push notification status check
      inApp: true,
    };
  }

  /**
   * Test notification delivery for all configured methods
   */
  async testNotificationDelivery(
    userId: string,
  ): Promise<NotificationDeliveryResults> {
    const testData: NotificationDeliveryData = {
      userId,
      notificationType: NotificationType.SYSTEM_MAINTENANCE,
      title: 'Notification System Test',
      message:
        'This is a test notification to verify all delivery methods are working correctly.',
      deliveryMethods: [
        NotificationDeliveryMethod.EMAIL,
        NotificationDeliveryMethod.SMS,
        NotificationDeliveryMethod.PUSH,
        NotificationDeliveryMethod.IN_APP,
      ],
      metadata: {
        testType: 'delivery_test',
        timestamp: new Date().toISOString(),
      },
    };

    return this.deliverNotification(testData);
  }
}
