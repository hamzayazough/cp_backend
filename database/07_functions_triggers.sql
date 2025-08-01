-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================
-- This file contains all database functions and triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate and update campaign earnings for a promoter
CREATE OR REPLACE FUNCTION calculate_campaign_earnings(
    p_promoter_id UUID,
    p_campaign_id UUID
) RETURNS VOID AS $$
DECLARE
    v_total_views INTEGER := 0;
    v_cpv_cents INTEGER := 0;
    v_gross_earnings_cents INTEGER := 0;
    v_platform_fee_cents INTEGER := 0;
    v_net_earnings_cents INTEGER := 0;
    v_qualifies_for_payout BOOLEAN := FALSE;
BEGIN
    -- Get campaign CPV
    SELECT ROUND(cpv * 100) INTO v_cpv_cents
    FROM campaigns
    WHERE id = p_campaign_id AND type = 'VISIBILITY';
    
    IF v_cpv_cents IS NULL THEN
        RAISE EXCEPTION 'Campaign not found or not a VISIBILITY campaign: %', p_campaign_id;
    END IF;
    
    -- Calculate total views for this promoter in this campaign
    SELECT COUNT(*)
    INTO v_total_views
    FROM unique_views uv
    WHERE uv.promoter_id = p_promoter_id
        AND uv.campaign_id = p_campaign_id;
    
    -- Calculate earnings (CPV is per 100 views, so divide by 100)
    v_gross_earnings_cents := (v_total_views * v_cpv_cents) / 100;
    
    -- Calculate platform fee (20%)
    v_platform_fee_cents := ROUND(v_gross_earnings_cents * 0.20);
    v_net_earnings_cents := v_gross_earnings_cents - v_platform_fee_cents;
    
    -- Check if qualifies for payout (minimum $5 = 500 cents)
    v_qualifies_for_payout := v_net_earnings_cents >= 500;
    
    -- Insert or update campaign earnings tracking
    INSERT INTO campaign_earnings_tracking (
        promoter_id, campaign_id, views_generated, cpv_cents,
        gross_earnings_cents, platform_fee_cents, net_earnings_cents,
        qualifies_for_payout
    ) VALUES (
        p_promoter_id, p_campaign_id, v_total_views, v_cpv_cents,
        v_gross_earnings_cents, v_platform_fee_cents, v_net_earnings_cents,
        v_qualifies_for_payout
    )
    ON CONFLICT (promoter_id, campaign_id)
    DO UPDATE SET
        views_generated = EXCLUDED.views_generated,
        gross_earnings_cents = EXCLUDED.gross_earnings_cents,
        platform_fee_cents = EXCLUDED.platform_fee_cents,
        net_earnings_cents = EXCLUDED.net_earnings_cents,
        qualifies_for_payout = EXCLUDED.qualifies_for_payout,
        updated_at = CURRENT_TIMESTAMP;
        
    -- Update view tracking for detailed breakdown
    INSERT INTO campaign_view_tracking (campaign_earnings_id, unique_view_id, view_earnings_cents)
    SELECT 
        cet.id,
        uv.id,
        v_cpv_cents / 100 -- earnings per view
    FROM campaign_earnings_tracking cet
    CROSS JOIN unique_views uv
    WHERE cet.promoter_id = p_promoter_id 
        AND cet.campaign_id = p_campaign_id
        AND uv.promoter_id = p_promoter_id
        AND uv.campaign_id = p_campaign_id
        AND NOT EXISTS (
            SELECT 1 FROM campaign_view_tracking cvt 
            WHERE cvt.campaign_earnings_id = cet.id 
                AND cvt.unique_view_id = uv.id
        );

END;
$$ LANGUAGE plpgsql;

