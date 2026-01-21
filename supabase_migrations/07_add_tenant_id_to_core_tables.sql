    -- =====================================================
    -- Migration: Add tenant_id to Core Tables for RLS
    -- =====================================================
    -- This migration adds tenant_id columns to core tables
    -- and updates RLS policies to properly enforce multi-tenant isolation
    -- =====================================================

    -- STEP 1: Add tenant_id column to companies table
    -- =====================================================
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);

    -- STEP 2: Add tenant_id column to contacts table
    -- =====================================================
    ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);

    -- STEP 3: Add tenant_id column to leads table
    -- =====================================================
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);

    -- STEP 4: Add tenant_id column to lead_scores table
    -- =====================================================
    ALTER TABLE lead_scores
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_lead_scores_tenant_id ON lead_scores(tenant_id);

    -- STEP 5: Add tenant_id column to score_history table
    -- =====================================================
    ALTER TABLE score_history
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_score_history_tenant_id ON score_history(tenant_id);

    -- STEP 6: Add tenant_id column to lead_activities table
    -- =====================================================
    ALTER TABLE lead_activities
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_id ON lead_activities(tenant_id);

    -- =====================================================
    -- STEP 7: Update Existing Data (if any)
    -- =====================================================
    -- Note: This sets tenant_id for existing records based on relationships
    -- The primary source of tenant_id is from lead_activities table
    -- =====================================================

    -- Step 7a: Update leads from lead_activities (most reliable source)
    -- Lead activities already have tenant_id from tracking API
    UPDATE leads l
    SET tenant_id = (
        SELECT la.tenant_id
        FROM lead_activities la
        WHERE la.lead_id = l.lead_id
        AND la.tenant_id IS NOT NULL
        LIMIT 1
    )
    WHERE l.tenant_id IS NULL
    AND EXISTS (
        SELECT 1 FROM lead_activities la
        WHERE la.lead_id = l.lead_id
        AND la.tenant_id IS NOT NULL
    );

    -- Step 7b: Update contacts from their associated leads
    UPDATE contacts ct
    SET tenant_id = l.tenant_id
    FROM leads l
    WHERE ct.contact_id = l.contact_id
    AND ct.tenant_id IS NULL
    AND l.tenant_id IS NOT NULL;

    -- Step 7c: Update companies from their associated contacts
    UPDATE companies c
    SET tenant_id = ct.tenant_id
    FROM contacts ct
    WHERE c.company_id = ct.company_id
    AND c.tenant_id IS NULL
    AND ct.tenant_id IS NOT NULL;

    -- Step 7d: Update lead_scores from associated leads
    UPDATE lead_scores ls
    SET tenant_id = l.tenant_id
    FROM leads l
    WHERE ls.lead_id = l.lead_id
    AND ls.tenant_id IS NULL
    AND l.tenant_id IS NOT NULL;

    -- Step 7e: Update score_history from associated leads
    UPDATE score_history sh
    SET tenant_id = l.tenant_id
    FROM leads l
    WHERE sh.lead_id = l.lead_id
    AND sh.tenant_id IS NULL
    AND l.tenant_id IS NOT NULL;

    -- Step 7f: Ensure all lead_activities have tenant_id
    -- This should already be populated by the tracking API, but just in case
    UPDATE lead_activities la
    SET tenant_id = l.tenant_id
    FROM leads l
    WHERE la.lead_id = l.lead_id
    AND la.tenant_id IS NULL
    AND l.tenant_id IS NOT NULL;

    -- =====================================================
    -- STEP 8: Drop Old RLS Policies (Role-Based)
    -- =====================================================

    -- Drop old leads policies
    DROP POLICY IF EXISTS "Users can view assigned leads" ON leads;
    DROP POLICY IF EXISTS "Sales team can create leads" ON leads;
    DROP POLICY IF EXISTS "Users can update assigned leads" ON leads;
    DROP POLICY IF EXISTS "Allow public lead submission" ON leads;

    -- Drop old contacts policies
    DROP POLICY IF EXISTS "Users can view company contacts" ON contacts;
    DROP POLICY IF EXISTS "Users can create contacts" ON contacts;
    DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
    DROP POLICY IF EXISTS "Allow public contact creation" ON contacts;

    -- Drop old companies policies
    DROP POLICY IF EXISTS "Users can view companies" ON companies;
    DROP POLICY IF EXISTS "Users can create companies" ON companies;
    DROP POLICY IF EXISTS "Users can update companies" ON companies;

    -- Drop old lead_activities policies
    DROP POLICY IF EXISTS "Users can view activities for assigned leads" ON lead_activities;
    DROP POLICY IF EXISTS "Users can create lead activities" ON lead_activities;

    -- Drop old lead_scores policies
    DROP POLICY IF EXISTS "Users can view scores for assigned leads" ON lead_scores;
    DROP POLICY IF EXISTS "System can update lead scores" ON lead_scores;

    -- =====================================================
    -- STEP 9: Create New Tenant-Based RLS Policies
    -- =====================================================

    -- ========== COMPANIES TABLE ==========
    CREATE POLICY "Tenant isolation for companies" ON companies
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ========== CONTACTS TABLE ==========
    CREATE POLICY "Tenant isolation for contacts" ON contacts
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ========== LEADS TABLE ==========
    CREATE POLICY "Tenant isolation for leads" ON leads
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ========== LEAD_SCORES TABLE ==========
    CREATE POLICY "Tenant isolation for lead_scores" ON lead_scores
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ========== SCORE_HISTORY TABLE ==========
    CREATE POLICY "Tenant isolation for score_history" ON score_history
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ========== LEAD_ACTIVITIES TABLE ==========
    CREATE POLICY "Tenant isolation for lead_activities" ON lead_activities
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- =====================================================
    -- STEP 10: Create Function to Set Current Tenant
    -- =====================================================

    -- This function is called by the backend to set the tenant context
    CREATE OR REPLACE FUNCTION set_current_tenant(tenant_uuid UUID)
    RETURNS void AS $$
    BEGIN
        -- Set the tenant_id in the session
        PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION set_current_tenant(UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION set_current_tenant(UUID) TO anon;

    -- =====================================================
    -- STEP 11: Add NOT NULL Constraints (After Data Migration)
    -- =====================================================
    -- WARNING: Uncomment these ONLY after ensuring all existing data has tenant_id populated
    -- This enforces that all future records MUST have a tenant_id

    -- ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL;
    -- ALTER TABLE contacts ALTER COLUMN tenant_id SET NOT NULL;
    -- ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;
    -- ALTER TABLE lead_scores ALTER COLUMN tenant_id SET NOT NULL;
    -- ALTER TABLE score_history ALTER COLUMN tenant_id SET NOT NULL;
    -- lead_activities already has tenant_id NOT NULL from original schema

    -- =====================================================
    -- STEP 12: Verification Queries
    -- =====================================================

    -- Run these queries AFTER migration to verify:

    -- 1. Check if all companies have tenant_id
    -- SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant_id FROM companies;

    -- 2. Check if all contacts have tenant_id
    -- SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant_id FROM contacts;

    -- 3. Check if all leads have tenant_id
    -- SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant_id FROM leads;

    -- 4. List all active RLS policies
    -- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
    -- FROM pg_policies
    -- WHERE tablename IN ('companies', 'contacts', 'leads', 'lead_scores', 'score_history', 'lead_activities')
    -- ORDER BY tablename, policyname;

    -- =====================================================
    -- Migration Complete
    -- =====================================================
    -- Summary:
    -- ✅ Added tenant_id to all core tables
    -- ✅ Created indexes for performance
    -- ✅ Updated existing data with tenant_id
    -- ✅ Replaced role-based RLS with tenant-based RLS
    -- ✅ Created set_current_tenant() function
    -- ✅ Proper multi-tenant isolation at database level
    -- =====================================================
