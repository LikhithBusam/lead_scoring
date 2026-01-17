-- =====================================================
-- Lead Scoring System - Scoring Tables Migration
-- Part 2: Scoring, Rules, and Configuration Tables
-- =====================================================

-- =====================================================
-- 6. LEAD_SCORES TABLE
-- =====================================================
CREATE TABLE lead_scores (
    score_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    demographic_score INTEGER DEFAULT 0 CHECK (demographic_score >= 0 AND demographic_score <= 50),
    behavioral_score INTEGER DEFAULT 0 CHECK (behavioral_score >= 0 AND behavioral_score <= 100),
    negative_score INTEGER DEFAULT 0,
    engagement_multiplier DECIMAL(3,2) DEFAULT 1.00 CHECK (engagement_multiplier >= 1.00 AND engagement_multiplier <= 2.00),
    total_score INTEGER DEFAULT 0,
    score_classification VARCHAR(50) CHECK (score_classification IN ('hot', 'warm', 'qualified', 'cold', 'unqualified')),
    ai_predicted_score INTEGER,
    ai_confidence_level DECIMAL(5,2),
    predicted_close_probability DECIMAL(5,2),
    last_score_change INTEGER DEFAULT 0,
    score_trend VARCHAR(50) CHECK (score_trend IN ('increasing', 'stable', 'decreasing')),
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX idx_scores_classification ON lead_scores(score_classification, total_score);
CREATE INDEX idx_scores_calculated ON lead_scores(last_calculated_at);
CREATE INDEX idx_scores_total ON lead_scores(total_score DESC);

COMMENT ON TABLE lead_scores IS 'Current lead scoring snapshot';

-- =====================================================
-- 7. SCORE_HISTORY TABLE
-- =====================================================
CREATE TABLE score_history (
    history_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    score_id BIGINT REFERENCES lead_scores(score_id) ON DELETE SET NULL,
    demographic_score INTEGER NOT NULL,
    behavioral_score INTEGER NOT NULL,
    negative_score INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    score_classification VARCHAR(50) NOT NULL,
    change_reason VARCHAR(255),
    triggered_by_activity_id BIGINT,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_lead ON score_history(lead_id, calculated_at DESC);
CREATE INDEX idx_history_calculated ON score_history(calculated_at);

COMMENT ON TABLE score_history IS 'Historical scoring data for analytics';

-- =====================================================
-- 8. SCORING_RULES_DEMOGRAPHIC TABLE
-- =====================================================
CREATE TABLE scoring_rules_demographic (
    rule_id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_category VARCHAR(50) CHECK (rule_category IN ('company_size', 'industry', 'location', 'revenue', 'contact_title', 'authority')),
    condition_field VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(50) CHECK (condition_operator IN ('equals', 'not_equals', 'in', 'not_in', 'between', 'greater_than', 'less_than')),
    condition_value TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    priority_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    applies_to_industry VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_demo_rules_category ON scoring_rules_demographic(rule_category, is_active);
CREATE INDEX idx_demo_rules_priority ON scoring_rules_demographic(priority_order);

COMMENT ON TABLE scoring_rules_demographic IS 'Demographic scoring criteria configuration';

-- =====================================================
-- 9. SCORING_RULES_BEHAVIORAL TABLE
-- =====================================================
CREATE TABLE scoring_rules_behavioral (
    rule_id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    activity_subtype VARCHAR(100),
    intent_level VARCHAR(50) CHECK (intent_level IN ('high', 'medium', 'low')),
    base_points INTEGER NOT NULL,
    repeat_multiplier DECIMAL(3,2) DEFAULT 1.00,
    time_window_days INTEGER DEFAULT 7,
    max_occurrences INTEGER,
    decay_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    applies_to_industry VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_behav_rules_type ON scoring_rules_behavioral(activity_type, is_active);
CREATE INDEX idx_behav_rules_intent ON scoring_rules_behavioral(intent_level);

COMMENT ON TABLE scoring_rules_behavioral IS 'Behavioral scoring criteria configuration';

-- =====================================================
-- 10. SCORING_RULES_NEGATIVE TABLE
-- =====================================================
CREATE TABLE scoring_rules_negative (
    rule_id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_category VARCHAR(50) CHECK (rule_category IN ('wrong_fit', 'competitor', 'invalid_contact', 'no_budget', 'inactive', 'time_decay')),
    condition_field VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(50) CHECK (condition_operator IN ('equals', 'contains', 'less_than', 'greater_than', 'days_since')),
    condition_value TEXT NOT NULL,
    points_deducted INTEGER NOT NULL,
    is_disqualifying BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_neg_rules_category ON scoring_rules_negative(rule_category, is_active);

COMMENT ON TABLE scoring_rules_negative IS 'Negative scoring and disqualification rules';

-- =====================================================
-- 11. SCORING_THRESHOLDS TABLE
-- =====================================================
CREATE TABLE scoring_thresholds (
    threshold_id BIGSERIAL PRIMARY KEY,
    classification_name VARCHAR(50) CHECK (classification_name IN ('hot', 'warm', 'qualified', 'cold', 'unqualified')),
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    recommended_action TEXT,
    auto_assign_to_role VARCHAR(100),
    sla_response_hours INTEGER,
    applies_to_industry VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thresholds_classification ON scoring_thresholds(classification_name);

COMMENT ON TABLE scoring_thresholds IS 'Lead classification thresholds';

-- =====================================================
-- 12. SCORE_DECAY_RULES TABLE
-- =====================================================
CREATE TABLE score_decay_rules (
    decay_rule_id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    inactivity_days INTEGER NOT NULL,
    decay_points INTEGER NOT NULL,
    decay_type VARCHAR(50) CHECK (decay_type IN ('fixed', 'percentage')),
    applies_to_score_type VARCHAR(50) CHECK (applies_to_score_type IN ('behavioral', 'total', 'all')),
    min_score_threshold INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_decay_rules_active ON score_decay_rules(is_active);

COMMENT ON TABLE score_decay_rules IS 'Time-based score decay configuration';

-- =====================================================
-- 13. INDUSTRY_SCORING_PROFILES TABLE
-- =====================================================
CREATE TABLE industry_scoring_profiles (
    profile_id BIGSERIAL PRIMARY KEY,
    industry_name VARCHAR(100) NOT NULL UNIQUE,
    demographic_weight DECIMAL(3,2) DEFAULT 0.50,
    behavioral_weight DECIMAL(3,2) DEFAULT 0.50,
    ideal_company_size_min INTEGER,
    ideal_company_size_max INTEGER,
    ideal_revenue_min DECIMAL(10,2),
    ideal_revenue_max DECIMAL(10,2),
    key_decision_maker_titles JSONB,
    high_intent_activities JSONB,
    avg_sales_cycle_days INTEGER,
    custom_scoring_rules JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_industry_profiles_name ON industry_scoring_profiles(industry_name);

COMMENT ON TABLE industry_scoring_profiles IS 'Industry-specific scoring customization';

-- =====================================================
-- Update Triggers
-- =====================================================
CREATE TRIGGER update_lead_scores_updated_at BEFORE UPDATE ON lead_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_rules_demographic_updated_at BEFORE UPDATE ON scoring_rules_demographic
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_rules_behavioral_updated_at BEFORE UPDATE ON scoring_rules_behavioral
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_rules_negative_updated_at BEFORE UPDATE ON scoring_rules_negative
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_thresholds_updated_at BEFORE UPDATE ON scoring_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_score_decay_rules_updated_at BEFORE UPDATE ON score_decay_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_industry_scoring_profiles_updated_at BEFORE UPDATE ON industry_scoring_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
