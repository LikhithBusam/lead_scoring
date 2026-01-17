-- =====================================================
-- Lead Scoring System - Core Tables Migration
-- Part 1: Companies, Contacts, Leads, Users, Campaigns
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE (Create first as it's referenced by leads)
-- =====================================================
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales_manager', 'senior_rep', 'sdr', 'marketing')),
    team VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

COMMENT ON TABLE users IS 'Sales team and user management';

-- =====================================================
-- 2. CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE campaigns (
    campaign_id BIGSERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(100),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15,2),
    target_industry VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_industry ON campaigns(target_industry);

COMMENT ON TABLE campaigns IS 'Marketing campaign tracking';

-- =====================================================
-- 3. COMPANIES TABLE
-- =====================================================
CREATE TABLE companies (
    company_id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    sub_industry VARCHAR(100),
    employee_count INTEGER,
    revenue_inr_crore DECIMAL(10,2),
    revenue_currency VARCHAR(3) DEFAULT 'INR',
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_country VARCHAR(3) DEFAULT 'IND',
    is_multi_location BOOLEAN DEFAULT FALSE,
    is_export_focused BOOLEAN DEFAULT FALSE,
    gst_number VARCHAR(15) UNIQUE,
    website VARCHAR(255),
    company_type VARCHAR(50) CHECK (company_type IN ('startup', 'sme', 'mid_market', 'enterprise')),
    founded_year INTEGER,
    linkedin_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_location_city ON companies(location_city);
CREATE INDEX idx_companies_type ON companies(company_type);
CREATE INDEX idx_companies_name ON companies(company_name);

COMMENT ON TABLE companies IS 'Firmographic data for B2B lead scoring';

-- =====================================================
-- 4. CONTACTS TABLE
-- =====================================================
CREATE TABLE contacts (
    contact_id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(company_id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    mobile VARCHAR(20),
    job_title VARCHAR(150),
    department VARCHAR(100),
    seniority_level VARCHAR(50) CHECK (seniority_level IN ('c_level', 'vp', 'director', 'manager', 'individual')),
    has_budget_authority BOOLEAN DEFAULT FALSE,
    has_technical_authority BOOLEAN DEFAULT FALSE,
    is_primary_contact BOOLEAN DEFAULT FALSE,
    linkedin_url VARCHAR(255),
    preferred_language VARCHAR(5) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id, is_primary_contact);
CREATE INDEX idx_contacts_job_title ON contacts(job_title);
CREATE INDEX idx_contacts_seniority ON contacts(seniority_level);

COMMENT ON TABLE contacts IS 'Individual contact information for leads';

-- =====================================================
-- 5. LEADS TABLE
-- =====================================================
CREATE TABLE leads (
    lead_id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT REFERENCES contacts(contact_id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES companies(company_id) ON DELETE CASCADE,
    lead_source VARCHAR(100) NOT NULL,
    lead_source_detail VARCHAR(255),
    campaign_id BIGINT REFERENCES campaigns(campaign_id),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    current_stage VARCHAR(50) CHECK (current_stage IN ('new', 'mql', 'sal', 'sql', 'opportunity', 'won', 'lost')),
    lead_status VARCHAR(50) CHECK (lead_status IN ('active', 'nurturing', 'qualified', 'disqualified', 'converted')),
    assigned_to_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    first_contact_date TIMESTAMP WITH TIME ZONE,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    expected_close_date DATE,
    deal_value_inr DECIMAL(15,2),
    deal_probability DECIMAL(5,2),
    conversion_date TIMESTAMP WITH TIME ZONE,
    disqualification_reason VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_leads_status_stage ON leads(lead_status, current_stage);
CREATE INDEX idx_leads_assigned ON leads(assigned_to_user_id, current_stage);
CREATE INDEX idx_leads_created ON leads(created_at);
CREATE INDEX idx_leads_source ON leads(lead_source);
CREATE INDEX idx_leads_contact ON leads(contact_id);
CREATE INDEX idx_leads_company ON leads(company_id);

COMMENT ON TABLE leads IS 'Central lead management table';

-- =====================================================
-- Update Triggers for updated_at columns
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
