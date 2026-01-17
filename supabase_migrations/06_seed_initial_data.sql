-- =====================================================
-- Lead Scoring System - Initial Seed Data
-- Part 6: Default Configuration and Sample Data
-- =====================================================

-- =====================================================
-- Insert Default Scoring Thresholds
-- =====================================================
INSERT INTO scoring_thresholds (classification_name, min_score, max_score, recommended_action, auto_assign_to_role, sla_response_hours) VALUES
('hot', 80, 200, 'Immediate contact by senior sales rep. Schedule demo within 24 hours.', 'senior_rep', 2),
('warm', 60, 79, 'Contact within 48 hours. Send personalized email with case studies.', 'sdr', 24),
('qualified', 40, 59, 'Add to nurturing campaign. Send educational content weekly.', 'marketing', 72),
('cold', 20, 39, 'Low priority nurturing. Monthly newsletter only.', 'marketing', NULL),
('unqualified', 0, 19, 'Review for disqualification. Minimal engagement.', NULL, NULL);

-- =====================================================
-- Insert Default Demographic Scoring Rules
-- =====================================================
INSERT INTO scoring_rules_demographic (rule_name, rule_category, condition_field, condition_operator, condition_value, points_awarded, priority_order) VALUES
-- Company Size Rules
('Large Enterprise (1000+ employees)', 'company_size', 'employee_count', 'greater_than', '1000', 15, 1),
('Mid-Market (250-999 employees)', 'company_size', 'employee_count', 'between', '250,999', 12, 2),
('SME (50-249 employees)', 'company_size', 'employee_count', 'between', '50,249', 8, 3),
('Small Business (10-49 employees)', 'company_size', 'employee_count', 'between', '10,49', 5, 4),

-- Revenue Rules
('High Revenue (100+ Crore)', 'revenue', 'revenue_inr_crore', 'greater_than', '100', 15, 5),
('Medium Revenue (10-100 Crore)', 'revenue', 'revenue_inr_crore', 'between', '10,100', 10, 6),
('Growing Revenue (1-10 Crore)', 'revenue', 'revenue_inr_crore', 'between', '1,10', 5, 7),

-- Industry Rules (Target Industries)
('Technology/Software', 'industry', 'industry', 'equals', 'Technology', 12, 10),
('Manufacturing', 'industry', 'industry', 'equals', 'Manufacturing', 10, 11),
('Financial Services', 'industry', 'industry', 'equals', 'Financial Services', 10, 12),
('Healthcare', 'industry', 'industry', 'equals', 'Healthcare', 8, 13),
('E-commerce/Retail', 'industry', 'industry', 'equals', 'Retail', 8, 14),

-- Contact Title Rules
('C-Level Executive', 'contact_title', 'seniority_level', 'equals', 'c_level', 15, 20),
('VP Level', 'contact_title', 'seniority_level', 'equals', 'vp', 12, 21),
('Director Level', 'contact_title', 'seniority_level', 'equals', 'director', 10, 22),
('Manager Level', 'contact_title', 'seniority_level', 'equals', 'manager', 6, 23),

-- Authority Rules
('Budget Authority', 'authority', 'has_budget_authority', 'equals', 'true', 10, 30),
('Technical Authority', 'authority', 'has_technical_authority', 'equals', 'true', 8, 31),

-- Location Rules (Tier-1 Cities)
('Mumbai Location', 'location', 'location_city', 'equals', 'Mumbai', 5, 40),
('Delhi/NCR Location', 'location', 'location_city', 'in', 'Delhi,Noida,Gurgaon,Faridabad', 5, 41),
('Bangalore Location', 'location', 'location_city', 'equals', 'Bangalore', 5, 42),
('Pune Location', 'location', 'location_city', 'equals', 'Pune', 4, 43),
('Hyderabad Location', 'location', 'location_city', 'equals', 'Hyderabad', 4, 44);

-- =====================================================
-- Insert Default Behavioral Scoring Rules
-- =====================================================
INSERT INTO scoring_rules_behavioral (rule_name, activity_type, activity_subtype, intent_level, base_points, repeat_multiplier, time_window_days, max_occurrences, decay_days) VALUES
-- High Intent Actions
('Demo Request', 'form_submission', 'demo_request', 'high', 25, 1.00, 30, 1, 90),
('Contact Sales', 'form_submission', 'contact_sales', 'high', 30, 1.00, 30, 1, 90),
('Free Trial Signup', 'form_submission', 'trial_signup', 'high', 20, 1.00, 30, 1, 60),
('Pricing Page View', 'page_view', 'pricing', 'high', 15, 1.20, 7, 3, 30),
('Product Comparison View', 'page_view', 'comparison', 'high', 12, 1.10, 7, 2, 30),

-- Medium Intent Actions
('Whitepaper Download', 'content_download', 'whitepaper', 'medium', 10, 1.00, 30, 3, 60),
('Case Study View', 'content_view', 'case_study', 'medium', 8, 1.00, 30, 5, 60),
('Webinar Registration', 'event_registration', 'webinar', 'medium', 15, 1.00, 60, 2, 90),
('Webinar Attendance', 'event_attendance', 'webinar', 'high', 20, 1.00, 60, 2, 90),
('Product Page View', 'page_view', 'product', 'medium', 8, 1.15, 7, 5, 30),
('Email Link Click', 'email_engagement', 'click', 'medium', 5, 1.10, 14, 10, 30),

