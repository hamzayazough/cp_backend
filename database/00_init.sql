-- ========================================
-- CROWDPROP DATABASE INITIALIZATION
-- ========================================
-- Master initialization script for Docker
-- This file is automatically executed by Docker when the container starts

-- Note: Files in docker-entrypoint-initdb.d are executed in alphabetical order
-- This file (00_init.sql) runs first to set up the database name and basic settings

-- The following files will be executed in order:
-- 01_enums.sql
-- 02_core_tables.sql  
-- 03_campaign_tables.sql
-- 04_financial_tables.sql
-- 05_analytics_tables.sql
-- 06_messaging_tables.sql
-- 07_functions_triggers.sql
-- 08_indexes.sql

-- Database is already created by Docker using POSTGRES_DB environment variable
-- Just set up any global settings here if needed

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Set search path
SET search_path = public;

-- Log initialization start
SELECT 'CrowdProp database initialization started...' as status;
