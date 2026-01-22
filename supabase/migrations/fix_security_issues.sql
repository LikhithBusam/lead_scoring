-- =====================================================
-- FIX SUPABASE SECURITY ADVISOR ISSUES
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- =====================================================
-- ISSUE 1: Security Definer View (user_tenant_view)
-- Problem: Views with SECURITY DEFINER run with owner privileges,
--          which can bypass RLS policies
-- Solution: Change to SECURITY INVOKER (runs with caller's privileges)
-- =====================================================

-- First, let's check the current view definition
-- SELECT pg_get_viewdef('public.user_tenant_view', true);

-- Drop and recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.user_tenant_view;

CREATE VIEW public.user_tenant_view
WITH (security_invoker = true)
AS
SELECT
    u.id AS user_id,
    u.email,
    u.role,
    u.created_at AS user_created_at,
    t.id AS tenant_id,
    t.company_name,
    t.api_key,
    t.subscription_tier,
    t.is_active AS tenant_active,
    t.created_at AS tenant_created_at
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id;

-- Grant appropriate permissions
GRANT SELECT ON public.user_tenant_view TO authenticated;
GRANT SELECT ON public.user_tenant_view TO service_role;

-- =====================================================
-- ISSUE 2: RLS Disabled on system_scoring_rules
-- Problem: Table is publicly accessible without RLS
-- Solution: Enable RLS and create appropriate policies
-- =====================================================

-- Enable Row Level Security
ALTER TABLE public.system_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to read scoring rules (read-only)
CREATE POLICY "Allow authenticated users to read scoring rules"
ON public.system_scoring_rules
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow service role full access (for admin operations)
CREATE POLICY "Allow service role full access to scoring rules"
ON public.system_scoring_rules
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 3: Allow admins to manage scoring rules
CREATE POLICY "Allow admins to manage scoring rules"
ON public.system_scoring_rules
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- =====================================================
-- VERIFICATION QUERIES (run after applying fixes)
-- =====================================================

-- Check view security setting
-- SELECT viewname, definition FROM pg_views WHERE viewname = 'user_tenant_view';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'system_scoring_rules';

-- List RLS policies on the table
-- SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'system_scoring_rules';
