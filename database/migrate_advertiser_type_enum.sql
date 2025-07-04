-- Migration script to add new advertiser type enum values
-- Run this script if you already have a database with the advertiser_type enum

-- Add new enum values to the existing advertiser_type enum
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'EVENTS';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'CONSULTING';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'BOOKS';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'MUSIC';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'PETS';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'TOYS';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'BABY';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'JEWELRY';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'SCIENCE';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'HARDWARE';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'ENERGY';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'AGRICULTURE';
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'GOVERNMENT';
