-- ========================================
-- FINANCIAL AND PAYMENT TABLES
-- ========================================
-- This file contains all financial, payment, and transaction-related tables

-- Transactions table for tracking all financial movements
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    description TEXT,
    payment_method payment_method,
    stripe_transaction_id VARCHAR(255),
    estimated_payment_date TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallet management for promoters
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- View earnings (accumulated from visibility/salesman campaigns)
    current_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (current_balance >= 0),
    pending_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (pending_balance >= 0),
    total_earned DECIMAL(12,2) DEFAULT 0.00 CHECK (total_earned >= 0),
    total_withdrawn DECIMAL(12,2) DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    last_payout_date TIMESTAMP WITH TIME ZONE,
    next_payout_date TIMESTAMP WITH TIME ZONE,
    minimum_threshold DECIMAL(6,2) DEFAULT 20.00, -- $20 threshold for visibility/salesman campaigns
    
    -- Direct earnings (consultant/seller campaigns)
    direct_total_earned DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_earned >= 0),
    direct_total_paid DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_paid >= 0),
    direct_pending_payments DECIMAL(10,2) DEFAULT 0.00 CHECK (direct_pending_payments >= 0),
    direct_last_payment_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Sales tracking for salesman campaigns
CREATE TABLE IF NOT EXISTS sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

