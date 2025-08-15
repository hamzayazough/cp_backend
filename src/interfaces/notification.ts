import { NotificationType } from '../enums/notification-type';
import { NotificationDeliveryMethod } from '../enums/notification-delivery-method';

export interface CreateNotificationParams {
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  campaignId?: string;
  conversationId?: string;
  meetingId?: string;
  paymentId?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

export interface NotificationDeliveryOptions {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  inApp?: boolean;
}

export interface NotificationTemplate {
  notificationType: NotificationType;
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
  smsTemplate?: string;
  pushTitleTemplate?: string;
  pushBodyTemplate?: string;
  inAppTitleTemplate?: string;
  inAppBodyTemplate?: string;
  templateVariables?: string[];
}

export interface RenderedTemplate {
  emailSubject?: string;
  emailBody?: string;
  smsMessage?: string;
  pushTitle?: string;
  pushBody?: string;
  inAppTitle?: string;
  inAppBody?: string;
}

export interface NotificationDeliveryResult {
  success: boolean;
  method: NotificationDeliveryMethod;
  sentAt?: Date;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export interface UnreadCounts {
  total: number;
  payment: number;
  campaign: number;
  message: number;
}
