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
    
    UNIQUE(advertiser_id, advertiser_type)
);

-- Advertiser work/portfolio table
CREATE TABLE IF NOT EXISTS advertiser_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_details_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    media_url TEXT, -- S3 URL for product/service image or video
    website_url TEXT, -- Optional link to product or service page
    price DECIMAL(10,2), -- Optional price for the product or service
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Promoter details table
CREATE TABLE IF NOT EXISTS promoter_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    total_sales DECIMAL(10, 2) DEFAULT 0.00,
    number_of_campaign_done INTEGER DEFAULT 0,
    total_views_generated BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Promoter languages junction table (many-to-many)
CREATE TABLE IF NOT EXISTS promoter_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    language language NOT NULL,
    
    UNIQUE(promoter_id, language)
);

-- Promoter skills table
CREATE TABLE IF NOT EXISTS promoter_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    
    UNIQUE(promoter_id, skill)
);

-- Follower estimates table
CREATE TABLE IF NOT EXISTS follower_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    count INTEGER NOT NULL CHECK (count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id, platform)
);

-- Promoter work/portfolio table
CREATE TABLE IF NOT EXISTS promoter_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL, -- S3 URL for video or image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type campaign_type NOT NULL,
    status campaign_status NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE CASCADE, -- advertiser_id
    is_public BOOLEAN DEFAULT TRUE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    media_url TEXT,
    selected_promoter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    discord_invite_link TEXT,
    
    -- Store advertiser types as JSON array
    advertiser_type JSON,
    
    -- VISIBILITY specific fields
    cpv DECIMAL(10,4), -- cost per 100 views
    max_views INTEGER,
    track_url TEXT,
    
    -- CONSULTANT & SELLER shared fields
    max_budget DECIMAL(10,2),
    min_budget DECIMAL(10,2),
    deadline TIMESTAMP WITH TIME ZONE,
    
    -- CONSULTANT specific fields
    expected_deliverables JSON, -- Array of Deliverable enums
    meeting_count INTEGER,
    reference_url TEXT,
    
    -- SELLER specific fields
    seller_requirements JSON, -- Array of Deliverable enums
    deliverables JSON, -- Array of Deliverable enums
    meeting_plan meeting_plan, -- MeetingPlan enum
    deadline_strict BOOLEAN DEFAULT FALSE,
    promoter_links JSON, -- Array of strings for promoter-created links
    
    -- SALESMAN specific fields
    commission_per_sale DECIMAL(10,2),
    track_sales_via sales_tracking_method, -- SalesTrackingMethod enum
    code_prefix VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign applications table
CREATE TABLE IF NOT EXISTS campaign_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    quote DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id)
);

-- Promoter campaigns (active participation)
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

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PENDING',
    type transaction_type NOT NULL,
    payment_method payment_method NOT NULL,
    description TEXT,
    estimated_payment_date TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallet table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- View earnings (accumulated)
    current_balance DECIMAL(10,2) DEFAULT 0.00,
    pending_balance DECIMAL(10,2) DEFAULT 0.00,
    total_earned DECIMAL(10,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
    last_payout_date TIMESTAMP WITH TIME ZONE,
    next_payout_date TIMESTAMP WITH TIME ZONE,
    minimum_threshold DECIMAL(10,2) DEFAULT 20.00,
    
    -- Direct earnings (consultant/salesman)
    direct_total_earned DECIMAL(10,2) DEFAULT 0.00,
    direct_total_paid DECIMAL(10,2) DEFAULT 0.00,
    direct_pending_payments DECIMAL(10,2) DEFAULT 0.00,
    direct_last_payment_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(promoter_id)
);

-- Message threads table
CREATE TABLE IF NOT EXISTS message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id, advertiser_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_type message_sender_type NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_advertiser_details_user_id ON advertiser_details(user_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_works_advertiser_details_id ON advertiser_works(advertiser_details_id);
CREATE INDEX IF NOT EXISTS idx_promoter_details_user_id ON promoter_details(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_estimates_promoter_id ON follower_estimates(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_works_promoter_id ON promoter_works(promoter_id);

-- New indexes for campaign and transaction tables
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign_id ON campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_promoter_id ON campaign_applications(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_campaign_id ON promoter_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_promoter_id ON promoter_campaigns(promoter_id);
CREATE INDEX IF NOT EXISTS idx_transactions_promoter_id ON transactions(promoter_id);
CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallets_promoter_id ON wallets(promoter_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_campaign_id ON message_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_promoter_id ON message_threads(promoter_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables with updated_at
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

-- New triggers for campaign and transaction tables
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

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
