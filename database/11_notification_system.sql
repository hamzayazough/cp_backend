-- ========================================
-- NOTIFICATION SYSTEM TABLES
-- ========================================
-- This file contains tables for comprehensive notification management

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
    -- Campaign related
    'CAMPAIGN_APPLICATION_RECEIVED',     -- Advertiser: when someone applies to campaign
    'CAMPAIGN_APPLICATION_ACCEPTED',     -- Promoter: when application is accepted
    'CAMPAIGN_APPLICATION_REJECTED',     -- Promoter: when application is rejected
    'CAMPAIGN_WORK_SUBMITTED',          -- Advertiser: when promoter submits work
    'CAMPAIGN_WORK_APPROVED',           -- Promoter: when work is approved
    'CAMPAIGN_WORK_REJECTED',           -- Promoter: when work is rejected
    'CAMPAIGN_DETAILS_CHANGED',         -- Promoter: when campaign details change
    'CAMPAIGN_ENDING_SOON',             -- Both: reminder before campaign ends
    'CAMPAIGN_ENDED',                   -- Both: when campaign officially ends
    'CAMPAIGN_BUDGET_INCREASED',        -- Promoter: when max budget is upgraded
    'CAMPAIGN_DEADLINE_EXTENDED',       -- Promoter: when deadline is extended
    
    -- Payment related
    'PAYMENT_RECEIVED',                 -- Both: when payment is received
    'PAYMENT_SENT',                     -- Both: when payment is sent
    'PAYMENT_FAILED',                   -- Both: when payment fails
    'PAYOUT_PROCESSED',                 -- Both: when payout is processed
    'STRIPE_ACCOUNT_VERIFIED',          -- Both: when Stripe account is verified
    'STRIPE_ACCOUNT_ISSUE',             -- Both: when there's a Stripe account issue
    'WALLET_BALANCE_LOW',               -- Both: when wallet balance is low
    
    -- Messaging related
    'NEW_MESSAGE',                      -- Both: when receiving a new message
    'NEW_CONVERSATION',                 -- Both: when a new conversation starts
    
    -- Meeting related
    'MEETING_SCHEDULED',                -- Both: when meeting is scheduled
    'MEETING_REMINDER',                 -- Both: reminder before meeting
    'MEETING_CANCELLED',                -- Both: when meeting is cancelled
    'MEETING_RESCHEDULED',              -- Both: when meeting is rescheduled
    
    -- Account related
    'ACCOUNT_VERIFICATION_REQUIRED',    -- Both: when verification is needed
    'ACCOUNT_VERIFIED',                 -- Both: when account is verified
    'PROFILE_INCOMPLETE',               -- Both: reminder to complete profile
    
    -- System related
    'SYSTEM_MAINTENANCE',               -- Both: system maintenance notifications
    'FEATURE_ANNOUNCEMENT',             -- Both: new feature announcements
    'SECURITY_ALERT'                    -- Both: security-related alerts
);

-- Notification delivery methods enum
CREATE TYPE notification_delivery_method AS ENUM (
    'EMAIL',
    'SMS',
    'PUSH',
    'IN_APP'
);

-- User notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_notification_type UNIQUE(user_id, notification_type)
);

-- Notifications table (stores actual notifications sent to users)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entity references (nullable, depending on notification type)
    campaign_id UUID, -- References campaigns table when applicable
    conversation_id UUID, -- References conversations table when applicable
    meeting_id UUID, -- References meetings table when applicable
    payment_id UUID, -- References payments table when applicable
    
    -- Delivery tracking
    delivery_methods notification_delivery_method[] DEFAULT '{}', -- Array of delivery methods used
    email_sent_at TIMESTAMP WITH TIME ZONE,
    sms_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent_at TIMESTAMP WITH TIME ZONE,
    in_app_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- User interaction
    read_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB, -- Additional data specific to notification type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- Optional expiration for time-sensitive notifications
);

