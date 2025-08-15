import { NotificationType } from '../enums/notification-type';

/**
 * Interface for notification preference data
 */
export interface NotificationPreference {
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

/**
 * DTO for updating a single notification preference
 */
export interface UpdateNotificationPreferenceDto {
  notificationType: NotificationType;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
}

/**
 * DTO for updating multiple notification preferences
 */
export interface UpdateMultipleNotificationPreferencesDto {
  preferences: UpdateNotificationPreferenceDto[];
}

/**
 * Interface for user notification settings (global settings)
 */
export interface UserNotificationSettings {
  emailNotificationsEnabled: boolean;
  pushToken?: string;
  timezone: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * DTO for updating user notification settings
 */
export interface UpdateNotificationSettingsDto {
  emailNotificationsEnabled?: boolean;
  pushToken?: string;
  timezone?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * API Response types for notification endpoints
 */
export interface NotificationPreferencesResponse {
  success: boolean;
  preferences: NotificationPreference[];
  message?: string;
}

export interface NotificationPreferenceResponse {
  success: boolean;
  preference: NotificationPreference;
  message?: string;
}

export interface NotificationSettingsResponse {
  success: boolean;
  settings: UserNotificationSettings;
  message?: string;
}
