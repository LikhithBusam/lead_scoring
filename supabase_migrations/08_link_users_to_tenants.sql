-- =====================================================
-- Migration: Link Users to Tenants for Traditional Login
-- =====================================================
-- This migration adds tenant_id to users table to enable
-- traditional email/password login with tenant context
-- =====================================================

-- STEP 1: Add password_hash column to users table (for authentication)
-- =====================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- STEP 2: Add last_login_at column to users table
-- =====================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- STEP 3: Add tenant_id column to users table
-- =====================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- STEP 4: Update role constraint to include 'user' and 'sales' roles
-- =====================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'sales_manager', 'senior_rep', 'sdr', 'marketing', 'user', 'sales'));

-- STEP 2: Create a view for user-tenant lookup
-- =====================================================
CREATE OR REPLACE VIEW user_tenant_view AS
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active,
    u.tenant_id,
    t.company_name,
    t.api_key,
    t.plan_type,
    t.domain
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.tenant_id;

-- STEP 3: Function to create user with tenant
-- =====================================================
CREATE OR REPLACE FUNCTION create_user_with_tenant(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_role VARCHAR(50),
    p_tenant_id UUID
)
RETURNS TABLE (
    user_id BIGINT,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50),
    tenant_id UUID
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id, is_active)
    VALUES (p_email, p_password_hash, p_first_name, p_last_name, p_role, p_tenant_id, true)
    RETURNING users.user_id, users.email, users.first_name, users.last_name, users.role, users.tenant_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Update RLS policy for users table to include tenant isolation
-- =====================================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Create tenant-aware policies
CREATE POLICY "Users can view own profile and tenant members" ON users
    FOR SELECT USING (
        -- User can view their own profile
        auth.uid()::text = email 
        OR 
        -- Admins can view all users in their tenant
        (auth.jwt() ->> 'role' = 'admin' AND tenant_id = (
            SELECT u.tenant_id FROM users u WHERE u.email = auth.uid()::text
        ))
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = email);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access on users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- STEP 5: Create tenant admin user helper
-- =====================================================
-- This function creates the first admin user for a tenant during registration
CREATE OR REPLACE FUNCTION create_tenant_admin(
    p_tenant_id UUID,
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100)
)
RETURNS BIGINT AS $$
DECLARE
    v_user_id BIGINT;
BEGIN
    INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id, is_active)
    VALUES (p_email, p_password_hash, p_first_name, p_last_name, 'admin', p_tenant_id, true)
    RETURNING user_id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✅ Added tenant_id to users table
-- ✅ Created index for performance
-- ✅ Created user_tenant_view for easy lookups
-- ✅ Created helper functions
-- ✅ Updated RLS policies for tenant isolation
-- =====================================================
