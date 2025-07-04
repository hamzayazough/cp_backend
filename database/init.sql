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
            'NON_PROFIT', 'REAL_ESTATE', 'HOME_SERVICES'
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
    wallet_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0)
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

-- Promoter details table
CREATE TABLE IF NOT EXISTS promoter_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_advertiser_details_user_id ON advertiser_details(user_id);
CREATE INDEX IF NOT EXISTS idx_promoter_details_user_id ON promoter_details(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_estimates_promoter_id ON follower_estimates(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_works_promoter_id ON promoter_works(promoter_id);

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

DROP TRIGGER IF EXISTS update_promoter_details_updated_at ON promoter_details;
CREATE TRIGGER update_promoter_details_updated_at BEFORE UPDATE ON promoter_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follower_estimates_updated_at ON follower_estimates;
CREATE TRIGGER update_follower_estimates_updated_at BEFORE UPDATE ON follower_estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_works_updated_at ON promoter_works;
CREATE TRIGGER update_promoter_works_updated_at BEFORE UPDATE ON promoter_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
