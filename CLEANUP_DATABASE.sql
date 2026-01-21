-- =====================================================
-- QUICK DATABASE CLEANUP - Delete All Data
-- =====================================================
-- Copy and paste this into Supabase SQL Editor
-- This version only deletes from tables that exist
-- =====================================================

-- Step 1: Delete all tracking and activity data
DELETE FROM lead_activities WHERE 1=1;

-- Step 2: Delete discovered pages (if table exists)
DELETE FROM discovered_pages WHERE 1=1;

-- Step 3: Delete all scoring data
DELETE FROM score_history WHERE 1=1;
DELETE FROM lead_scores WHERE 1=1;

-- Step 4: Delete all leads
DELETE FROM leads WHERE 1=1;

-- Step 5: Delete all contacts and companies
DELETE FROM contacts WHERE 1=1;
DELETE FROM companies WHERE 1=1;

-- Step 6: Delete all page and CTA configurations
DELETE FROM tenant_pages WHERE 1=1;
DELETE FROM tenant_ctas WHERE 1=1;

-- Step 7: Delete all websites
DELETE FROM tenant_websites WHERE 1=1;

-- Step 8: Delete usage tracking
DELETE FROM tenant_usage WHERE 1=1;

-- Step 9: Delete campaigns and users (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'campaigns') THEN
        DELETE FROM campaigns WHERE 1=1;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        DELETE FROM users WHERE 1=1;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'rate_limits') THEN
        DELETE FROM rate_limits WHERE 1=1;
    END IF;
END $$;

-- Step 10: Delete all tenants (FINAL - cascades everything)
DELETE FROM tenants WHERE 1=1;

-- Step 11: Reset sequences (so IDs start from 1 again)
ALTER SEQUENCE IF EXISTS lead_activities_activity_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS leads_lead_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS contacts_contact_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS companies_company_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_user_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS campaigns_campaign_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS lead_scores_score_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS score_history_history_id_seq RESTART WITH 1;

-- Verification: Check all tables are empty (should all show 0)
SELECT 'tenants' as table_name, COUNT(*) as count FROM tenants
UNION ALL SELECT 'tenant_websites', COUNT(*) FROM tenant_websites
UNION ALL SELECT 'tenant_pages', COUNT(*) FROM tenant_pages
UNION ALL SELECT 'tenant_ctas', COUNT(*) FROM tenant_ctas
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'lead_activities', COUNT(*) FROM lead_activities
UNION ALL SELECT 'lead_scores', COUNT(*) FROM lead_scores
UNION ALL SELECT 'score_history', COUNT(*) FROM score_history
UNION ALL SELECT 'discovered_pages', COUNT(*) FROM discovered_pages
UNION ALL SELECT 'tenant_usage', COUNT(*) FROM tenant_usage
ORDER BY table_name;

-- Done! Database is clean and ready for fresh data.
