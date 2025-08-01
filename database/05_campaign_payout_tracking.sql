-- ========================================
-- CAMPAIGN-BASED PAYOUT TRACKING FOR VISIBILITY CAMPAIGNS
-- ========================================
-- This file contains tables for tracking per-campaign payouts
-- with the $5 minimum threshold requirement per campaign

-- Campaign earnings tracking for promoters in visibility campaigns
CREATE TABLE IF NOT EXISTS campaign_earnings_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Earnings for this specific campaign
    views_generated INTEGER DEFAULT 0,
    cpv_cents INTEGER NOT NULL, -- CPV rate for this campaign in cents (per 100 views)
    gross_earnings_cents INTEGER DEFAULT 0, -- views_generated * cpv_cents / 100
    platform_fee_cents INTEGER DEFAULT 0, -- 20% platform fee (in cents)
    net_earnings_cents INTEGER DEFAULT 0, -- Actual earnings to promoter (in cents)
    
    -- Payout tracking
    qualifies_for_payout BOOLEAN DEFAULT FALSE, -- TRUE if net_earnings >= $5 (500 cents)
    payout_executed BOOLEAN DEFAULT FALSE,
    payout_amount_cents INTEGER, -- Amount actually paid out
    payout_date TIMESTAMP WITH TIME ZONE,
    payout_transaction_id UUID REFERENCES transactions(id),
    stripe_transfer_id VARCHAR(255), -- Stripe transfer ID for tracking
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per promoter per campaign
    UNIQUE(promoter_id, campaign_id)
);

-- View tracking for real-time earnings calculation
CREATE TABLE IF NOT EXISTS campaign_view_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_earnings_id UUID NOT NULL REFERENCES campaign_earnings_tracking(id) ON DELETE CASCADE,
    unique_view_id UUID NOT NULL REFERENCES unique_views(id) ON DELETE CASCADE,
    
    -- Earnings from this specific view
    view_earnings_cents INTEGER NOT NULL, -- cpv_cents / 100 (earnings per view)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per view per campaign earnings
    UNIQUE(campaign_earnings_id, unique_view_id)
);

-- Payout batches for administrative tracking (optional, for reporting)
CREATE TABLE IF NOT EXISTS campaign_payout_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Batch summary
    total_promoters INTEGER DEFAULT 0,
    total_payout_amount_cents INTEGER DEFAULT 0,
    total_platform_fees_cents INTEGER DEFAULT 0,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Link campaign earnings to payout batches
CREATE TABLE IF NOT EXISTS campaign_earnings_payout_batch (
    campaign_earnings_id UUID REFERENCES campaign_earnings_tracking(id) ON DELETE CASCADE,
    payout_batch_id UUID REFERENCES campaign_payout_batches(id) ON DELETE CASCADE,
    
    PRIMARY KEY (campaign_earnings_id, payout_batch_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_promoter_id ON campaign_earnings_tracking(promoter_id);
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_campaign_id ON campaign_earnings_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_qualifies_payout ON campaign_earnings_tracking(qualifies_for_payout);
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_payout_executed ON campaign_earnings_tracking(payout_executed);
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_created_at ON campaign_earnings_tracking(created_at);

CREATE INDEX IF NOT EXISTS idx_campaign_view_tracking_earnings_id ON campaign_view_tracking(campaign_earnings_id);
CREATE INDEX IF NOT EXISTS idx_campaign_view_tracking_view_id ON campaign_view_tracking(unique_view_id);

CREATE INDEX IF NOT EXISTS idx_campaign_payout_batches_campaign_id ON campaign_payout_batches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_payout_batches_status ON campaign_payout_batches(status);
