-- =====================================================
-- COMPLETE DATABASE CLEANUP SCRIPT
-- =====================================================
-- WARNING: This will DELETE ALL DATA from all tables!
-- Use this to reset the database to a clean state
-- Schema and structure remain intact
-- =====================================================

-- IMPORTANT: Run this script ONLY when you want to clear ALL data!

-- =====================================================
-- STEP 1: Disable Foreign Key Checks Temporarily
-- =====================================================
-- We'll delete in the correct order to respect foreign keys

-- =====================================================
-- STEP 2: Delete All Tracking & Activity Data
-- =====================================================

-- Delete all lead activities (page views, CTA clicks, form submissions)
DELETE FROM lead_activities;
COMMIT;

-- Delete all discovered pages
DELETE FROM discovered_pages;
COMMIT;

-- Delete all discovered CTAs (skip if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'discovered_ctas') THEN
        DELETE FROM discovered_ctas WHERE 1=1;
    END IF;
END $$;
COMMIT;

-- =====================================================
-- STEP 3: Delete All Lead Scoring Data
-- =====================================================

-- Delete all score history
DELETE FROM score_history;
COMMIT;

-- Delete all lead scores
DELETE FROM lead_scores;
COMMIT;

-- Delete all leads
DELETE FROM leads;
COMMIT;

-- =====================================================
-- STEP 4: Delete All Contact & Company Data
-- =====================================================

-- Delete all contacts
DELETE FROM contacts;
COMMIT;

-- Delete all companies
DELETE FROM companies;
COMMIT;

-- =====================================================
-- STEP 5: Delete All Page & CTA Configurations
-- =====================================================

-- Delete all configured pages
DELETE FROM tenant_pages;
COMMIT;

-- Delete all configured CTAs
DELETE FROM tenant_ctas;
COMMIT;

-- =====================================================
-- STEP 6: Delete All Websites
-- =====================================================

-- Delete all tenant websites
DELETE FROM tenant_websites;
COMMIT;

-- =====================================================
-- STEP 7: Delete All Usage & Limits Data
-- =====================================================

-- Delete all usage tracking records
DELETE FROM tenant_usage;
COMMIT;

-- Delete all rate limit records
DELETE FROM rate_limits;
COMMIT;

-- =====================================================
-- STEP 8: Delete All Campaigns
-- =====================================================

-- Delete all campaigns
DELETE FROM campaigns;
COMMIT;

-- =====================================================
-- STEP 9: Delete All Users (if exists)
-- =====================================================

-- Delete all users
DELETE FROM users;
COMMIT;

-- =====================================================
-- STEP 10: Delete All Tenants (FINAL STEP)
-- =====================================================

-- This will cascade delete everything due to foreign keys
-- But we've already manually deleted everything above for safety
DELETE FROM tenants;
COMMIT;

-- =====================================================
-- STEP 11: Reset Sequences (Auto-increment IDs)
-- =====================================================

-- Reset lead_activities sequence
ALTER SEQUENCE IF EXISTS lead_activities_activity_id_seq RESTART WITH 1;

-- Reset leads sequence
ALTER SEQUENCE IF EXISTS leads_lead_id_seq RESTART WITH 1;

-- Reset contacts sequence
ALTER SEQUENCE IF EXISTS contacts_contact_id_seq RESTART WITH 1;

-- Reset companies sequence
ALTER SEQUENCE IF EXISTS companies_company_id_seq RESTART WITH 1;

-- Reset users sequence
ALTER SEQUENCE IF EXISTS users_user_id_seq RESTART WITH 1;

-- Reset campaigns sequence
ALTER SEQUENCE IF EXISTS campaigns_campaign_id_seq RESTART WITH 1;

-- =====================================================
-- STEP 12: Vacuum Tables (Optional - Cleanup)
-- =====================================================

VACUUM ANALYZE lead_activities;
VACUUM ANALYZE discovered_pages;
VACUUM ANALYZE discovered_ctas;
VACUUM ANALYZE score_history;
VACUUM ANALYZE lead_scores;
VACUUM ANALYZE leads;
VACUUM ANALYZE contacts;
VACUUM ANALYZE companies;
VACUUM ANALYZE tenant_pages;
VACUUM ANALYZE tenant_ctas;
VACUUM ANALYZE tenant_websites;
VACUUM ANALYZE tenant_usage;
VACUUM ANALYZE rate_limits;
VACUUM ANALYZE campaigns;
VACUUM ANALYZE users;
VACUUM ANALYZE tenants;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify all data is deleted:

SELECT 'tenants' as table_name, COUNT(*) as count FROM tenants
UNION ALL
SELECT 'tenant_websites', COUNT(*) FROM tenant_websites
UNION ALL
SELECT 'tenant_pages', COUNT(*) FROM tenant_pages
UNION ALL
SELECT 'tenant_ctas', COUNT(*) FROM tenant_ctas
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'lead_activities', COUNT(*) FROM lead_activities
UNION ALL
SELECT 'lead_scores', COUNT(*) FROM lead_scores
UNION ALL
SELECT 'score_history', COUNT(*) FROM score_history
UNION ALL
SELECT 'discovered_pages', COUNT(*) FROM discovered_pages
UNION ALL
SELECT 'discovered_ctas', COUNT(*) FROM discovered_ctas
UNION ALL
SELECT 'tenant_usage', COUNT(*) FROM tenant_usage
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns;

-- All counts should be 0

-- =====================================================
-- Cleanup Complete!
-- =====================================================
-- Summary:
-- ✅ All tenant data deleted
-- ✅ All websites deleted
-- ✅ All pages and CTAs deleted
-- ✅ All leads, contacts, companies deleted
-- ✅ All activities and scoring data deleted
-- ✅ All usage tracking deleted
-- ✅ Sequences reset to 1
-- ✅ Database vacuumed
--
-- Your database is now clean and ready for fresh data!
-- =====================================================