-- Low Intent Actions
('Email Open', 'email_engagement', 'open', 'low', 3, 1.05, 14, 10, 30),
('Blog Post View', 'page_view', 'blog', 'low', 2, 1.00, 30, 10, 45),
('Newsletter Signup', 'form_submission', 'newsletter', 'low', 5, 1.00, 90, 1, 180),
('Homepage Visit', 'page_view', 'homepage', 'low', 2, 1.00, 7, 5, 30),

-- Engagement Actions
('Multiple Page Session (3+)', 'session', 'multi_page', 'medium', 8, 1.00, 7, 3, 30),
('Return Visitor (within 7 days)', 'session', 'return_visit', 'medium', 5, 1.00, 7, 3, 30),
('Video Watch (>50%)', 'content_view', 'video', 'medium', 7, 1.00, 30, 5, 45);

-- =====================================================
-- Insert Default Negative Scoring Rules
-- =====================================================
INSERT INTO scoring_rules_negative (rule_name, rule_category, condition_field, condition_operator, condition_value, points_deducted, is_disqualifying) VALUES
-- Inactivity
('No Activity 30 Days', 'inactive', 'last_activity_date', 'days_since', '30', 10, false),
('No Activity 60 Days', 'inactive', 'last_activity_date', 'days_since', '60', 20, false),
('No Activity 90 Days', 'inactive', 'last_activity_date', 'days_since', '90', 30, false),

-- Wrong Fit
('Too Small (< 5 employees)', 'wrong_fit', 'employee_count', 'less_than', '5', 20, true),
('Student Email Domain', 'wrong_fit', 'email', 'contains', '@student,@edu.', 15, true),
('Competitor Domain', 'competitor', 'email', 'contains', '@competitor.com', 50, true),

-- Invalid Contact
('Bounced Email', 'invalid_contact', 'email_status', 'equals', 'bounced', 25, true),
('Unsubscribed', 'invalid_contact', 'email_status', 'equals', 'unsubscribed', 30, true),

-- Budget
('No Budget Authority', 'no_budget', 'has_budget_authority', 'equals', 'false', 5, false);

-- =====================================================
-- Insert Default Score Decay Rules
-- =====================================================
INSERT INTO score_decay_rules (rule_name, inactivity_days, decay_points, decay_type, applies_to_score_type, min_score_threshold) VALUES
('Weekly Decay', 7, 5, 'fixed', 'behavioral', 10),
('Bi-Weekly Decay', 14, 10, 'fixed', 'behavioral', 10),
('Monthly Decay', 30, 15, 'fixed', 'behavioral', 5),
('Quarterly Decay', 90, 25, 'percentage', 'total', 0);

-- =====================================================
-- Insert Sample Industry Scoring Profiles
-- =====================================================
INSERT INTO industry_scoring_profiles (
    industry_name,
    demographic_weight,
    behavioral_weight,
    ideal_company_size_min,
    ideal_company_size_max,
    ideal_revenue_min,
    ideal_revenue_max,
    key_decision_maker_titles,
    high_intent_activities,
    avg_sales_cycle_days
) VALUES
('Technology', 0.40, 0.60, 50, 5000, 5.00, 500.00,
 '["CTO", "VP Engineering", "Head of Technology", "CEO"]'::jsonb,
 '["demo_request", "trial_signup", "api_documentation"]'::jsonb,
 45),

('Manufacturing', 0.60, 0.40, 100, 10000, 10.00, 1000.00,
 '["COO", "Production Manager", "Plant Manager", "VP Operations"]'::jsonb,
 '["demo_request", "case_study", "contact_sales"]'::jsonb,
 90),

('Financial Services', 0.50, 0.50, 50, 2000, 20.00, 1000.00,
 '["CFO", "Finance Director", "Head of Finance", "Controller"]'::jsonb,
 '["demo_request", "compliance_whitepaper", "security_documentation"]'::jsonb,
 120),

('Healthcare', 0.55, 0.45, 20, 5000, 5.00, 500.00,
 '["Medical Director", "Hospital Administrator", "CIO", "Practice Manager"]'::jsonb,
 '["demo_request", "hipaa_compliance", "case_study"]'::jsonb,
 75),

('Retail', 0.45, 0.55, 10, 1000, 2.00, 200.00,
 '["CMO", "E-commerce Manager", "Retail Operations Manager", "CEO"]'::jsonb,
 '["trial_signup", "pricing_page", "roi_calculator"]'::jsonb,
 30);

-- =====================================================
-- Insert Sample Admin User
-- Note: In production, users should be created through Supabase Auth
-- This is just a placeholder for testing
-- =====================================================
INSERT INTO users (email, first_name, last_name, role, team) VALUES
('admin@zopkit.com', 'Admin', 'User', 'admin', 'Management'),
('sales.manager@zopkit.com', 'Sales', 'Manager', 'sales_manager', 'Sales'),
('john.sdr@zopkit.com', 'John', 'Doe', 'sdr', 'Sales'),
('jane.rep@zopkit.com', 'Jane', 'Smith', 'senior_rep', 'Sales'),
('marketing@zopkit.com', 'Marketing', 'Team', 'marketing', 'Marketing');

-- =====================================================
-- Create indexes for JSONB columns
-- =====================================================
CREATE INDEX idx_industry_profiles_titles ON industry_scoring_profiles USING GIN (key_decision_maker_titles);
CREATE INDEX idx_industry_profiles_activities ON industry_scoring_profiles USING GIN (high_intent_activities);
CREATE INDEX idx_activities_details ON lead_activities USING GIN (activity_details);
CREATE INDEX idx_ai_predictions_factors ON ai_model_predictions USING GIN (contributing_factors);
