-- ========================================
-- CROWDPROP DATABASE INITIALIZATION
-- ========================================
-- Master initialization script that runs all database components
-- Execute this file to set up the complete database schema

-- Create database (run this separately if needed)
-- CREATE DATABASE crowdprop;

-- 1. Create all enum types first
\i 01_enums.sql

-- 2. Create core business tables
\i 02_core_tables.sql

-- 3. Create campaign-related tables
\i 03_campaign_tables.sql

-- 4. Create financial and payment tables
\i 04_financial_tables.sql

-- 5. Create analytics and metrics tables
\i 05_analytics_tables.sql

-- 6. Create messaging and communication tables
\i 06_messaging_tables.sql

-- 7. Create functions and triggers
\i 07_functions_triggers.sql

-- 8. Create database indexes
\i 08_indexes.sql

-- Database initialization complete
-- Run this script from the database directory: psql -d crowdprop -f init_master.sql
