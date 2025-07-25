-- ========================================
-- CORE BUSINESS TABLES
-- ========================================
-- This file contains core user and business entity tables

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
    
    -- Campaign Statistics
    number_of_visibility_campaign_done INTEGER DEFAULT 0 CHECK (number_of_visibility_campaign_done >= 0),
    number_of_seller_campaign_done INTEGER DEFAULT 0 CHECK (number_of_seller_campaign_done >= 0),
    number_of_salesman_campaign_done INTEGER DEFAULT 0 CHECK (number_of_salesman_campaign_done >= 0),
    number_of_consultant_campaign_done INTEGER DEFAULT 0 CHECK (number_of_consultant_campaign_done >= 0),
    total_views_generated INTEGER DEFAULT 0 CHECK (total_views_generated >= 0)
);

-- Advertiser details table
CREATE TABLE IF NOT EXISTS advertiser_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_website TEXT,
    verified BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(255) UNIQUE, -- Stripe Customer ID for payment processing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_advertiser_user UNIQUE(user_id)
);

-- Advertiser types junction table (many-to-many)
CREATE TABLE IF NOT EXISTS advertiser_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
    advertiser_type advertiser_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_advertiser_type UNIQUE(advertiser_id, advertiser_type)
);

-- Advertiser work samples table
CREATE TABLE IF NOT EXISTS advertiser_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_details_id  UUID REFERENCES advertiser_details(id) ON DELETE CASCADE,
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
    age INTEGER CHECK (age >= 13 AND age <= 120),
    location VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Statistics
    total_sales DECIMAL(10,2) DEFAULT 0.00 CHECK (total_sales >= 0),
    number_of_campaign_done INTEGER DEFAULT 0 CHECK (number_of_campaign_done >= 0),
    total_views_generated INTEGER DEFAULT 0 CHECK (total_views_generated >= 0),
    
    CONSTRAINT unique_promoter_user UNIQUE(user_id)
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

-- Promoter work samples/portfolio
CREATE TABLE IF NOT EXISTS promoter_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID REFERENCES promoter_details(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_url TEXT, -- S3 URL or external link
    platform social_platform,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
