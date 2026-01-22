-- =====================================================
-- Migration: Add Authentication Fields to Users Table
-- =====================================================
-- This migration adds password authentication fields
-- to the existing users table for JWT-based auth
-- =====================================================

-- Add password_hash column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add tenant_id for multi-tenant support
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

-- Add last_login tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add updated_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create index on tenant_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Update role constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'sales', 'user', 'sales_manager', 'senior_rep', 'sdr', 'marketing'));

COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for authentication';
COMMENT ON COLUMN users.tenant_id IS 'Links user to a specific tenant/company';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';

-- =====================================================
-- Migration Complete
-- =====================================================
