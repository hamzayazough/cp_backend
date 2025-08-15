import { NotificationType } from '../../enums/notification-type';
import { NotificationDeliveryMethod } from '../../enums/notification-delivery-method';

export class NotificationDto {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  campaignId?: string;
  conversationId?: string;
  meetingId?: string;
  paymentId?: string;
  deliveryMethods: NotificationDeliveryMethod[];
  emailSentAt?: Date;
  smsSentAt?: Date;
  pushSentAt?: Date;
  inAppSentAt: Date;
  readAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
  isUnread: boolean;
  isExpired: boolean;
}

export class NotificationPreferenceDto {
  id: string;
  userId: string;
  notificationType: NotificationType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UnreadNotificationCountDto {
  userId: string;
  unreadCount: number;
  unreadPaymentCount: number;
  unreadCampaignCount: number;
  unreadMessageCount: number;
}
