-- Database schema for CrowdProp application
-- Run this script to create all user-related tables

-- Create database (run this separately if needed)
-- CREATE DATABASE crowdprop;

-- User roles enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADVERTISER', 'PROMOTER', 'ADMIN');
    END IF;
END $$;

-- Advertiser types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'advertiser_type') THEN
        CREATE TYPE advertiser_type AS ENUM (
            'EDUCATION', 'CLOTHING', 'TECH', 'BEAUTY', 'FOOD', 'HEALTH',
            'ENTERTAINMENT', 'TRAVEL', 'FINANCE', 'OTHER', 'SPORTS',
            'AUTOMOTIVE', 'ART', 'GAMING', 'ECOMMERCE', 'MEDIA',
            'NON_PROFIT', 'REAL_ESTATE', 'HOME_SERVICES', 'EVENTS',
            'CONSULTING', 'BOOKS', 'MUSIC', 'PETS', 'TOYS', 'BABY',
            'JEWELRY', 'SCIENCE', 'HARDWARE', 'ENERGY', 'AGRICULTURE',
            'GOVERNMENT'
        );
    END IF;
END $$;

-- Languages enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language') THEN
        CREATE TYPE language AS ENUM (
            'ENGLISH', 'FRENCH', 'SPANISH', 'GERMAN', 'CHINESE', 'ARABIC',
            'HINDI', 'PORTUGUESE', 'RUSSIAN', 'JAPANESE', 'KOREAN',
            'ITALIAN', 'DUTCH', 'TURKISH', 'POLISH', 'SWEDISH', 'OTHER'
        );
    END IF;
END $$;

-- Social platforms enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_platform') THEN
        CREATE TYPE social_platform AS ENUM (
            'TIKTOK', 'INSTAGRAM', 'SNAPCHAT', 'YOUTUBE', 'TWITTER',
            'FACEBOOK', 'LINKEDIN', 'OTHER'
        );
    END IF;
END $$;

-- Campaign types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_type') THEN
        CREATE TYPE campaign_type AS ENUM (
            'VISIBILITY', 'CONSULTANT', 'SELLER', 'SALESMAN'
        );
    END IF;
END $$;

-- Campaign status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
        CREATE TYPE campaign_status AS ENUM (
            'ACTIVE', 'PAUSED', 'ENDED'
        );
    END IF;
END $$;

-- Transaction types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM (
            'VIEW_EARNING', 'CONSULTANT_PAYMENT', 'SALESMAN_COMMISSION', 
            'MONTHLY_PAYOUT', 'DIRECT_PAYMENT'
        );
    END IF;
END $$;

-- Transaction status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM (
            'COMPLETED', 'PENDING', 'FAILED', 'CANCELLED'
        );
    END IF;
END $$;

-- Payment methods enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM (
            'WALLET', 'BANK_TRANSFER'
        );
    END IF;
END $$;

-- Message sender types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_sender_type') THEN
        CREATE TYPE message_sender_type AS ENUM (
            'ADVERTISER', 'ADMIN', 'SYSTEM'
        );
    END IF;
END $$;

-- Meeting plan enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_plan') THEN
        CREATE TYPE meeting_plan AS ENUM (
            'ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'CUSTOM'
        );
    END IF;
END $$;

-- Sales tracking method enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_tracking_method') THEN
        CREATE TYPE sales_tracking_method AS ENUM (
            'REF_LINK', 'COUPON_CODE'
        );
    END IF;
END $$;

-- Deliverable enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable') THEN
        CREATE TYPE deliverable AS ENUM (
            'PROMOTIONAL_VIDEO', 'SCRIPT', 'CONTENT_PLAN', 'WEEKLY_REPORT',
            'LIVE_SESSION', 'PRODUCT_REVIEW', 'INSTAGRAM_POST', 'TIKTOK_VIDEO', 'CUSTOM'
        );
    END IF;
END $$;

-- Payout status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM (
            'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
        );
    END IF;
END $$;

-- Charge status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'charge_status') THEN
        CREATE TYPE charge_status AS ENUM (
            'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'
        );
    END IF;
END $$;

-- ========================================
-- CORE BUSINESS TABLES
-- ========================================

