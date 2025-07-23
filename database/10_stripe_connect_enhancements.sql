-- ========================================
-- STRIPE CONNECT ENHANCEMENTS
-- ========================================
-- This file contains enhancements to support comprehensive Stripe Connect integration

-- Enhanced Stripe Connect Accounts (your existing table is good, adding some fields)
-- Add these columns to your existing stripe_connect_accounts table:
-- ALTER TABLE stripe_connect_accounts ADD COLUMN IF NOT EXISTS onboarding_type VARCHAR(50) DEFAULT 'account_links'; -- 'oauth' or 'account_links'
-- ALTER TABLE stripe_connect_accounts ADD COLUMN IF NOT EXISTS last_onboarding_attempt TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE stripe_connect_accounts ADD COLUMN IF NOT EXISTS requirements_due_date TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE stripe_connect_accounts ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'USD';

-- Enhanced Payment Intents table for Stripe Connect payments
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Relationship data
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    payer_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Customer/Advertiser
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Promoter receiving payment
    
    -- Payment details
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    application_fee_amount INTEGER DEFAULT 0, -- Platform fee in cents
    
    -- Connect specific fields
    payment_flow_type payment_flow_type NOT NULL, -- 'destination', 'direct', 'separate_transfer'
    destination_account_id VARCHAR(255), -- Stripe account ID for destination charges
    transfer_data JSONB, -- For complex transfer scenarios
    
    -- Status tracking
    status stripe_payment_intent_status DEFAULT 'requires_payment_method',
    client_secret TEXT,
    
    -- Metadata
    description TEXT,
    metadata JSONB, -- Additional Stripe metadata
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    succeeded_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE
);

-- Stripe Transfers table (for separate transfer flows)
CREATE TABLE IF NOT EXISTS stripe_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_transfer_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Source payment
    payment_intent_id UUID REFERENCES stripe_payment_intents(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Transfer details
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    destination_account_id VARCHAR(255) NOT NULL, -- Stripe connected account ID
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status
    status stripe_transfer_status DEFAULT 'pending',
    
    -- Metadata
    description TEXT,
    metadata JSONB,
    failure_code VARCHAR(100),
    failure_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transferred_at TIMESTAMP WITH TIME ZONE
);

-- Campaign Payment Configuration table
CREATE TABLE IF NOT EXISTS campaign_payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Payment flow configuration
    payment_flow_type payment_flow_type NOT NULL DEFAULT 'destination',
    platform_fee_type platform_fee_type DEFAULT 'percentage',
    platform_fee_value DECIMAL(10,4) DEFAULT 0, -- e.g., 5.0 for 5%, or 2.50 for $2.50 fixed
    
    -- Conditional payment settings
    requires_goal_completion BOOLEAN DEFAULT FALSE, -- Hold funds until campaign goal met
    auto_release_funds BOOLEAN DEFAULT TRUE, -- Auto-release on completion or manual approval
    hold_period_days INTEGER DEFAULT 0, -- Days to hold funds after completion
    
    -- Multi-promoter settings (for future revenue splits)
    supports_revenue_split BOOLEAN DEFAULT FALSE,
    split_configuration JSONB, -- For complex split scenarios
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Fee Tracking table
CREATE TABLE IF NOT EXISTS platform_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source transaction
    payment_intent_id UUID REFERENCES stripe_payment_intents(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Fee details
    fee_amount INTEGER NOT NULL, -- Platform fee in cents
    stripe_fee_amount INTEGER DEFAULT 0, -- Stripe's processing fee in cents
    net_fee_amount INTEGER NOT NULL, -- Platform fee minus Stripe's cut
    
    -- Fee calculation
    fee_type platform_fee_type NOT NULL, -- 'percentage', 'fixed'
    fee_rate DECIMAL(10,4), -- Rate used for calculation
    base_amount INTEGER NOT NULL, -- Amount fee was calculated on
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'collected', 'refunded'
    
    -- Stripe references
    stripe_application_fee_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Events Log table (for debugging and audit)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    livemode BOOLEAN NOT NULL,
    
    -- Related objects
    object_id VARCHAR(255), -- The Stripe object ID (payment_intent, account, etc.)
    object_type VARCHAR(50), -- The type of object
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Raw data
    raw_event_data JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Business Profile table (for business promoters)
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Business details
    business_name VARCHAR(255) NOT NULL,
    business_type business_type, -- 'llc', 'corporation', 'partnership', 'sole_proprietorship'
    tax_id VARCHAR(50), -- EIN for US, Business Number for Canada
    
    -- Address
    business_address_line1 VARCHAR(255),
    business_address_line2 VARCHAR(255),
    business_city VARCHAR(100),
    business_state VARCHAR(100),
    business_postal_code VARCHAR(20),
    business_country VARCHAR(2),
    
    -- Contact
    business_phone VARCHAR(50),
    business_website TEXT,
    
    -- Legal representative (for Stripe)
    representative_first_name VARCHAR(100),
    representative_last_name VARCHAR(100),
    representative_email VARCHAR(255),
    representative_dob DATE,
    representative_phone VARCHAR(50),
    
    -- Verification
    verification_status verification_status DEFAULT 'pending',
    verification_documents JSONB, -- Store document references
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_campaign_id ON stripe_payment_intents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_status ON stripe_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_payer_id ON stripe_payment_intents(payer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_recipient_id ON stripe_payment_intents(recipient_id);

CREATE INDEX IF NOT EXISTS idx_stripe_transfers_campaign_id ON stripe_transfers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_destination_account ON stripe_transfers(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_status ON stripe_transfers(status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_platform_fees_campaign_id ON platform_fees(campaign_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_status ON platform_fees(status);
