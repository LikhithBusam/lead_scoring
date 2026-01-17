-- =====================================================
-- Lead Scoring System - Row Level Security (RLS) Policies
-- Part 5: Security and Access Control
-- =====================================================

-- =====================================================
-- Enable RLS on all tables
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules_demographic ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules_behavioral ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules_negative ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_decay_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_scoring_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities_website ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_engagement_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_source_performance ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS Table Policies
-- =====================================================
-- Users can read their own profile
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = email OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- Admins can manage all users
CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- COMPANIES Table Policies
-- =====================================================
-- All authenticated users can read companies
CREATE POLICY "Authenticated users can view companies" ON companies
    FOR SELECT USING (auth.role() = 'authenticated');

-- Sales reps and admins can create/update companies
CREATE POLICY "Sales team can manage companies" ON companies
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'senior_rep', 'sdr')
    );

-- =====================================================
-- CONTACTS Table Policies
-- =====================================================
-- All authenticated users can read contacts
CREATE POLICY "Authenticated users can view contacts" ON contacts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Sales team can manage contacts
CREATE POLICY "Sales team can manage contacts" ON contacts
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'senior_rep', 'sdr')
    );

-- =====================================================
-- LEADS Table Policies
-- =====================================================
-- Users can view leads assigned to them or all if admin/manager
CREATE POLICY "Users can view assigned leads" ON leads
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'sales_manager') OR
        assigned_to_user_id::text = auth.uid()::text
    );

-- Sales team can create leads
CREATE POLICY "Sales team can create leads" ON leads
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'senior_rep', 'sdr', 'marketing')
    );

-- Users can update their assigned leads
CREATE POLICY "Users can update assigned leads" ON leads
    FOR UPDATE USING (
        auth.jwt() ->> 'role' IN ('admin', 'sales_manager') OR
        assigned_to_user_id::text = auth.uid()::text
    );

-- Only admins can delete leads
CREATE POLICY "Admins can delete leads" ON leads
    FOR DELETE USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- LEAD_SCORES Table Policies
-- =====================================================
-- Users can view scores for their assigned leads
CREATE POLICY "Users can view scores for assigned leads" ON lead_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_scores.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

-- System can manage scores (use service role key)
CREATE POLICY "Service role can manage scores" ON lead_scores
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- ACTIVITIES Table Policies
-- =====================================================
-- Users can view activities for their assigned leads
CREATE POLICY "Users can view activities for assigned leads" ON lead_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_activities.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

-- System and marketing can create activities
CREATE POLICY "System can create activities" ON lead_activities
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('service_role', 'marketing', 'admin')
    );

-- Apply similar policies to activity sub-tables
CREATE POLICY "Users can view email activities" ON lead_activities_email
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_activities_email.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can view website activities" ON lead_activities_website
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_activities_website.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can view event activities" ON lead_activities_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_activities_events.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can view content activities" ON lead_activities_content
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_activities_content.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

-- =====================================================
-- SCORING RULES Policies (Configuration Tables)
-- =====================================================
-- All authenticated users can read scoring rules
CREATE POLICY "Users can view demographic rules" ON scoring_rules_demographic
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage demographic rules" ON scoring_rules_demographic
    FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

CREATE POLICY "Users can view behavioral rules" ON scoring_rules_behavioral
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage behavioral rules" ON scoring_rules_behavioral
    FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

CREATE POLICY "Users can view negative rules" ON scoring_rules_negative
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage negative rules" ON scoring_rules_negative
    FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- =====================================================
-- ANALYTICS Tables Policies
-- =====================================================
-- Admins and managers can view all analytics
CREATE POLICY "Managers can view performance metrics" ON scoring_performance_metrics
    FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing'));

CREATE POLICY "Managers can view score changes log" ON lead_score_changes_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.lead_id = lead_score_changes_log.lead_id
            AND (
                auth.jwt() ->> 'role' IN ('admin', 'sales_manager') OR
                leads.assigned_to_user_id::text = auth.uid()::text
            )
        )
    );

CREATE POLICY "Managers can view AI predictions" ON ai_model_predictions
    FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing'));

-- =====================================================
-- PUBLIC ACCESS for Anonymous Lead Capture
-- =====================================================
-- Allow anonymous form submissions to create contacts and leads
-- This is for website forms where users are not authenticated

-- Create a specific policy for public lead creation
CREATE POLICY "Allow public lead submission" ON leads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public contact creation" ON contacts
    FOR INSERT WITH CHECK (true);

-- Note: For production, you should validate these through Edge Functions
-- to prevent spam and ensure data quality

-- =====================================================
-- CAMPAIGNS Policies
-- =====================================================
CREATE POLICY "Marketing can manage campaigns" ON campaigns
    FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'marketing'));

CREATE POLICY "All can view active campaigns" ON campaigns
    FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');
