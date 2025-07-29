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
