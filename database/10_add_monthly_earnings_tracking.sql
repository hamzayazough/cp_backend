-- ========================================
-- ADD MONTHLY EARNINGS TRACKING
-- ========================================
-- This migration adds month and year tracking to campaign_earnings_tracking
-- to support proper monthly payout calculations and prevent overpayments

-- Add month and year columns to campaign_earnings_tracking
ALTER TABLE campaign_earnings_tracking 
ADD COLUMN IF NOT EXISTS earnings_month INTEGER,
ADD COLUMN IF NOT EXISTS earnings_year INTEGER;

-- Drop the old unique constraint
ALTER TABLE campaign_earnings_tracking 
DROP CONSTRAINT IF EXISTS campaign_earnings_tracking_promoter_id_campaign_id_key;

-- Add the new unique constraint including month and year
ALTER TABLE campaign_earnings_tracking 
ADD CONSTRAINT campaign_earnings_tracking_promoter_campaign_month_year_key 
UNIQUE (promoter_id, campaign_id, earnings_month, earnings_year);

-- Add indexes for efficient querying by month/year
CREATE INDEX IF NOT EXISTS idx_campaign_earnings_month_year 
ON campaign_earnings_tracking(earnings_month, earnings_year);

CREATE INDEX IF NOT EXISTS idx_campaign_earnings_year_month 
ON campaign_earnings_tracking(earnings_year, earnings_month);

-- Add comments for documentation
COMMENT ON COLUMN campaign_earnings_tracking.earnings_month IS 'Month for which earnings are calculated (1-12)';
COMMENT ON COLUMN campaign_earnings_tracking.earnings_year IS 'Year for which earnings are calculated';

-- Migration note: Existing records without month/year will need to be handled separately
-- This is safe for new installations and can be backfilled for existing data if needed
