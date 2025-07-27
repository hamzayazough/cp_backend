-- ========================================
-- STRIPE PAYMENT TRACKING (MINIMAL)
-- ========================================
-- This file contains minimal tables to track Stripe payments locally
-- Most Stripe data is kept in Stripe's system and accessed via API
-- Note: payment_records table has been moved to 04_financial_tables.sql

-- Webhook events log (for debugging and ensuring we don't miss events)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    -- Minimal raw data (just what we need)
    object_id VARCHAR(255), -- payment_intent_id, transfer_id, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_object_id ON stripe_webhook_events(object_id);
