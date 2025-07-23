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

-- Payment tracking tables
CREATE TABLE IF NOT EXISTS payout_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    status payout_status DEFAULT 'PENDING',
    stripe_transfer_id VARCHAR(255),
    stripe_payout_id VARCHAR(255),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    description TEXT,
    failure_reason TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advertiser_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    status charge_status DEFAULT 'PENDING',
    stripe_charge_id VARCHAR(255),
    stripe_payment_method_id VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    failure_reason TEXT,
    refunded_amount DECIMAL(10,2) DEFAULT 0.00,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promoter_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    available_balance DECIMAL(10,2) DEFAULT 0.00,
    pending_balance DECIMAL(10,2) DEFAULT 0.00,
    total_earned DECIMAL(12,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(12,2) DEFAULT 0.00,
    last_payout_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advertiser_spends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    total_refunded DECIMAL(12,2) DEFAULT 0.00,
    pending_charges DECIMAL(10,2) DEFAULT 0.00,
    last_charge_date TIMESTAMP WITH TIME ZONE,
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
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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

-- Billing Period Summaries table
CREATE TABLE IF NOT EXISTS billing_period_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_type user_type NOT NULL,
    
    -- Period details
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Financial summary
    total_transactions INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    total_fees DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(12,2) DEFAULT 0.00,
    
    -- Promoter-specific fields
    total_views INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    average_cpv DECIMAL(6,4) DEFAULT 0,
    total_earned DECIMAL(12,2) DEFAULT 0.00,
    total_paid_out DECIMAL(12,2) DEFAULT 0.00,
    pending_payouts DECIMAL(12,2) DEFAULT 0.00,
    below_threshold_earnings DECIMAL(12,2) DEFAULT 0.00, -- Earnings below $20 threshold
    
    -- Advertiser-specific fields
    total_spend DECIMAL(12,2) DEFAULT 0.00,
    total_refunds DECIMAL(10,2) DEFAULT 0.00,
    campaigns_funded INTEGER DEFAULT 0,
    remaining_credits DECIMAL(12,2) DEFAULT 0.00,
    
    -- Campaign type breakdown
    visibility_earnings DECIMAL(12,2) DEFAULT 0.00,
    consultant_earnings DECIMAL(12,2) DEFAULT 0.00,
    seller_earnings DECIMAL(12,2) DEFAULT 0.00,
    salesman_earnings DECIMAL(12,2) DEFAULT 0.00,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, period_start, period_end)
);

-- Payout Settings table
CREATE TABLE IF NOT EXISTS payout_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payout preferences
    frequency payout_frequency DEFAULT 'MONTHLY',
    minimum_amount DECIMAL(8,2) DEFAULT 20.00, -- $20 minimum for visibility/salesman campaigns
    preferred_method preferred_payout_method DEFAULT 'STRIPE',
    
    -- Bank details (if preferred_method is 'BANK_TRANSFER')
    bank_account_holder_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_routing_number VARCHAR(50),
    bank_name VARCHAR(255),
    
    -- Tax information
    tax_form_type tax_form_type,
    tax_id VARCHAR(50),
    tax_form_submitted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    status invoice_status DEFAULT 'DRAFT',
    
    -- Financial details
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment details
    due_date DATE NOT NULL,
    paid_date DATE,
    payment_method_id UUID REFERENCES payment_methods(id),
    
    -- Billing period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metadata
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financial Analytics table
CREATE TABLE IF NOT EXISTS financial_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Revenue metrics
    gross_revenue DECIMAL(12,2) DEFAULT 0.00,
    net_revenue DECIMAL(12,2) DEFAULT 0.00,
    platform_fees DECIMAL(10,2) DEFAULT 0.00,
    payment_processing_fees DECIMAL(10,2) DEFAULT 0.00,
    
    -- Growth metrics
    revenue_growth_rate DECIMAL(8,4) DEFAULT 0.00,
    user_acquisition_cost DECIMAL(8,2) DEFAULT 0.00,
    lifetime_value DECIMAL(10,2) DEFAULT 0.00,
    
    -- Efficiency metrics
    conversion_rate DECIMAL(5,4) DEFAULT 0.00,
    average_transaction_value DECIMAL(10,2) DEFAULT 0.00,
    churn_rate DECIMAL(5,4) DEFAULT 0.00,
    
    -- Period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
