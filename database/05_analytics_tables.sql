-- ========================================
-- ANALYTICS AND METRICS TABLES
-- ========================================
-- This file contains all analytics and performance metrics tables

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
    average_campaign_duration DECIMAL(8,2) DEFAULT 0,
    
    -- Financial metrics
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    total_payouts DECIMAL(15,2) DEFAULT 0.00,
    platform_fees DECIMAL(12,2) DEFAULT 0.00,
    average_transaction_value DECIMAL(10,2) DEFAULT 0.00,
    
    -- Engagement metrics
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    average_ctr DECIMAL(5,4) DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    
    -- Performance metrics
    platform_uptime DECIMAL(5,2) DEFAULT 100.00,
    average_response_time DECIMAL(8,2) DEFAULT 0.00,
    error_rate DECIMAL(5,4) DEFAULT 0.00,
    
    -- Geographic metrics
    top_countries TEXT[], -- JSON array of countries
    top_cities TEXT[], -- JSON array of cities
    
    -- Temporal metrics
    peak_usage_hours INTEGER[], -- Array of hours (0-23)
    peak_usage_days INTEGER[], -- Array of days (1-7, Monday=1)
    
    -- Date range
    date_calculated DATE NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
