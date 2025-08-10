-- ========================================
-- ENUMS AND CUSTOM TYPES
-- ========================================
-- This file contains all enum types used throughout the database

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
            'ACTIVE', 'INACTIVE'
        );
    END IF;
END $$;

-- Transaction types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM (
            'WALLET_DEPOSIT', 'CAMPAIGN_FUNDING', 'WITHDRAWAL',
            'VIEW_EARNING', 'SALESMAN_COMMISSION', 
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
            'ADVERTISER', 'PROMOTER', 'ADMIN', 'SYSTEM'
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
            -- Consultant Deliverables
            'MARKETING_STRATEGY', 'CONTENT_PLAN', 'SCRIPT', 'MARKET_ANALYSIS',
            'BRAND_GUIDELINES', 'WEEKLY_REPORT', 'PERFORMANCE_AUDIT', 'LIVE_SESSION',
            'PRODUCT_FEEDBACK', 'AD_CONCEPTS',
            
            -- Seller Deliverables
            'CREATE_SOCIAL_MEDIA_ACCOUNTS', 'SOCIAL_MEDIA_MANAGEMENT', 'SPAM_PROMOTION',
            'PROMOTIONAL_VIDEO', 'VIDEO_EDITING', 'INSTAGRAM_POST', 'TIKTOK_VIDEO',
            'BLOG_ARTICLE', 'EMAIL_CAMPAIGN', 'PAID_ADS_CREATION', 'PRODUCT_REVIEW',
            'EVENT_PROMOTION', 'DIRECT_OUTREACH',
            
            -- Shared
            'CUSTOM'
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

-- Payment transaction types enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_type') THEN
        CREATE TYPE payment_transaction_type AS ENUM ('CHARGE', 'PAYOUT', 'REFUND');
    END IF;
END $$;

-- Payment transaction status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_status') THEN
        CREATE TYPE payment_transaction_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
    END IF;
END $$;

-- Stripe capability status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_capability_status') THEN
        CREATE TYPE stripe_capability_status AS ENUM ('active', 'inactive', 'pending');
    END IF;
END $$;

-- Payment method type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE payment_method_type AS ENUM ('card', 'bank_account', 'sepa_debit');
    END IF;
END $$;

-- Budget allocation status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_allocation_status') THEN
        CREATE TYPE budget_allocation_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

-- User type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
        CREATE TYPE user_type AS ENUM ('PROMOTER', 'ADVERTISER');
    END IF;
END $$;

-- Payout frequency enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_frequency') THEN
        CREATE TYPE payout_frequency AS ENUM ('WEEKLY', 'MONTHLY', 'MANUAL');
    END IF;
END $$;

-- Preferred payout method enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_payout_method') THEN
        CREATE TYPE preferred_payout_method AS ENUM ('STRIPE', 'BANK_TRANSFER');
    END IF;
END $$;

-- Tax form type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_form_type') THEN
        CREATE TYPE tax_form_type AS ENUM ('W9', '1099', 'OTHER');
    END IF;
END $$;


-- Stripe Connect status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_connect_status') THEN
        CREATE TYPE stripe_connect_status AS ENUM ('pending', 'active', 'restricted', 'rejected');
    END IF;
END $$;

-- Payment flow type enum for Stripe Connect
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_flow_type') THEN
        CREATE TYPE payment_flow_type AS ENUM ('destination', 'direct', 'separate_transfer', 'hold_and_transfer');
    END IF;
END $$;

-- Stripe payment intent status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_payment_intent_status') THEN
        CREATE TYPE stripe_payment_intent_status AS ENUM (
            'requires_payment_method', 'requires_confirmation', 'requires_action',
            'processing', 'requires_capture', 'canceled', 'succeeded'
        );
    END IF;
END $$;

-- Stripe transfer status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_transfer_status') THEN
        CREATE TYPE stripe_transfer_status AS ENUM ('pending', 'paid', 'failed', 'canceled');
    END IF;
END $$;

-- Platform fee type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_fee_type') THEN
        CREATE TYPE platform_fee_type AS ENUM ('percentage', 'fixed');
    END IF;
END $$;

-- Business type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_type') THEN
        CREATE TYPE business_type AS ENUM (
            'llc', 'corporation', 'partnership', 'sole_proprietorship', 'individual'
        );
    END IF;
END $$;

-- Verification status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'requires_action', 'rejected');
    END IF;
END $$;
