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
    promoter_work UUID[], -- List of campaign_works IDs
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
    expected_deliverables UUID[], -- Array of campaign_deliverables IDs
    
    -- Campaign-specific fields for SELLER campaigns
    deliverables UUID[], -- Array of campaign_deliverables IDs
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

-- New table: campaign_deliverables
CREATE TABLE IF NOT EXISTS campaign_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    deliverable deliverable NOT NULL,
    is_submitted BOOLEAN DEFAULT FALSE,
    is_finished BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- New table: campaign_works
CREATE TABLE IF NOT EXISTS campaign_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deliverable_id UUID REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
    promoter_link TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- New table: campaign_work_comments
CREATE TABLE IF NOT EXISTS campaign_work_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES campaign_works(id) ON DELETE CASCADE,
    comment_message TEXT NOT NULL,
    commentator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    commentator_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE unique_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(255) NOT NULL,     -- e.g. SHA-256(ip|ua|browserToken)
  ip        INET      NOT NULL,
  user_agent TEXT     NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, promoter_id, fingerprint)
);