-- Main users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL, -- Firebase UID for authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255), -- Nullable initially, filled during account completion
    role user_role, -- Nullable initially, filled during account completion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_setup_done BOOLEAN DEFAULT FALSE,
    -- Profile information
    avatar_url TEXT, -- S3 URL for profile picture
    background_url TEXT, -- S3 URL for background banner
    bio TEXT,
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5), -- 0.00 to 5.00
    
    -- Social Media Links
    tiktok_url TEXT,
    instagram_url TEXT,
    snapchat_url TEXT,
    youtube_url TEXT,
    twitter_url TEXT,
    website_url TEXT, -- Personal or company website
    
    -- Financial
    stripe_account_id VARCHAR(255),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),
    
    -- Statistics
    total_sales DECIMAL(10,2) DEFAULT 0.00 CHECK (total_sales >= 0),
    number_of_campaign_done INTEGER DEFAULT 0 CHECK (number_of_campaign_done >= 0),
    total_views_generated INTEGER DEFAULT 0 CHECK (total_views_generated >= 0)
);

-- Advertiser details table
CREATE TABLE IF NOT EXISTS advertiser_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_website TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Advertiser types junction table (many-to-many)
CREATE TABLE IF NOT EXISTS advertiser_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    advertiser_type advertiser_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(advertiser_id, advertiser_type)
);

-- Advertiser work samples table
CREATE TABLE IF NOT EXISTS advertiser_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_url TEXT, -- S3 URL or external link
    thumbnail_url TEXT, -- S3 URL for thumbnail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Promoter details table
CREATE TABLE IF NOT EXISTS promoter_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER CHECK (age >= 13 AND age <= 120),
    location VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Promoter languages (many-to-many)
CREATE TABLE IF NOT EXISTS promoter_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    language language NOT NULL,
    proficiency VARCHAR(50) DEFAULT 'NATIVE', -- NATIVE, FLUENT, INTERMEDIATE, BASIC
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, language)
);

-- Promoter skills/interests
CREATE TABLE IF NOT EXISTS promoter_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    experience_level VARCHAR(50) DEFAULT 'BEGINNER', -- EXPERT, INTERMEDIATE, BEGINNER
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, skill)
);

-- Follower estimates for different platforms
CREATE TABLE IF NOT EXISTS follower_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    follower_count INTEGER DEFAULT 0 CHECK (follower_count >= 0),
    engagement_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (engagement_rate >= 0 AND engagement_rate <= 100),
    verified_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, platform)
);

-- Promoter work samples/portfolio
CREATE TABLE IF NOT EXISTS promoter_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_url TEXT, -- S3 URL or external link
    platform social_platform,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    campaign_type campaign_type NOT NULL,
    status campaign_status DEFAULT 'ACTIVE',
    budget DECIMAL(10,2) NOT NULL CHECK (budget > 0),
    spent_budget DECIMAL(10,2) DEFAULT 0.00 CHECK (spent_budget >= 0),
    
    -- Campaign-specific fields based on type
    -- For VISIBILITY campaigns
    target_views INTEGER,
    price_per_view DECIMAL(6,4),
    
    -- For CONSULTANT campaigns
    hourly_rate DECIMAL(8,2),
    total_hours INTEGER,
    meeting_plan meeting_plan,
    expertise_required TEXT,
    
    -- For SELLER campaigns
    deliverables deliverable[],
    deadline DATE,
    fixed_price DECIMAL(10,2),
    
    -- For SALESMAN campaigns
    commission_rate DECIMAL(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 100),
    sales_tracking_method sales_tracking_method,
    coupon_code VARCHAR(50),
    ref_link TEXT,
    
    -- Common fields
    requirements TEXT,
    target_audience TEXT,
    preferred_platforms social_platform[],
    min_followers INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE
);

-- Campaign applications (for CONSULTANT and SELLER campaigns)
CREATE TABLE IF NOT EXISTS campaign_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    application_message TEXT,
    proposed_rate DECIMAL(8,2), -- For negotiable campaigns
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id)
);

-- Promoter campaign participation
CREATE TABLE IF NOT EXISTS promoter_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ONGOING', -- ONGOING, AWAITING_REVIEW, COMPLETED, PAUSED
    views_generated INTEGER DEFAULT 0,
    earnings DECIMAL(10,2) DEFAULT 0.00,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id)
);

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
    minimum_threshold DECIMAL(6,2) DEFAULT 50.00,
    
    -- Direct earnings (consultant/seller campaigns)
    direct_total_earned DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_earned >= 0),
    direct_total_paid DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_paid >= 0),
    direct_pending_payments DECIMAL(10,2) DEFAULT 0.00 CHECK (direct_pending_payments >= 0),
    direct_last_payment_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message threads for communication
CREATE TABLE IF NOT EXISTS message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    subject VARCHAR(255),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(advertiser_id, promoter_id, campaign_id)
);

