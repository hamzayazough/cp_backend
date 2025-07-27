-- ========================================
-- FINANCIAL AND PAYMENT TABLES
-- ========================================
-- This file contains all financial, payment, and transaction-related tables

-- Payment records table for tracking Stripe payments
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Business relationships (what Stripe doesn't know)
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Basic payment info (for quick queries without API calls)
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_type VARCHAR(50) NOT NULL, -- 'CAMPAIGN_FUNDING', 'WALLET_DEPOSIT', 'WITHDRAWAL'
    
    -- Simple status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    
    -- Minimal metadata
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced transactions table for tracking all internal financial movements
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Works for both advertisers and promoters
    user_type user_type NOT NULL, -- 'ADVERTISER' or 'PROMOTER'
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    
    -- Enhanced amount tracking with platform fees
    gross_amount_cents INTEGER, -- Full amount before platform fees
    platform_fee_cents INTEGER DEFAULT 0, -- Platform's 20% fee in cents
    amount DECIMAL(10,2) NOT NULL, -- Net amount (gross - platform_fee) in dollars
    
    status transaction_status DEFAULT 'PENDING',
    description TEXT,
    payment_method payment_method,
    stripe_transaction_id VARCHAR(255),
    payment_record_id UUID REFERENCES payment_records(id), -- Link to Stripe payment if applicable
    estimated_payment_date TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unified wallet management for both advertisers and promoters
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- Works for both advertisers and promoters
    user_type user_type NOT NULL, -- 'ADVERTISER' or 'PROMOTER'
    
    -- Common fields for both user types
    current_balance DECIMAL(12,2) DEFAULT 0.00 CHECK (current_balance >= 0),
    pending_balance DECIMAL(12,2) DEFAULT 0.00 CHECK (pending_balance >= 0),
    total_deposited DECIMAL(12,2) DEFAULT 0.00 CHECK (total_deposited >= 0), -- For advertisers: lifetime deposits
    total_withdrawn DECIMAL(12,2) DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    last_payout_date TIMESTAMP WITH TIME ZONE,
    
    -- Advertiser-specific fields (nullable for promoters)
    held_for_campaigns DECIMAL(12,2) DEFAULT 0.00, -- Budget reserved for active campaigns
    
    -- Promoter-specific fields (nullable for advertisers)
    total_earned DECIMAL(12,2) DEFAULT 0.00, -- Lifetime earnings from campaigns
    next_payout_date TIMESTAMP WITH TIME ZONE,
    minimum_threshold DECIMAL(6,2) DEFAULT 20.00, -- Payout threshold for visibility/salesman campaigns
    direct_total_earned DECIMAL(12,2) DEFAULT 0.00, -- Earnings from consultant/seller campaigns
    direct_total_paid DECIMAL(12,2) DEFAULT 0.00, -- Direct payments received
    direct_pending_payments DECIMAL(10,2) DEFAULT 0.00, -- Pending direct payments
    direct_last_payment_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign budget tracking table (replaces campaign_budget_allocations)
CREATE TABLE IF NOT EXISTS campaign_budget_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Budget allocation from advertiser wallet
    allocated_budget_cents INTEGER NOT NULL, -- Total budget allocated to campaign (in cents)
    spent_budget_cents INTEGER DEFAULT 0, -- Total spent so far (net to promoters)
    platform_fees_collected_cents INTEGER DEFAULT 0, -- Platform's 20% fee collected
    
    -- Campaign-specific rates
    cpv_cents INTEGER, -- Cost per 100 views (for visibility campaigns) in cents
    commission_rate DECIMAL(5,2), -- Commission rate percentage (for salesman campaigns)
    
    -- Status and tracking
    status budget_allocation_status DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id) -- One budget record per campaign
);


-- Sales tracking for salesman campaigns
CREATE TABLE IF NOT EXISTS sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Promoter who made the sale
    user_type user_type DEFAULT 'PROMOTER' NOT NULL, -- Should always be PROMOTER for sales
    sale_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL, -- Percentage commission
    commission_earned DECIMAL(10,2) NOT NULL,
    sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
    tracking_code VARCHAR(100), -- Coupon code or ref link identifier
    verification_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VERIFIED, DISPUTED
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stripe Connect Accounts table
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE REFERENCES users(firebase_uid) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Account details
    account_type VARCHAR(50) NOT NULL, -- 'express' or 'standard'
    business_type VARCHAR(50), -- 'individual', 'company', etc.
    country VARCHAR(2) NOT NULL,
    default_currency VARCHAR(3) NOT NULL, -- Changed from 'currency' to match entity
    
    -- Account status
    status stripe_connect_status DEFAULT 'pending',
    charges_enabled BOOLEAN DEFAULT FALSE,
    payouts_enabled BOOLEAN DEFAULT FALSE,
    details_submitted BOOLEAN DEFAULT FALSE,
    
    -- Capabilities
    card_payments_capability stripe_capability_status DEFAULT 'inactive',
    transfers_capability stripe_capability_status DEFAULT 'inactive',
    
    -- Requirements
    currently_due TEXT[], -- JSON array of requirements
    eventually_due TEXT[], -- JSON array of requirements
    past_due TEXT[], -- JSON array of requirements
    pending_verification TEXT[], -- JSON array of requirements
    requirements_due_date TIMESTAMP WITH TIME ZONE, -- Added missing column
    
    -- Onboarding details
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE, -- Added missing column
    onboarding_link TEXT,
    onboarding_expires_at TIMESTAMP WITH TIME ZONE,
    onboarding_type VARCHAR(50), -- Added missing column
    last_onboarding_attempt TIMESTAMP WITH TIME ZONE, -- Added missing column
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment Methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    type payment_method_type NOT NULL,
    
    -- Card details (if type is 'card')
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    
    -- Bank account details (if type is 'bank_account')
    bank_name VARCHAR(255),
    bank_last4 VARCHAR(4),
    bank_account_type VARCHAR(50), -- 'checking', 'savings'
    
    -- Common fields
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_records_campaign_id ON payment_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_type ON payment_records(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_records_created ON payment_records(created_at);