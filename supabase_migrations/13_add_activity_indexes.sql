-- =====================================================
-- Migration: Add Performance Indexes for Activities
-- =====================================================
-- This migration adds indexes to improve query performance
-- for momentum calculation and activity lookups
-- =====================================================

-- Index for activity timestamp queries (momentum calculation)
CREATE INDEX IF NOT EXISTS idx_lead_activities_timestamp
ON lead_activities(activity_timestamp DESC);

-- Composite index for tenant + lead + timestamp (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_lead_time
ON lead_activities(tenant_id, lead_id, activity_timestamp DESC);

-- Index for contact-based activity lookups
CREATE INDEX IF NOT EXISTS idx_lead_activities_contact_time
ON lead_activities(tenant_id, contact_id, activity_timestamp DESC);

-- Index for activity type filtering
CREATE INDEX IF NOT EXISTS idx_lead_activities_type
ON lead_activities(activity_type);

-- Partial index for high-intent activities (faster momentum calculation)
CREATE INDEX IF NOT EXISTS idx_lead_activities_high_intent
ON lead_activities(tenant_id, lead_id, activity_timestamp DESC)
WHERE activity_type IN ('pricing_page', 'demo_request', 'contact_sales', 'free_trial', 'quote_request');

-- Note: Cannot create partial index with NOW() as it's not IMMUTABLE
-- The composite index above (idx_lead_activities_tenant_lead_time) will handle
-- recent activity queries efficiently with proper query planning

-- =====================================================
-- Summary
-- =====================================================
-- Added indexes:
-- 1. idx_lead_activities_timestamp - General timestamp ordering
-- 2. idx_lead_activities_tenant_lead_time - Tenant+Lead+Time queries
-- 3. idx_lead_activities_contact_time - Contact activity lookups
-- 4. idx_lead_activities_type - Activity type filtering
-- 5. idx_lead_activities_high_intent - High-intent activity queries
-- =====================================================
