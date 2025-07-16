-- ========================================
-- CAMPAIGN TABLES
-- ========================================
-- This file contains all campaign-related tables

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type campaign_type NOT NULL,
    status campaign_status DEFAULT 'ACTIVE',
    min_budget DECIMAL(10,2) CHECK (min_budget > 0),
    max_budget DECIMAL(10,2) CHECK (max_budget > 0 AND max_budget >= min_budget),
    advertiser_types advertiser_type[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    media_url TEXT, -- S3 URL for campaign media (image/video)
    promoter_links TEXT[],
    discord_invite_link TEXT, -- Optional Discord invite link for campaign discussions
    
    budget_allocated DECIMAL(10,2) NOT NULL, -- Total budget allocated for the campaign
    -- Campaign-specific fields for VISIBILITY campaigns
    cpv DECIMAL(6,4),
    max_views INTEGER CHECK (max_views > 1000),
    tracking_link TEXT, -- Required for VISIBILITY campaigns
    current_views INTEGER,
    
    -- Campaign-specific fields for CONSULTANT campaigns
    meeting_plan meeting_plan,
    meeting_count INTEGER, -- Number of meetings included in the campaign
    need_meeting BOOLEAN,
    expertise_required TEXT,
    expected_deliverables deliverable[],
    
    -- Campaign-specific fields for SELLER campaigns
    deliverables deliverable[],
    seller_requirements deliverable[] DEFAULT '{}',
    deadline DATE NOT NULL,
    start_date DATE NOT NULL,
    
    -- Campaign-specific fields for SALESMAN campaigns
    commission_per_sale DECIMAL(5,2) CHECK (commission_per_sale >= 0 AND commission_per_sale <= 100),
    sales_tracking_method sales_tracking_method,
    code_prefix VARCHAR(50),
    current_sales INTEGER, -- Number of sales made by the promoter so far
    
    -- Common fields
    requirements TEXT[],
    target_audience TEXT,
    preferred_platforms social_platform[],
    min_followers INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    
    -- Payment tracking fields
    budget_held DECIMAL(10,2) DEFAULT 0.00 CHECK (budget_held >= 0),
    spent_budget DECIMAL(10,2) DEFAULT 0.00 CHECK (spent_budget >= 0),
    final_payout_amount DECIMAL(10,2),
    payout_executed BOOLEAN DEFAULT FALSE,
    payout_date TIMESTAMP WITH TIME ZONE,
    stripe_charge_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    
    UNIQUE(campaign_id, promoter_id)
);

-- View statistics tracking
CREATE TABLE IF NOT EXISTS view_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    date_tracked DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, promoter_id, date_tracked)
);

-- Campaign Budget Allocations
-- Campaign Budget Allocation table (Simplified - works with existing financial tables)
CREATE TABLE IF NOT EXISTS campaign_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for visibility campaigns until promoter joins
    campaign_type campaign_type NOT NULL,
    
    -- Core budget fields (campaign-level)
    total_budget DECIMAL(12,2) NOT NULL, -- Total budget for this campaign-promoter allocation
    min_budget DECIMAL(12,2), -- Minimum budget (for Consultant/Seller campaigns)
    allocated_amount DECIMAL(12,2) DEFAULT 0.00, -- Amount currently allocated/reserved
    spent_amount DECIMAL(12,2) DEFAULT 0.00, -- Amount actually spent/paid out
    remaining_amount DECIMAL(12,2) DEFAULT 0.00, -- Remaining available budget
    
    -- Visibility campaign rate (other details tracked in wallets/sales_records)
    rate_per_100_views DECIMAL(6,4), -- Rate per 100 views for visibility campaigns
    
    -- Salesman campaign rate (actual sales tracked in sales_records)
    commission_rate DECIMAL(5,2), -- Commission rate percentage for salesman campaigns
    
    -- Stripe funding tracking
    stripe_payment_intent_id VARCHAR(255), -- For pre-funding campaign budgets
    is_funded BOOLEAN DEFAULT FALSE, -- Whether budget is funded in Stripe
    funded_at TIMESTAMP WITH TIME ZONE,
    
    -- Status and tracking
    status budget_allocation_status DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for campaign-promoter pair
    UNIQUE(campaign_id, promoter_id)
);