-- Function to process campaign payout (mark as paid)
CREATE OR REPLACE FUNCTION process_campaign_payout(
    p_campaign_earnings_id UUID,
    p_payout_amount_cents INTEGER,
    p_transaction_id UUID,
    p_stripe_transfer_id VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
    UPDATE campaign_earnings_tracking
    SET 
        payout_executed = TRUE,
        payout_amount_cents = p_payout_amount_cents,
        payout_date = CURRENT_TIMESTAMP,
        payout_transaction_id = p_transaction_id,
        stripe_transfer_id = p_stripe_transfer_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_campaign_earnings_id
        AND payout_executed = FALSE
        AND qualifies_for_payout = TRUE;
        
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign earnings not found or not eligible for payout: %', p_campaign_earnings_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get eligible campaigns for payout for a specific promoter
CREATE OR REPLACE FUNCTION get_eligible_campaign_payouts(p_promoter_id UUID)
RETURNS TABLE (
    earnings_id UUID,
    campaign_id UUID,
    campaign_title VARCHAR(255),
    views_generated INTEGER,
    net_earnings_cents INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cet.id,
        cet.campaign_id,
        c.title,
        cet.views_generated,
        cet.net_earnings_cents,
        cet.created_at
    FROM campaign_earnings_tracking cet
    INNER JOIN campaigns c ON c.id = cet.campaign_id
    WHERE cet.promoter_id = p_promoter_id
        AND cet.qualifies_for_payout = TRUE
        AND cet.payout_executed = FALSE
    ORDER BY cet.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS FOR CORE TABLES
-- ========================================

-- Users table trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Advertiser details triggers
DROP TRIGGER IF EXISTS update_advertiser_details_updated_at ON advertiser_details;
CREATE TRIGGER update_advertiser_details_updated_at 
    BEFORE UPDATE ON advertiser_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertiser_works_updated_at ON advertiser_works;
CREATE TRIGGER update_advertiser_works_updated_at 
    BEFORE UPDATE ON advertiser_works 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Promoter details triggers
DROP TRIGGER IF EXISTS update_promoter_details_updated_at ON promoter_details;
CREATE TRIGGER update_promoter_details_updated_at 
    BEFORE UPDATE ON promoter_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follower_estimates_updated_at ON follower_estimates;
CREATE TRIGGER update_follower_estimates_updated_at 
    BEFORE UPDATE ON follower_estimates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_works_updated_at ON promoter_works;
CREATE TRIGGER update_promoter_works_updated_at 
    BEFORE UPDATE ON promoter_works 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- TRIGGERS FOR CAMPAIGN TABLES
-- ========================================

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_applications_updated_at ON campaign_applications;
CREATE TRIGGER update_campaign_applications_updated_at 
    BEFORE UPDATE ON campaign_applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promoter_campaigns_updated_at ON promoter_campaigns;
CREATE TRIGGER update_promoter_campaigns_updated_at 
    BEFORE UPDATE ON promoter_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_budget_tracking_updated_at ON campaign_budget_tracking;
CREATE TRIGGER update_campaign_budget_tracking_updated_at 
    BEFORE UPDATE ON campaign_budget_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- TRIGGERS FOR FINANCIAL TABLES
-- ========================================

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_connect_accounts_updated_at ON stripe_connect_accounts;
CREATE TRIGGER update_stripe_connect_accounts_updated_at 
    BEFORE UPDATE ON stripe_connect_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at 
    BEFORE UPDATE ON payment_methods 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- TRIGGERS FOR MESSAGING TABLES
-- ========================================

DROP TRIGGER IF EXISTS update_message_threads_updated_at ON message_threads;
CREATE TRIGGER update_message_threads_updated_at 
    BEFORE UPDATE ON message_threads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_summaries_updated_at ON chat_summaries;
CREATE TRIGGER update_chat_summaries_updated_at 
    BEFORE UPDATE ON chat_summaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- TRIGGERS FOR CAMPAIGN PAYOUT TRACKING TABLES
-- ========================================

DROP TRIGGER IF EXISTS update_campaign_earnings_tracking_updated_at ON campaign_earnings_tracking;
CREATE TRIGGER update_campaign_earnings_tracking_updated_at 
    BEFORE UPDATE ON campaign_earnings_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_payout_batches_updated_at ON campaign_payout_batches;
CREATE TRIGGER update_campaign_payout_batches_updated_at 
    BEFORE UPDATE ON campaign_payout_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
