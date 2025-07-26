-- Migration to add WITHDRAWAL to transaction_type enum
-- This script should be run to update existing databases

-- Add WITHDRAWAL to the transaction_type enum
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'WITHDRAWAL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')
    ) THEN
        ALTER TYPE transaction_type ADD VALUE 'WITHDRAWAL';
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')
ORDER BY enumsortorder;
