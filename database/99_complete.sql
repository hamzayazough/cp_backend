-- ========================================
-- CROWDPROP DATABASE INITIALIZATION COMPLETE
-- ========================================
-- Final script to run after all database components are set up

-- Log completion
SELECT 'CrowdProp database initialization completed successfully!' as status;

-- Show summary of created tables
SELECT 
    schemaname, 
    tablename, 
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
