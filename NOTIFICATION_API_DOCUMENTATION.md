# Notification Configuration API Documentation

This document describes the notification configuration endpoints available in the CrowdProp backend API. These endpoints allow users to manage their notification preferences and settings.

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Notification Preferences Endpoints](#notification-preferences-endpoints)
5. [Notification Settings Endpoints](#notification-settings-endpoints)
6. [Request/Response Examples](#requestresponse-examples)
7. [Error Handling](#error-handling)
8. [Notification Types](#notification-types)
9. [Frontend Integration Examples](#frontend-integration-examples)

## Overview

The notification system supports multiple delivery channels:

- **Email** - Gmail SMTP integration
- **SMS** - Twilio integration with real phone number
- **Push** - Firebase Cloud Messaging (development mode)
- **In-App** - Database-stored notifications

Users can configure preferences for each notification type and delivery method, set quiet hours, and manage global notification settings.

## Base URL

```
http://localhost:3000/api/user
```

## Authentication

All endpoints require user authentication. Include the appropriate authentication headers in your requests.

## Notification Preferences Endpoints

### 1. Get User Notification Preferences

Retrieves all notification preferences for a user. Creates default preferences if none exist.

**Endpoint:** `GET /:userId/notifications/preferences`

**Parameters:**

- `userId` (string, required) - User ID

**Response:**

```json
{
  "success": true,
  "preferences": [
    {
      "id": "pref-uuid",
      "userId": "user-uuid",
      "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
      "emailEnabled": true,
      "smsEnabled": false,
      "pushEnabled": true,
      "inAppEnabled": true,
      "createdAt": "2025-08-14T10:00:00Z",
      "updatedAt": "2025-08-14T10:00:00Z"
    }
  ],
  "message": "Notification preferences retrieved successfully"
}
```

### 2. Update Single Notification Preference

Updates preference settings for a specific notification type.

**Endpoint:** `PUT /:userId/notifications/preferences`

**Parameters:**

- `userId` (string, required) - User ID

**Request Body:**

```json
{
  "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
  "emailEnabled": true,
  "smsEnabled": false,
  "pushEnabled": true,
  "inAppEnabled": true
}
```

**Response:**

```json
{
  "success": true,
  "preference": {
    "id": "pref-uuid",
    "userId": "user-uuid",
    "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
    "emailEnabled": true,
    "smsEnabled": false,
    "pushEnabled": true,
    "inAppEnabled": true,
    "createdAt": "2025-08-14T10:00:00Z",
    "updatedAt": "2025-08-14T10:30:00Z"
  },
  "message": "Notification preference updated successfully"
}
```

### 3. Update Multiple Notification Preferences (Bulk)

Updates multiple notification preferences in a single request.

**Endpoint:** `PUT /:userId/notifications/preferences/bulk`

**Parameters:**

- `userId` (string, required) - User ID

**Request Body:**

```json
{
  "preferences": [
    {
      "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
      "emailEnabled": true,
      "smsEnabled": false
    },
    {
      "notificationType": "PAYMENT_RECEIVED",
      "emailEnabled": true,
      "smsEnabled": true,
      "pushEnabled": true
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "preferences": [
    {
      "id": "pref-uuid-1",
      "userId": "user-uuid",
      "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
      "emailEnabled": true,
      "smsEnabled": false,
      "pushEnabled": true,
      "inAppEnabled": true,
      "createdAt": "2025-08-14T10:00:00Z",
      "updatedAt": "2025-08-14T10:45:00Z"
    },
    {
      "id": "pref-uuid-2",
      "userId": "user-uuid",
      "notificationType": "PAYMENT_RECEIVED",
      "emailEnabled": true,
      "smsEnabled": true,
      "pushEnabled": true,
      "inAppEnabled": true,
      "createdAt": "2025-08-14T10:00:00Z",
      "updatedAt": "2025-08-14T10:45:00Z"
    }
  ],
  "message": "Notification preferences updated successfully"
}
```

### 4. Reset Notification Preferences

Resets all notification preferences to default values.

**Endpoint:** `POST /:userId/notifications/preferences/reset`

**Parameters:**

- `userId` (string, required) - User ID

**Response:**

```json
{
  "success": true,
  "preferences": [
    // Array of all preferences with default values
  ],
  "message": "Notification preferences reset to default values"
}
```

## Notification Settings Endpoints

### 5. Get User Notification Settings

Retrieves user's general notification settings (quiet hours, global toggles, etc.).

**Endpoint:** `GET /:userId/notifications/settings`

**Parameters:**

- `userId` (string, required) - User ID

**Response:**

```json
{
  "success": true,
  "settings": {
    "emailNotificationsEnabled": true,
    "pushToken": "fcm-device-token",
    "timezone": "America/Toronto",
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  },
  "message": "Notification settings retrieved successfully"
}
```

### 6. Update User Notification Settings

Updates user's general notification settings.

**Endpoint:** `PUT /:userId/notifications/settings`

**Parameters:**

- `userId` (string, required) - User ID

**Request Body:**

```json
{
  "emailNotificationsEnabled": true,
  "pushToken": "new-fcm-device-token",
  "timezone": "America/New_York",
  "quietHoursStart": "23:00",
  "quietHoursEnd": "07:00"
}
```

**Response:**

```json
{
  "success": true,
  "settings": {
    "emailNotificationsEnabled": true,
    "pushToken": "new-fcm-device-token",
    "timezone": "America/New_York",
    "quietHoursStart": "23:00",
    "quietHoursEnd": "07:00"
  },
  "message": "Notification settings updated successfully"
}
```

## Request/Response Examples

### cURL Examples

#### Get notification preferences:

```bash
curl -X GET \
  "http://localhost:3000/api/user/user-123/notifications/preferences" \
  -H "Authorization: Bearer your-jwt-token"
```

#### Update single preference:

```bash
curl -X PUT \
  "http://localhost:3000/api/user/user-123/notifications/preferences" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "notificationType": "CAMPAIGN_APPLICATION_RECEIVED",
    "emailEnabled": true,
    "smsEnabled": false,
    "pushEnabled": true
  }'
```

#### Update notification settings:

```bash
curl -X PUT \
  "http://localhost:3000/api/user/user-123/notifications/settings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "timezone": "America/Toronto"
  }'
```

## Error Handling

All endpoints return consistent error responses:

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "User ID is required",
  "error": "Bad Request"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### Common Validation Errors

- `User ID is required` - Missing or empty userId parameter
- `Notification type is required` - Missing notificationType in request body
- `Quiet hours start must be in HH:MM format` - Invalid time format
- `Preferences array is required and must not be empty` - Invalid bulk update data

## Notification Types

The system supports the following notification types:

### Campaign Related

- `CAMPAIGN_APPLICATION_RECEIVED` - When someone applies to your campaign
- `CAMPAIGN_APPLICATION_ACCEPTED` - When your application is accepted
- `CAMPAIGN_APPLICATION_REJECTED` - When your application is rejected
- `CAMPAIGN_CREATED` - When a new campaign is created
- `CAMPAIGN_UPDATED` - When campaign details are updated
- `CAMPAIGN_COMPLETED` - When a campaign is completed
- `CAMPAIGN_CANCELLED` - When a campaign is cancelled
- `CAMPAIGN_DEADLINE_REMINDER` - Reminder about upcoming deadlines

### Payment Related

- `PAYMENT_RECEIVED` - When you receive a payment
- `PAYMENT_FAILED` - When a payment fails
- `PAYOUT_PROCESSED` - When your payout is processed
- `PAYOUT_FAILED` - When a payout fails
- `PAYMENT_REMINDER` - Payment due reminders

### Communication

- `MESSAGE_RECEIVED` - When you receive a new message
- `MEETING_SCHEDULED` - When a meeting is scheduled
- `MEETING_REMINDER` - Meeting time reminders
- `MEETING_CANCELLED` - When a meeting is cancelled

### Account Related

- `ACCOUNT_VERIFIED` - When your account is verified
- `ACCOUNT_VERIFICATION_REQUIRED` - When verification is needed
- `SECURITY_ALERT` - Security-related notifications
- `PROFILE_UPDATE_REQUIRED` - When profile updates are needed

### System

- `SYSTEM_MAINTENANCE` - System maintenance notifications
- `FEATURE_ANNOUNCEMENT` - New feature announcements
- `POLICY_UPDATE` - Policy or terms updates
- `DAILY_DIGEST` - Daily summary emails

## Frontend Integration Examples

### React/JavaScript Example

```javascript
// Notification preferences service
class NotificationService {
  constructor(baseURL, authToken) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  async getPreferences(userId) {
    const response = await fetch(
      `${this.baseURL}/user/${userId}/notifications/preferences`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      },
    );
    return response.json();
  }

  async updatePreference(userId, preference) {
    const response = await fetch(
      `${this.baseURL}/user/${userId}/notifications/preferences`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(preference),
      },
    );
    return response.json();
  }

  async updateSettings(userId, settings) {
    const response = await fetch(
      `${this.baseURL}/user/${userId}/notifications/settings`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(settings),
      },
    );
    return response.json();
  }

  async resetPreferences(userId) {
    const response = await fetch(
      `${this.baseURL}/user/${userId}/notifications/preferences/reset`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      },
    );
    return response.json();
  }
}

// Usage example
const notificationService = new NotificationService(
  'http://localhost:3000/api',
  'your-jwt-token',
);

// Get user preferences
const preferences = await notificationService.getPreferences('user-123');

// Update a specific preference
await notificationService.updatePreference('user-123', {
  notificationType: 'CAMPAIGN_APPLICATION_RECEIVED',
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
});

// Update quiet hours
await notificationService.updateSettings('user-123', {
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'America/Toronto',
});
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const NotificationSettings = ({ userId, authToken }) => {
  const [preferences, setPreferences] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotificationData();
  }, [userId]);

  const loadNotificationData = async () => {
    try {
      setLoading(true);

      // Load preferences and settings
      const [prefsRes, settingsRes] = await Promise.all([
        fetch(`/api/user/${userId}/notifications/preferences`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`/api/user/${userId}/notifications/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const prefsData = await prefsRes.json();
      const settingsData = await settingsRes.json();

      setPreferences(prefsData.preferences);
      setSettings(settingsData.settings);
    } catch (error) {
      console.error('Failed to load notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (notificationType, field, value) => {
    try {
      const response = await fetch(
        `/api/user/${userId}/notifications/preferences`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            notificationType,
            [field]: value,
          }),
        },
      );

      if (response.ok) {
        // Reload preferences
        loadNotificationData();
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
    }
  };

  const updateQuietHours = async (start, end) => {
    try {
      const response = await fetch(
        `/api/user/${userId}/notifications/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            quietHoursStart: start,
            quietHoursEnd: end,
          }),
        },
      );

      if (response.ok) {
        loadNotificationData();
      }
    } catch (error) {
      console.error('Failed to update quiet hours:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="notification-settings">
      <h2>Notification Preferences</h2>

      {/* Quiet Hours */}
      <div className="settings-section">
        <h3>Quiet Hours</h3>
        <p>No notifications will be sent during these hours</p>
        <input
          type="time"
          value={settings.quietHoursStart || '22:00'}
          onChange={(e) =>
            updateQuietHours(e.target.value, settings.quietHoursEnd)
          }
        />
        <span> to </span>
        <input
          type="time"
          value={settings.quietHoursEnd || '08:00'}
          onChange={(e) =>
            updateQuietHours(settings.quietHoursStart, e.target.value)
          }
        />
      </div>

      {/* Notification Preferences */}
      <div className="preferences-section">
        <h3>Notification Types</h3>
        {preferences.map((pref) => (
          <div key={pref.id} className="preference-row">
            <div className="notification-type">
              {pref.notificationType.replace(/_/g, ' ')}
            </div>
            <div className="delivery-methods">
              <label>
                <input
                  type="checkbox"
                  checked={pref.emailEnabled}
                  onChange={(e) =>
                    updatePreference(
                      pref.notificationType,
                      'emailEnabled',
                      e.target.checked,
                    )
                  }
                />
                Email
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={pref.smsEnabled}
                  onChange={(e) =>
                    updatePreference(
                      pref.notificationType,
                      'smsEnabled',
                      e.target.checked,
                    )
                  }
                />
                SMS
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={pref.pushEnabled}
                  onChange={(e) =>
                    updatePreference(
                      pref.notificationType,
                      'pushEnabled',
                      e.target.checked,
                    )
                  }
                />
                Push
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSettings;
```

## Notes

- All notification preferences are created with default values when a user is first created
- Email notifications are enabled by default for important notifications
- SMS notifications are disabled by default (users must opt-in)
- Push notifications are enabled by default
- In-app notifications are always enabled
- Quiet hours are respected for all cron-based notifications
- The system handles rate limiting automatically (1 SMS/second for Twilio)
- All timestamps are in ISO 8601 format
- Timezone support is available for quiet hours calculation

## Production Considerations

1. **Rate Limiting**: Implement rate limiting on these endpoints to prevent abuse
2. **Caching**: Consider caching notification preferences for better performance
3. **Webhooks**: Implement webhooks for real-time preference updates
4. **Analytics**: Track preference changes for insights
5. **Validation**: Add client-side validation for better user experience
6. **Internationalization**: Support multiple languages for notification types
