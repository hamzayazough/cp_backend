-- Migration: Add Analytics and Financial Entities
-- Date: 2025-07-07
-- Description: Adds comprehensive analytics and financial tracking entities

-- ========================================
-- NEW ENUMS FOR ANALYTICS AND FINANCIAL ENTITIES
-- ========================================

-- Additional enums for new entities
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_type') THEN
        CREATE TYPE payment_transaction_type AS ENUM ('CHARGE', 'PAYOUT', 'REFUND');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_status') THEN
        CREATE TYPE payment_transaction_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_capability_status') THEN
        CREATE TYPE stripe_capability_status AS ENUM ('active', 'inactive', 'pending');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE payment_method_type AS ENUM ('card', 'bank_account', 'sepa_debit');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_allocation_status') THEN
        CREATE TYPE budget_allocation_status AS ENUM ('ACTIVE', 'EXHAUSTED', 'PAUSED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
        CREATE TYPE user_type AS ENUM ('PROMOTER', 'ADVERTISER');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_frequency') THEN
        CREATE TYPE payout_frequency AS ENUM ('WEEKLY', 'MONTHLY', 'MANUAL');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_payout_method') THEN
        CREATE TYPE preferred_payout_method AS ENUM ('STRIPE', 'BANK_TRANSFER');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_form_type') THEN
        CREATE TYPE tax_form_type AS ENUM ('W9', '1099', 'OTHER');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_connect_status') THEN
        CREATE TYPE stripe_connect_status AS ENUM ('pending', 'active', 'restricted', 'rejected');
    END IF;
END $$;

-- ========================================
-- ANALYTICS ENTITIES
-- ========================================

-- Campaign Analytics table
CREATE TABLE IF NOT EXISTS campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Performance metrics
    views_generated INTEGER DEFAULT 0,
    click_through_rate DECIMAL(5,4),
    conversion_rate DECIMAL(5,4),
    sales_generated INTEGER DEFAULT 0,
    deliverable_completion DECIMAL(5,2),
    promoter_satisfaction_rating DECIMAL(3,2),
    advertiser_satisfaction_rating DECIMAL(3,2),
    
    -- Financial metrics
    budget_allocated DECIMAL(10,2) DEFAULT 0,
    budget_spent DECIMAL(10,2) DEFAULT 0,
    budget_remaining DECIMAL(10,2) DEFAULT 0,
    cost_per_result DECIMAL(8,2),
    roi DECIMAL(8,4),
    total_earnings DECIMAL(10,2) DEFAULT 0,
    
    -- Timeline metrics
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    days_to_completion INTEGER,
    deadline_met BOOLEAN DEFAULT FALSE,
    
    -- Participation metrics
    applications_received INTEGER,
    promoters_participating INTEGER DEFAULT 0,
    promoter_engagement DECIMAL(5,2),
    average_time_to_join DECIMAL(8,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Promoter Performance Metrics table
CREATE TABLE IF NOT EXISTS promoter_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Overall statistics
    total_campaigns INTEGER DEFAULT 0,
    completed_campaigns INTEGER DEFAULT 0,
    active_campaigns INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    average_earnings_per_campaign DECIMAL(10,2) DEFAULT 0,
    
    -- Performance by campaign type
    visibility_campaigns INTEGER DEFAULT 0,
    visibility_total_views INTEGER DEFAULT 0,
    visibility_average_views DECIMAL(10,2) DEFAULT 0,
    visibility_total_earnings DECIMAL(10,2) DEFAULT 0,
    visibility_average_cpv DECIMAL(6,4) DEFAULT 0,
    
    consultant_campaigns INTEGER DEFAULT 0,
    consultant_completion_rate DECIMAL(5,2) DEFAULT 0,
    consultant_average_budget DECIMAL(10,2) DEFAULT 0,
    consultant_total_earnings DECIMAL(10,2) DEFAULT 0,
    consultant_average_rating DECIMAL(3,2) DEFAULT 0,
    
    seller_campaigns INTEGER DEFAULT 0,
    seller_completion_rate DECIMAL(5,2) DEFAULT 0,
    seller_average_budget DECIMAL(10,2) DEFAULT 0,
    seller_total_earnings DECIMAL(10,2) DEFAULT 0,
    seller_on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
    
    salesman_campaigns INTEGER DEFAULT 0,
    salesman_total_sales INTEGER DEFAULT 0,
    salesman_average_sales DECIMAL(8,2) DEFAULT 0,
    salesman_total_commissions DECIMAL(10,2) DEFAULT 0,
    salesman_conversion_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Trends
    performance_score DECIMAL(5,2) DEFAULT 0,
    reliability_score DECIMAL(5,2) DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 0,
    
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Advertiser Analytics table
CREATE TABLE IF NOT EXISTS advertiser_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Campaign metrics
    total_campaigns INTEGER DEFAULT 0,
    active_campaigns INTEGER DEFAULT 0,
    completed_campaigns INTEGER DEFAULT 0,
    cancelled_campaigns INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    average_budget DECIMAL(10,2) DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    
    -- Performance metrics
    average_campaign_duration DECIMAL(8,2) DEFAULT 0,
    average_time_to_find_promoter DECIMAL(8,2) DEFAULT 0,
    promoter_retention_rate DECIMAL(5,2) DEFAULT 0,
    average_promoter_rating DECIMAL(3,2) DEFAULT 0,
    dispute_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Effectiveness metrics
    total_views INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    average_roi DECIMAL(8,4) DEFAULT 0,
    cost_efficiency DECIMAL(8,2) DEFAULT 0,
    brand_reach INTEGER DEFAULT 0,
    
    -- Spending by type
    spend_visibility DECIMAL(12,2) DEFAULT 0,
    spend_consultant DECIMAL(12,2) DEFAULT 0,
    spend_seller DECIMAL(12,2) DEFAULT 0,
    spend_salesman DECIMAL(12,2) DEFAULT 0,
    average_monthly_spend DECIMAL(10,2) DEFAULT 0,
    spending_trend VARCHAR(20) DEFAULT 'STABLE',
    
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Metrics table
CREATE TABLE IF NOT EXISTS platform_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User metrics
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_signups INTEGER DEFAULT 0,
    churn_rate DECIMAL(5,2) DEFAULT 0,
    promoter_to_advertiser_ratio DECIMAL(8,2) DEFAULT 0,
    
    -- Campaign metrics
    total_campaigns INTEGER DEFAULT 0,
    active_campaigns INTEGER DEFAULT 0,
    completed_campaigns INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    average_campaign_value DECIMAL(10,2) DEFAULT 0,
    campaigns_visibility INTEGER DEFAULT 0,
    campaigns_consultant INTEGER DEFAULT 0,
    campaigns_seller INTEGER DEFAULT 0,
    campaigns_salesman INTEGER DEFAULT 0,
    
    -- Financial metrics
    gross_marketplace_volume DECIMAL(15,2) DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    average_transaction_value DECIMAL(10,2) DEFAULT 0,
    total_payouts DECIMAL(15,2) DEFAULT 0,
    pending_payouts DECIMAL(15,2) DEFAULT 0,
    revenue_growth_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Engagement metrics
    average_session_duration DECIMAL(10,2) DEFAULT 0,
    average_campaigns_per_user DECIMAL(8,2) DEFAULT 0,
    repeat_usage_rate DECIMAL(5,2) DEFAULT 0,
    messages_sent BIGINT DEFAULT 0,
    average_response_time DECIMAL(10,2) DEFAULT 0,
    
    -- Quality metrics
    average_user_rating DECIMAL(3,2) DEFAULT 0,
    dispute_rate DECIMAL(5,2) DEFAULT 0,
    refund_rate DECIMAL(5,2) DEFAULT 0,
    customer_satisfaction_score DECIMAL(3,2) DEFAULT 0,
    platform_trust_score DECIMAL(3,2) DEFAULT 0,
    
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- FINANCIAL ENTITIES
-- ========================================

-- Payment Transaction table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type payment_transaction_type NOT NULL,
    status payment_transaction_status DEFAULT 'PENDING',
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    related_campaign_id UUID REFERENCES campaigns(id),
    stripe_transaction_id VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stripe Connect Account table
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255) NOT NULL UNIQUE,
    status stripe_connect_status DEFAULT 'pending',
    
    -- Requirements
    currently_due TEXT[], -- Array of requirement strings
    eventually_due TEXT[], -- Array of requirement strings
    past_due TEXT[], -- Array of requirement strings
    
    -- Capabilities
    transfers_capability stripe_capability_status DEFAULT 'inactive',
    card_payments_capability stripe_capability_status DEFAULT 'inactive',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment Method table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    type payment_method_type NOT NULL,
    last4 VARCHAR(4),
    brand VARCHAR(50),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Budget Allocation table
CREATE TABLE IF NOT EXISTS campaign_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_type campaign_type NOT NULL,
    total_budget DECIMAL(12,2) NOT NULL,
    allocated_budget DECIMAL(12,2) DEFAULT 0,
    remaining_budget DECIMAL(12,2) DEFAULT 0,
    spent_amount DECIMAL(12,2) DEFAULT 0,
    held_amount DECIMAL(12,2) DEFAULT 0,
    status budget_allocation_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Billing Period Summary table
CREATE TABLE IF NOT EXISTS billing_period_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type user_type NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- For promoters
    total_earned DECIMAL(12,2),
    total_paid_out DECIMAL(12,2),
    pending_payouts DECIMAL(12,2),
    campaigns_completed INTEGER,
    
    -- For advertisers
    total_spent DECIMAL(12,2),
    total_charged DECIMAL(12,2),
    campaigns_funded INTEGER,
    remaining_credits DECIMAL(12,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financial Analytics table
CREATE TABLE IF NOT EXISTS financial_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type user_type NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Overview metrics
    total_transactions INTEGER DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    average_transaction_amount DECIMAL(10,2) DEFAULT 0,
    largest_transaction DECIMAL(12,2) DEFAULT 0,
    
    -- Trends
    monthly_growth DECIMAL(8,4) DEFAULT 0,
    quarterly_growth DECIMAL(8,4) DEFAULT 0,
    yearly_growth DECIMAL(8,4) DEFAULT 0,
    
    -- Breakdown by campaign type
    visibility_amount DECIMAL(12,2),
    consultant_amount DECIMAL(12,2),
    seller_amount DECIMAL(12,2),
    salesman_amount DECIMAL(12,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payout Settings table
CREATE TABLE IF NOT EXISTS payout_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    minimum_threshold DECIMAL(10,2) DEFAULT 50.00,
    auto_payout_enabled BOOLEAN DEFAULT FALSE,
    payout_frequency payout_frequency DEFAULT 'MANUAL',
    preferred_payout_method preferred_payout_method DEFAULT 'STRIPE',
    stripe_account_id VARCHAR(255),
    bank_account_id VARCHAR(255),
    
    -- Tax information
    tax_id_provided BOOLEAN DEFAULT FALSE,
    w9_submitted BOOLEAN DEFAULT FALSE,
    tax_form_type tax_form_type,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    status invoice_status DEFAULT 'DRAFT',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    campaign_ids JSONB, -- Array of campaign IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Campaign Analytics indexes
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_created_at ON campaign_analytics(created_at);

-- Promoter Performance Metrics indexes
CREATE INDEX IF NOT EXISTS idx_promoter_performance_promoter_id ON promoter_performance_metrics(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_performance_period ON promoter_performance_metrics(period_start, period_end);

-- Advertiser Analytics indexes
CREATE INDEX IF NOT EXISTS idx_advertiser_analytics_advertiser_id ON advertiser_analytics(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_analytics_period ON advertiser_analytics(period_start, period_end);

-- Platform Metrics indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_period ON platform_metrics(period_start, period_end);

-- Payment Transactions indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_campaign_id ON payment_transactions(related_campaign_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Stripe Connect Accounts indexes
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user_id ON stripe_connect_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe_id ON stripe_connect_accounts(stripe_account_id);

-- Payment Methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- Campaign Budget Allocations indexes
CREATE INDEX IF NOT EXISTS idx_budget_allocations_campaign_id ON campaign_budget_allocations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_status ON campaign_budget_allocations(status);

-- Billing Period Summaries indexes
CREATE INDEX IF NOT EXISTS idx_billing_summaries_user_id ON billing_period_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_summaries_period ON billing_period_summaries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_summaries_user_type ON billing_period_summaries(user_type);

-- Financial Analytics indexes
CREATE INDEX IF NOT EXISTS idx_financial_analytics_user_id ON financial_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_analytics_period ON financial_analytics(period_start, period_end);

-- Payout Settings indexes
CREATE INDEX IF NOT EXISTS idx_payout_settings_promoter_id ON payout_settings(promoter_id);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_advertiser_id ON invoices(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);

-- ========================================
-- TRIGGERS FOR UPDATED_AT COLUMNS
-- ========================================

-- Note: Assumes update_updated_at_column() function already exists

-- Campaign Analytics triggers
DROP TRIGGER IF EXISTS update_campaign_analytics_updated_at ON campaign_analytics;
CREATE TRIGGER update_campaign_analytics_updated_at BEFORE UPDATE ON campaign_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Promoter Performance Metrics triggers
DROP TRIGGER IF EXISTS update_promoter_performance_metrics_updated_at ON promoter_performance_metrics;
CREATE TRIGGER update_promoter_performance_metrics_updated_at BEFORE UPDATE ON promoter_performance_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Advertiser Analytics triggers
DROP TRIGGER IF EXISTS update_advertiser_analytics_updated_at ON advertiser_analytics;
CREATE TRIGGER update_advertiser_analytics_updated_at BEFORE UPDATE ON advertiser_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Platform Metrics triggers
DROP TRIGGER IF EXISTS update_platform_metrics_updated_at ON platform_metrics;
CREATE TRIGGER update_platform_metrics_updated_at BEFORE UPDATE ON platform_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stripe Connect Accounts triggers
DROP TRIGGER IF EXISTS update_stripe_connect_accounts_updated_at ON stripe_connect_accounts;
CREATE TRIGGER update_stripe_connect_accounts_updated_at BEFORE UPDATE ON stripe_connect_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Campaign Budget Allocations triggers
DROP TRIGGER IF EXISTS update_campaign_budget_allocations_updated_at ON campaign_budget_allocations;
CREATE TRIGGER update_campaign_budget_allocations_updated_at BEFORE UPDATE ON campaign_budget_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Billing Period Summaries triggers
DROP TRIGGER IF EXISTS update_billing_period_summaries_updated_at ON billing_period_summaries;
CREATE TRIGGER update_billing_period_summaries_updated_at BEFORE UPDATE ON billing_period_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Financial Analytics triggers
DROP TRIGGER IF EXISTS update_financial_analytics_updated_at ON financial_analytics;
CREATE TRIGGER update_financial_analytics_updated_at BEFORE UPDATE ON financial_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payout Settings triggers
DROP TRIGGER IF EXISTS update_payout_settings_updated_at ON payout_settings;
CREATE TRIGGER update_payout_settings_updated_at BEFORE UPDATE ON payout_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoice triggers
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Log the migration completion
INSERT INTO schema_migrations (version, applied_at) VALUES ('20250707_analytics_financial_entities', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
