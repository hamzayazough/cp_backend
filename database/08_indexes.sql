-- ========================================
-- DATABASE INDEXES
-- ========================================
-- This file contains all database indexes for performance optimization

-- ========================================
-- CORE TABLE INDEXES
-- ========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_setup_done ON users(is_setup_done);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Advertiser details indexes
CREATE INDEX IF NOT EXISTS idx_advertiser_details_user_id ON advertiser_details(user_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_details_verified ON advertiser_details(verified);
CREATE INDEX IF NOT EXISTS idx_advertiser_details_company_name ON advertiser_details(company_name);

-- Advertiser type mappings indexes
CREATE INDEX IF NOT EXISTS idx_advertiser_type_mappings_advertiser_id ON advertiser_type_mappings(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_type_mappings_type ON advertiser_type_mappings(advertiser_type);

-- Advertiser works indexes
CREATE INDEX IF NOT EXISTS idx_advertiser_works_advertiser_id ON advertiser_works(advertiser_details_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_works_created_at ON advertiser_works(created_at);

-- Promoter details indexes
CREATE INDEX IF NOT EXISTS idx_promoter_details_user_id ON promoter_details(user_id);
CREATE INDEX IF NOT EXISTS idx_promoter_details_verified ON promoter_details(verified);
CREATE INDEX IF NOT EXISTS idx_promoter_details_location ON promoter_details(location);
CREATE INDEX IF NOT EXISTS idx_promoter_details_age ON promoter_details(age);

-- Promoter languages indexes
CREATE INDEX IF NOT EXISTS idx_promoter_languages_promoter_id ON promoter_languages(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_languages_language ON promoter_languages(language);

-- Promoter skills indexes
CREATE INDEX IF NOT EXISTS idx_promoter_skills_promoter_id ON promoter_skills(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_skills_skill ON promoter_skills(skill);

-- Follower estimates indexes
CREATE INDEX IF NOT EXISTS idx_follower_estimates_promoter_id ON follower_estimates(promoter_id);
CREATE INDEX IF NOT EXISTS idx_follower_estimates_platform ON follower_estimates(platform);
CREATE INDEX IF NOT EXISTS idx_follower_estimates_count ON follower_estimates(count);

-- Promoter works indexes
CREATE INDEX IF NOT EXISTS idx_promoter_works_promoter_id ON promoter_works(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_works_platform ON promoter_works(platform);
CREATE INDEX IF NOT EXISTS idx_promoter_works_view_count ON promoter_works(view_count);

-- ========================================
-- CAMPAIGN TABLE INDEXES
-- ========================================

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser_id ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_expiry_date ON campaigns(expiry_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_public ON campaigns(is_public);
-- Removed: selected_promoter_id column doesn't exist in campaigns table
CREATE INDEX IF NOT EXISTS idx_campaigns_min_budget ON campaigns(min_budget);
CREATE INDEX IF NOT EXISTS idx_campaigns_max_budget ON campaigns(max_budget);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser_types ON campaigns USING GIN(advertiser_types);
CREATE INDEX IF NOT EXISTS idx_campaigns_preferred_platforms ON campaigns USING GIN(preferred_platforms);

-- Campaign applications indexes
CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign_id ON campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_promoter_id ON campaign_applications(promoter_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_status ON campaign_applications(status);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_applied_at ON campaign_applications(applied_at);

-- Promoter campaigns indexes
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_campaign_id ON promoter_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_promoter_id ON promoter_campaigns(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_status ON promoter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_promoter_campaigns_joined_at ON promoter_campaigns(joined_at);

-- Campaign Budget Allocations indexes (table was replaced/removed)
-- CREATE INDEX IF NOT EXISTS idx_budget_allocations_campaign_id ON campaign_budget_allocations(campaign_id);
-- CREATE INDEX IF NOT EXISTS idx_budget_allocations_status ON campaign_budget_allocations(status);

-- ========================================
-- FINANCIAL TABLE INDEXES
-- ========================================

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_at ON transactions(processed_at);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_current_balance ON wallets(current_balance);
CREATE INDEX IF NOT EXISTS idx_wallets_last_payout_date ON wallets(last_payout_date);

-- Stripe Connect Accounts indexes
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_user_id ON stripe_connect_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_stripe_account_id ON stripe_connect_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_status ON stripe_connect_accounts(status);

-- Payment Methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- ========================================
-- MESSAGING TABLE INDEXES
-- ========================================

-- Message threads indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_advertiser_id ON message_threads(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_promoter_id ON message_threads(promoter_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_campaign_id ON message_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(last_message_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Chat summaries indexes
CREATE INDEX IF NOT EXISTS idx_chat_summaries_thread_id ON chat_summaries(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries(created_at);
