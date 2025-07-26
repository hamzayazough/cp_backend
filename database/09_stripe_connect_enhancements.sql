-- ========================================
-- STRIPE PAYMENT TRACKING (MINIMAL)
-- ========================================
-- This file contains minimal tables to track Stripe payments locally
-- Most Stripe data is kept in Stripe's system and accessed via API

-- Simple payment tracking table (replaces complex stripe_payment_intents)
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Business relationships (what Stripe doesn't know)
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Basic payment info (for quick queries without API calls)
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_type VARCHAR(50) NOT NULL, -- 'campaign_funding', 'wallet_deposit', 'withdrawal'
    
    -- Simple status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    
    -- Minimal metadata
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX IF NOT EXISTS idx_payment_records_campaign_id ON payment_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_type ON payment_records(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_records_created ON payment_records(created_at);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_object_id ON stripe_webhook_events(object_id);
