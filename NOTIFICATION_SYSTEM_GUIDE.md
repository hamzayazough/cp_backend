# Notification System Implementation Guide

## Overview

This notification system provides a comprehensive solution for managing user notifications across multiple channels (email, SMS, push, in-app) with granular user preferences.

## Database Structure

### Core Tables

1. **`user_notification_preferences`** - Stores user preferences for each notification type
2. **`notifications`** - Stores all notifications sent to users
3. **`notification_templates`** - Template system for consistent messaging
4. **`notification_settings`** - Global system settings

### Key Features

- **Granular Control**: Users can enable/disable each notification type per delivery method
- **Multi-Channel Delivery**: Email, SMS, Push, and In-App notifications
- **Template System**: Consistent messaging with variable substitution
- **Read/Interaction Tracking**: Track when notifications are read, clicked, or dismissed
- **Expiration Support**: Time-sensitive notifications that auto-expire
- **Quiet Hours**: Respect user's preferred notification times
- **Phone Verification**: Ensure SMS can only be sent to verified numbers

## Implementation Steps

### 1. Database Migration

Run the notification system SQL file:

```sql
-- Run this in your database
\i database/11_notification_system.sql
```

### 2. Backend Implementation

#### Service Structure

```typescript
// notification.service.ts
@Injectable()
export class NotificationService {
  async createNotification(params: CreateNotificationParams): Promise<string>;
  async getUserPreferences(userId: string): Promise<NotificationPreference[]>;
  async updateUserPreference(
    userId: string,
    type: NotificationType,
    preferences: PreferenceUpdate,
  ): Promise<void>;
  async markAsRead(notificationId: string): Promise<void>;
  async getUnreadCount(userId: string): Promise<UnreadCounts>;
  async getUserNotifications(
    userId: string,
    pagination: PaginationParams,
  ): Promise<Notification[]>;
}

// notification-delivery.service.ts
@Injectable()
export class NotificationDeliveryService {
  async sendEmail(notification: Notification): Promise<void>;
  async sendSMS(notification: Notification): Promise<void>;
  async sendPush(notification: Notification): Promise<void>;
  async sendInApp(notification: Notification): Promise<void>;
}

// notification-template.service.ts
@Injectable()
export class NotificationTemplateService {
  async renderTemplate(
    type: NotificationType,
    variables: Record<string, any>,
  ): Promise<RenderedTemplate>;
  async getTemplate(type: NotificationType): Promise<NotificationTemplate>;
}
```

#### Event-Driven Architecture

```typescript
// Use EventEmitter2 for decoupled notification triggering
@Injectable()
export class CampaignService {
  constructor(private eventEmitter: EventEmitter2) {}

  async approveApplication(campaignId: string, promoterId: string) {
    // ... business logic

    // Trigger notification
    this.eventEmitter.emit('campaign.application.approved', {
      campaignId,
      promoterId,
      advertiserId: campaign.advertiserId
    });
  }
}

@OnEvent('campaign.application.approved')
async handleApplicationApproved(payload: any) {
  await this.notificationService.createNotification({
    userId: payload.promoterId,
    type: 'CAMPAIGN_APPLICATION_ACCEPTED',
    title: 'Application Approved!',
    message: `Your application for "${campaign.title}" has been approved.`,
    campaignId: payload.campaignId
  });
}
```

### 3. Frontend Implementation

#### Notification Preferences UI

```typescript
// User can toggle preferences for each notification type
interface NotificationPreference {
  type: NotificationType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

// Component for managing preferences
const NotificationSettings = () => {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);

  const updatePreference = async (type: NotificationType, method: string, enabled: boolean) => {
    await api.updateNotificationPreference(type, method, enabled);
    // Update local state
  };

  return (
    <div>
      {preferences.map(pref => (
        <NotificationPreferenceRow
          key={pref.type}
          preference={pref}
          onUpdate={updatePreference}
        />
      ))}
    </div>
  );
};
```

#### Real-time Notifications

```typescript
// WebSocket for real-time in-app notifications
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const socket = io('/notifications');

    socket.on('new-notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => socket.disconnect();
  }, []);

  return { notifications, unreadCount };
};
```

### 4. Integration Points

#### Campaign Events

- Application received/accepted/rejected
- Work submitted/approved/rejected
- Campaign details changed
- Campaign ending soon/ended

#### Payment Events

- Payment received/sent/failed
- Payout processed
- Stripe account issues

#### Messaging Events

- New message/conversation
- Meeting scheduled/reminder

### 5. Configuration Examples

#### Default Notification Templates

```sql
INSERT INTO notification_templates (notification_type, email_subject_template, email_body_template, push_title_template, push_body_template) VALUES
('CAMPAIGN_APPLICATION_ACCEPTED',
 'Application Approved - {{campaign_title}}',
 'Congratulations! Your application for "{{campaign_title}}" has been approved. You can now start working on this campaign.',
 'Application Approved!',
 'Your application for "{{campaign_title}}" has been approved'
),
('PAYMENT_RECEIVED',
 'Payment Received - ${{amount}}',
 'You have received a payment of ${{amount}} for {{description}}.',
 'Payment Received',
 'You received ${{amount}}'
);
```

#### User Preferences API

```typescript
// GET /api/notifications/preferences
// Response: Array of user preferences

// PUT /api/notifications/preferences
// Body: { type: string, emailEnabled: boolean, smsEnabled: boolean, ... }

// GET /api/notifications
// Query: ?page=1&limit=20&unreadOnly=true
// Response: Paginated notifications

// POST /api/notifications/:id/read
// Mark notification as read

// POST /api/notifications/:id/dismiss
// Dismiss notification
```

## Best Practices

1. **Rate Limiting**: Implement daily limits per user to prevent spam
2. **Batching**: Group similar notifications (e.g., multiple new messages)
3. **Quiet Hours**: Respect user's timezone and quiet hours for non-urgent notifications
4. **A/B Testing**: Test different templates and delivery methods
5. **Analytics**: Track delivery rates, read rates, and user engagement
6. **Fallback**: If primary delivery method fails, try alternative methods
7. **Unsubscribe**: Always provide easy unsubscribe options for emails

## Security Considerations

1. **Phone Verification**: Only send SMS to verified phone numbers
2. **Rate Limiting**: Prevent notification spam
3. **Data Privacy**: Allow users to delete their notification history
4. **Encryption**: Encrypt sensitive notification content
5. **Audit Trail**: Log all notification activities for debugging

## Monitoring and Analytics

Track these metrics:

- Delivery success rates per channel
- Read rates per notification type
- User engagement with notifications
- Opt-out rates
- Performance metrics (delivery time, queue size)

This system provides a solid foundation that can scale with your application's growth!