-- Individual messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_type message_sender_type NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to core tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_details_updated_at ON advertiser_details;
CREATE TRIGGER update_advertiser_details_updated_at BEFORE UPDATE ON advertiser_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_works_updated_at ON advertiser_works;
CREATE TRIGGER update_advertiser_works_updated_at BEFORE UPDATE ON advertiser_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_details_updated_at ON promoter_details;
CREATE TRIGGER update_promoter_details_updated_at BEFORE UPDATE ON promoter_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follower_estimates_updated_at ON follower_estimates;
CREATE TRIGGER update_follower_estimates_updated_at BEFORE UPDATE ON follower_estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_works_updated_at ON promoter_works;
CREATE TRIGGER update_promoter_works_updated_at BEFORE UPDATE ON promoter_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for campaign and transaction tables
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_applications_updated_at ON campaign_applications;
CREATE TRIGGER update_campaign_applications_updated_at BEFORE UPDATE ON campaign_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_campaigns_updated_at ON promoter_campaigns;
CREATE TRIGGER update_promoter_campaigns_updated_at BEFORE UPDATE ON promoter_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_threads_updated_at ON message_threads;
CREATE TRIGGER update_message_threads_updated_at BEFORE UPDATE ON message_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for payment tracking tables
DROP TRIGGER IF EXISTS update_payout_records_updated_at ON payout_records;
CREATE TRIGGER update_payout_records_updated_at BEFORE UPDATE ON payout_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_charges_updated_at ON advertiser_charges;
CREATE TRIGGER update_advertiser_charges_updated_at BEFORE UPDATE ON advertiser_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_balances_updated_at ON promoter_balances;
CREATE TRIGGER update_promoter_balances_updated_at BEFORE UPDATE ON promoter_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_spends_updated_at ON advertiser_spends;
CREATE TRIGGER update_advertiser_spends_updated_at BEFORE UPDATE ON advertiser_spends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- NEW ANALYTICS AND FINANCIAL ENTITIES
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
-- INDEXES FOR NEW TABLES
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
-- TRIGGERS FOR NEW TABLES
-- ========================================

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
-- CORE BUSINESS TABLES
-- ========================================

-- Main users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL, -- Firebase UID for authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255), -- Nullable initially, filled during account completion
    role user_role, -- Nullable initially, filled during account completion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_setup_done BOOLEAN DEFAULT FALSE,
    -- Profile information
    avatar_url TEXT, -- S3 URL for profile picture
    background_url TEXT, -- S3 URL for background banner
    bio TEXT,
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5), -- 0.00 to 5.00
    
    -- Social Media Links
    tiktok_url TEXT,
    instagram_url TEXT,
    snapchat_url TEXT,
    youtube_url TEXT,
    twitter_url TEXT,
    website_url TEXT, -- Personal or company website
    
    -- Financial
    stripe_account_id VARCHAR(255),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),
    
    -- Statistics
    total_sales DECIMAL(10,2) DEFAULT 0.00 CHECK (total_sales >= 0),
    number_of_campaign_done INTEGER DEFAULT 0 CHECK (number_of_campaign_done >= 0),
    total_views_generated INTEGER DEFAULT 0 CHECK (total_views_generated >= 0)
);

-- Advertiser details table
CREATE TABLE IF NOT EXISTS advertiser_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_website TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Advertiser types junction table (many-to-many)
CREATE TABLE IF NOT EXISTS advertiser_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    advertiser_type advertiser_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(advertiser_id, advertiser_type)
);

-- Advertiser work samples table
CREATE TABLE IF NOT EXISTS advertiser_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_url TEXT, -- S3 URL or external link
    thumbnail_url TEXT, -- S3 URL for thumbnail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Promoter details table
CREATE TABLE IF NOT EXISTS promoter_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER CHECK (age >= 13 AND age <= 120),
    location VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Promoter languages (many-to-many)
CREATE TABLE IF NOT EXISTS promoter_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    language language NOT NULL,
    proficiency VARCHAR(50) DEFAULT 'NATIVE', -- NATIVE, FLUENT, INTERMEDIATE, BASIC
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, language)
);

-- Promoter skills/interests
CREATE TABLE IF NOT EXISTS promoter_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    experience_level VARCHAR(50) DEFAULT 'BEGINNER', -- EXPERT, INTERMEDIATE, BEGINNER
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, skill)
);

-- Follower estimates for different platforms
CREATE TABLE IF NOT EXISTS follower_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    follower_count INTEGER DEFAULT 0 CHECK (follower_count >= 0),
    engagement_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (engagement_rate >= 0 AND engagement_rate <= 100),
    verified_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, platform)
);