-- Notification templates table (for consistent messaging)
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type notification_type UNIQUE NOT NULL,
    email_subject_template TEXT,
    email_body_template TEXT,
    sms_template TEXT,
    push_title_template TEXT,
    push_body_template TEXT,
    in_app_title_template TEXT,
    in_app_body_template TEXT,
    
    -- Template variables documentation
    template_variables JSONB, -- JSON array of available variables for this template
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Global notification settings (system-wide toggles)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default global settings
INSERT INTO notification_settings (setting_key, setting_value, description) VALUES
    ('email_notifications_enabled', 'true', 'Global toggle for email notifications'),
    ('sms_notifications_enabled', 'true', 'Global toggle for SMS notifications'),
    ('push_notifications_enabled', 'true', 'Global toggle for push notifications'),
    ('maintenance_mode', 'false', 'When true, only critical notifications are sent'),
    ('max_notifications_per_user_per_day', '50', 'Maximum notifications per user per day'),
    ('notification_retry_attempts', '3', 'Number of retry attempts for failed notifications')
ON CONFLICT (setting_key) DO NOTHING;

-- Create indexes for the notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications (read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications (expires_at);

-- Function to send notification (to be called by application)
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_notification_type notification_type,
    p_title VARCHAR(255),
    p_message TEXT,
    p_campaign_id UUID DEFAULT NULL,
    p_conversation_id UUID DEFAULT NULL,
    p_meeting_id UUID DEFAULT NULL,
    p_payment_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_prefs RECORD;
    delivery_methods notification_delivery_method[] := '{}';
BEGIN
    -- Get user preferences for this notification type
    SELECT * INTO user_prefs
    FROM user_notification_preferences
    WHERE user_id = p_user_id AND notification_type = p_notification_type;
    
    -- If no preferences found, create default ones
    IF NOT FOUND THEN
        INSERT INTO user_notification_preferences (user_id, notification_type)
        VALUES (p_user_id, p_notification_type);
        
        SELECT * INTO user_prefs
        FROM user_notification_preferences
        WHERE user_id = p_user_id AND notification_type = p_notification_type;
    END IF;
    
    -- Determine delivery methods based on preferences
    IF user_prefs.email_enabled THEN
        delivery_methods := array_append(delivery_methods, 'EMAIL');
    END IF;
    
    IF user_prefs.sms_enabled THEN
        delivery_methods := array_append(delivery_methods, 'SMS');
    END IF;
    
    IF user_prefs.push_enabled THEN
        delivery_methods := array_append(delivery_methods, 'PUSH');
    END IF;
    
    IF user_prefs.in_app_enabled THEN
        delivery_methods := array_append(delivery_methods, 'IN_APP');
    END IF;
    
    -- Create the notification
    INSERT INTO notifications (
        user_id, notification_type, title, message,
        campaign_id, conversation_id, meeting_id, payment_id,
        delivery_methods, metadata, expires_at
    ) VALUES (
        p_user_id, p_notification_type, p_title, p_message,
        p_campaign_id, p_conversation_id, p_meeting_id, p_payment_id,
        delivery_methods, p_metadata, p_expires_at
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- View for unread notifications count per user
CREATE OR REPLACE VIEW user_unread_notifications_count AS
SELECT 
    user_id,
    COUNT(*) as unread_count,
    COUNT(*) FILTER (WHERE notification_type::text LIKE '%PAYMENT%') as unread_payment_count,
    COUNT(*) FILTER (WHERE notification_type::text LIKE '%CAMPAIGN%') as unread_campaign_count,
    COUNT(*) FILTER (WHERE notification_type::text LIKE '%MESSAGE%' OR notification_type::text LIKE '%CONVERSATION%') as unread_message_count
FROM notifications
WHERE read_at IS NULL 
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
GROUP BY user_id;

-- View for recent notifications per user
CREATE OR REPLACE VIEW user_recent_notifications AS
SELECT 
    n.*,
    u.name as user_name,
    u.email as user_email
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
ORDER BY n.created_at DESC;
