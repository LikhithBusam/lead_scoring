-- =====================================================
-- Migration: Fix Missing Columns for Tracking & Usage
-- =====================================================
-- This migration adds missing columns that the code expects
-- but were not in the original schema
-- =====================================================

-- STEP 1: Fix lead_activities table - add missing columns
-- =====================================================

-- Add visitor_id column (required for tracking)
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(255);

-- Add page_title column (for page view tracking)
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS page_title VARCHAR(255);

-- Add session_id column (for session tracking)
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Create index for visitor lookups
CREATE INDEX IF NOT EXISTS idx_lead_activities_visitor_id ON lead_activities(visitor_id);

-- STEP 2: Fix tenant_usage table - add missing columns
-- =====================================================

-- First, let's check what columns exist and add what's missing

-- Add api_calls_made column
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS api_calls_made INTEGER DEFAULT 0;

-- Add month column (1-12)
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS month INTEGER;

-- Add year column
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Add leads_created column
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS leads_created INTEGER DEFAULT 0;

-- Add events_tracked column
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS events_tracked INTEGER DEFAULT 0;

-- Add storage_used_mb column
ALTER TABLE tenant_usage
ADD COLUMN IF NOT EXISTS storage_used_mb DECIMAL(10,2) DEFAULT 0;

-- Create index for month/year lookups
CREATE INDEX IF NOT EXISTS idx_tenant_usage_period ON tenant_usage(tenant_id, month, year);

-- STEP 2.5: Fix lead_activities NOT NULL constraint on activity_title
-- =====================================================
ALTER TABLE lead_activities ALTER COLUMN activity_title DROP NOT NULL;

-- STEP 3: Add constraint for month value
-- =====================================================
ALTER TABLE tenant_usage DROP CONSTRAINT IF EXISTS tenant_usage_month_check;
ALTER TABLE tenant_usage ADD CONSTRAINT tenant_usage_month_check 
    CHECK (month >= 1 AND month <= 12);

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✅ Added visitor_id, page_title, session_id to lead_activities
-- ✅ Added api_calls_made, month, year, leads_created, events_tracked to tenant_usage
-- ✅ Created performance indexes
-- =====================================================

-- After running this migration, tracking should work correctly!