-- Promoter work samples/portfolio
CREATE TABLE IF NOT EXISTS promoter_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_url TEXT, -- S3 URL or external link
    platform social_platform,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    campaign_type campaign_type NOT NULL,
    status campaign_status DEFAULT 'ACTIVE',
    budget DECIMAL(10,2) NOT NULL CHECK (budget > 0),
    spent_budget DECIMAL(10,2) DEFAULT 0.00 CHECK (spent_budget >= 0),
    
    -- Campaign-specific fields based on type
    -- For VISIBILITY campaigns
    target_views INTEGER,
    price_per_view DECIMAL(6,4),
    
    -- For CONSULTANT campaigns
    hourly_rate DECIMAL(8,2),
    total_hours INTEGER,
    meeting_plan meeting_plan,
    expertise_required TEXT,
    
    -- For SELLER campaigns
    deliverables deliverable[],
    deadline DATE,
    fixed_price DECIMAL(10,2),
    
    -- For SALESMAN campaigns
    commission_rate DECIMAL(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 100),
    sales_tracking_method sales_tracking_method,
    coupon_code VARCHAR(50),
    ref_link TEXT,
    
    -- Common fields
    requirements TEXT,
    target_audience TEXT,
    preferred_platforms social_platform[],
    min_followers INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE
);

-- Campaign applications (for CONSULTANT and SELLER campaigns)
CREATE TABLE IF NOT EXISTS campaign_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    application_message TEXT,
    proposed_rate DECIMAL(8,2), -- For negotiable campaigns
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id)
);

-- Promoter campaign participation
CREATE TABLE IF NOT EXISTS promoter_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ONGOING', -- ONGOING, AWAITING_REVIEW, COMPLETED, PAUSED
    views_generated INTEGER DEFAULT 0,
    earnings DECIMAL(10,2) DEFAULT 0.00,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id)
);

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
    minimum_threshold DECIMAL(6,2) DEFAULT 50.00,
    
    -- Direct earnings (consultant/seller campaigns)
    direct_total_earned DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_earned >= 0),
    direct_total_paid DECIMAL(12,2) DEFAULT 0.00 CHECK (direct_total_paid >= 0),
    direct_pending_payments DECIMAL(10,2) DEFAULT 0.00 CHECK (direct_pending_payments >= 0),
    direct_last_payment_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message threads for communication
CREATE TABLE IF NOT EXISTS message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    subject VARCHAR(255),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(advertiser_id, promoter_id, campaign_id)
);

-- Individual messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_type message_sender_type NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to core tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_details_updated_at ON advertiser_details;
CREATE TRIGGER update_advertiser_details_updated_at BEFORE UPDATE ON advertiser_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_works_updated_at ON advertiser_works;
CREATE TRIGGER update_advertiser_works_updated_at BEFORE UPDATE ON advertiser_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_details_updated_at ON promoter_details;
CREATE TRIGGER update_promoter_details_updated_at BEFORE UPDATE ON promoter_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follower_estimates_updated_at ON follower_estimates;
CREATE TRIGGER update_follower_estimates_updated_at BEFORE UPDATE ON follower_estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_works_updated_at ON promoter_works;
CREATE TRIGGER update_promoter_works_updated_at BEFORE UPDATE ON promoter_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for campaign and transaction tables
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_applications_updated_at ON campaign_applications;
CREATE TRIGGER update_campaign_applications_updated_at BEFORE UPDATE ON campaign_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_campaigns_updated_at ON promoter_campaigns;
CREATE TRIGGER update_promoter_campaigns_updated_at BEFORE UPDATE ON promoter_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_threads_updated_at ON message_threads;
CREATE TRIGGER update_message_threads_updated_at BEFORE UPDATE ON message_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for payment tracking tables
DROP TRIGGER IF EXISTS update_payout_records_updated_at ON payout_records;
CREATE TRIGGER update_payout_records_updated_at BEFORE UPDATE ON payout_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_charges_updated_at ON advertiser_charges;
CREATE TRIGGER update_advertiser_charges_updated_at BEFORE UPDATE ON advertiser_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_balances_updated_at ON promoter_balances;
CREATE TRIGGER update_promoter_balances_updated_at BEFORE UPDATE ON promoter_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_spends_updated_at ON advertiser_spends;
CREATE TRIGGER update_advertiser_spends_updated_at BEFORE UPDATE ON advertiser_spends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
