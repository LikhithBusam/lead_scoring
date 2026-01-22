-- =====================================================
-- Migration: Add Momentum Fields for Intelligent Classification
-- =====================================================
-- This migration adds momentum tracking to the lead scoring system
-- enabling classification based on recent activity, not just score.
-- =====================================================

-- STEP 1: Add momentum fields to lead_scores table
-- =====================================================
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS momentum_score INTEGER DEFAULT 0
    CHECK (momentum_score >= 0 AND momentum_score <= 100);
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS momentum_level VARCHAR(20) DEFAULT 'none'
    CHECK (momentum_level IN ('high', 'medium', 'low', 'none'));
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS last_high_intent_action TIMESTAMP WITH TIME ZONE;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS classification_reason VARCHAR(255);
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS actions_last_24h INTEGER DEFAULT 0;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS actions_last_72h INTEGER DEFAULT 0;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS actions_last_7d INTEGER DEFAULT 0;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS surge_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS momentum_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- STEP 2: Add indexes for performance
-- =====================================================
-- Index for fast classification queries (momentum + classification)
CREATE INDEX IF NOT EXISTS idx_lead_scores_momentum ON lead_scores(momentum_level, score_classification);

-- Index for momentum level queries
CREATE INDEX IF NOT EXISTS idx_lead_scores_momentum_level ON lead_scores(momentum_level);

-- Index for finding leads with recent high-intent actions
CREATE INDEX IF NOT EXISTS idx_lead_scores_high_intent ON lead_scores(last_high_intent_action DESC NULLS LAST);

-- Index for surge detection queries
CREATE INDEX IF NOT EXISTS idx_lead_scores_surge ON lead_scores(surge_detected) WHERE surge_detected = TRUE;

-- STEP 3: Add momentum fields to score_history table
-- =====================================================
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS momentum_score INTEGER;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS momentum_level VARCHAR(20);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS classification_reason VARCHAR(255);

-- STEP 4: Create high-intent activity tracking view
-- =====================================================
-- This view helps identify high-intent activities for momentum calculation
CREATE OR REPLACE VIEW high_intent_activities AS
SELECT
    la.lead_id,
    la.tenant_id,
    la.activity_type,
    la.activity_subtype,
    la.activity_timestamp,
    la.points_earned,
    CASE
        WHEN la.activity_type IN ('pricing_page', 'demo_request', 'contact_sales', 'free_trial', 'quote_request') THEN 'high'
        WHEN la.activity_type IN ('product_page', 'case_study', 'whitepaper', 'webinar', 'product_comparison') THEN 'medium'
        ELSE 'low'
    END AS intent_level,
    CASE
        WHEN la.activity_type IN ('pricing_page', 'demo_request', 'contact_sales', 'free_trial', 'quote_request') THEN 3
        WHEN la.activity_type IN ('product_page', 'case_study', 'whitepaper', 'webinar', 'product_comparison') THEN 2
        ELSE 1
    END AS intent_multiplier
FROM lead_activities la
WHERE la.activity_timestamp > NOW() - INTERVAL '14 days';

-- Grant access to the view
GRANT SELECT ON high_intent_activities TO authenticated;
GRANT SELECT ON high_intent_activities TO anon;

-- STEP 5: Create function to calculate momentum for a lead
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_lead_momentum(p_lead_id BIGINT, p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    momentum_score INTEGER,
    momentum_level VARCHAR(20),
    actions_24h INTEGER,
    actions_72h INTEGER,
    actions_7d INTEGER,
    has_surge BOOLEAN,
    last_high_intent TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_momentum_score INTEGER := 0;
    v_weighted_score DECIMAL := 0;
    v_actions_24h INTEGER := 0;
    v_actions_72h INTEGER := 0;
    v_actions_7d INTEGER := 0;
    v_actions_1h INTEGER := 0;
    v_has_surge BOOLEAN := FALSE;
    v_last_high_intent TIMESTAMP WITH TIME ZONE;
    v_activity RECORD;
    v_hours_ago DECIMAL;
    v_time_weight DECIMAL;
    v_intent_multiplier INTEGER;
BEGIN
    -- Count actions in time windows
    SELECT
        COUNT(*) FILTER (WHERE activity_timestamp > NOW() - INTERVAL '24 hours'),
        COUNT(*) FILTER (WHERE activity_timestamp > NOW() - INTERVAL '72 hours'),
        COUNT(*) FILTER (WHERE activity_timestamp > NOW() - INTERVAL '7 days'),
        COUNT(*) FILTER (WHERE activity_timestamp > NOW() - INTERVAL '1 hour')
    INTO v_actions_24h, v_actions_72h, v_actions_7d, v_actions_1h
    FROM lead_activities
    WHERE lead_id = p_lead_id
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

    -- Detect surge (3+ actions in 1 hour)
    v_has_surge := v_actions_1h >= 3;

    -- Get last high-intent action
    SELECT activity_timestamp INTO v_last_high_intent
    FROM lead_activities
    WHERE lead_id = p_lead_id
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND activity_type IN ('pricing_page', 'demo_request', 'contact_sales', 'free_trial', 'quote_request')
    ORDER BY activity_timestamp DESC
    LIMIT 1;

    -- Calculate weighted momentum score
    FOR v_activity IN
        SELECT
            activity_type,
            activity_timestamp,
            EXTRACT(EPOCH FROM (NOW() - activity_timestamp)) / 3600 AS hours_ago
        FROM lead_activities
        WHERE lead_id = p_lead_id
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
          AND activity_timestamp > NOW() - INTERVAL '14 days'
        ORDER BY activity_timestamp DESC
    LOOP
        -- Calculate time weight based on recency
        v_hours_ago := v_activity.hours_ago;
        IF v_hours_ago <= 24 THEN
            v_time_weight := 1.0;  -- 100% for last 24 hours
        ELSIF v_hours_ago <= 72 THEN
            v_time_weight := 0.7;  -- 70% for 24-72 hours
        ELSIF v_hours_ago <= 168 THEN  -- 7 days
            v_time_weight := 0.4;  -- 40% for 3-7 days
        ELSIF v_hours_ago <= 336 THEN  -- 14 days
            v_time_weight := 0.2;  -- 20% for 7-14 days
        ELSE
            v_time_weight := 0.05; -- 5% for older
        END IF;

        -- Get intent multiplier
        IF v_activity.activity_type IN ('pricing_page', 'demo_request', 'contact_sales', 'free_trial', 'quote_request') THEN
            v_intent_multiplier := 3;
        ELSIF v_activity.activity_type IN ('product_page', 'case_study', 'whitepaper', 'webinar', 'product_comparison') THEN
            v_intent_multiplier := 2;
        ELSE
            v_intent_multiplier := 1;
        END IF;

        -- Add weighted score (each activity contributes 5 base points * multipliers)
        v_weighted_score := v_weighted_score + (5 * v_time_weight * v_intent_multiplier);
    END LOOP;

    -- Apply surge bonus (50% boost)
    IF v_has_surge THEN
        v_weighted_score := v_weighted_score * 1.5;
    END IF;

    -- Normalize to 0-100 scale (cap at 100)
    v_momentum_score := LEAST(ROUND(v_weighted_score)::INTEGER, 100);

    -- Determine momentum level
    RETURN QUERY SELECT
        v_momentum_score,
        CASE
            WHEN v_has_surge OR v_momentum_score >= 60 THEN 'high'::VARCHAR(20)
            WHEN v_momentum_score >= 30 THEN 'medium'::VARCHAR(20)
            WHEN v_momentum_score >= 10 THEN 'low'::VARCHAR(20)
            ELSE 'none'::VARCHAR(20)
        END,
        v_actions_24h,
        v_actions_72h,
        v_actions_7d,
        v_has_surge,
        v_last_high_intent;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_lead_momentum(BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_lead_momentum(BIGINT, UUID) TO anon;

-- STEP 6: Create function to get intelligent classification
-- =====================================================
CREATE OR REPLACE FUNCTION get_intelligent_classification(
    p_total_score INTEGER,
    p_momentum_level VARCHAR(20)
)
RETURNS VARCHAR(20) AS $$
BEGIN
    -- Classification Matrix:
    --                  | HIGH MOMENTUM | MEDIUM MOMENTUM | LOW/NONE MOMENTUM |
    -- HIGH SCORE (60+) | HOT           | WARM            | COLD              |
    -- MED SCORE (40-59)| HOT           | WARM            | QUALIFIED         |
    -- LOW SCORE (0-39) | WARM          | QUALIFIED       | COLD              |

    IF p_total_score >= 60 THEN
        -- High score tier
        IF p_momentum_level = 'high' THEN
            RETURN 'hot';
        ELSIF p_momentum_level = 'medium' THEN
            RETURN 'warm';
        ELSE
            RETURN 'cold';  -- High score but no momentum = cold
        END IF;
    ELSIF p_total_score >= 40 THEN
        -- Medium score tier
        IF p_momentum_level = 'high' THEN
            RETURN 'hot';
        ELSIF p_momentum_level = 'medium' THEN
            RETURN 'warm';
        ELSE
            RETURN 'qualified';
        END IF;
    ELSE
        -- Low score tier
        IF p_momentum_level = 'high' THEN
            RETURN 'warm';
        ELSIF p_momentum_level = 'medium' THEN
            RETURN 'qualified';
        ELSE
            RETURN 'cold';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_intelligent_classification(INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_intelligent_classification(INTEGER, VARCHAR) TO anon;

-- STEP 7: Create trigger to auto-update momentum on activity insert
-- =====================================================
CREATE OR REPLACE FUNCTION update_lead_momentum_on_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_momentum RECORD;
    v_new_classification VARCHAR(20);
    v_current_score INTEGER;
    v_reason VARCHAR(255);
BEGIN
    -- Get current total score
    SELECT total_score INTO v_current_score
    FROM lead_scores
    WHERE lead_id = NEW.lead_id;

    IF v_current_score IS NULL THEN
        v_current_score := 0;
    END IF;

    -- Calculate new momentum
    SELECT * INTO v_momentum
    FROM calculate_lead_momentum(NEW.lead_id, NEW.tenant_id);

    -- Get new classification
    v_new_classification := get_intelligent_classification(v_current_score, v_momentum.momentum_level);

    -- Generate reason
    IF v_momentum.has_surge THEN
        v_reason := 'Surge: ' || v_momentum.actions_24h || ' actions in last hour';
    ELSIF v_momentum.momentum_level = 'high' THEN
        v_reason := 'Active: ' || v_momentum.actions_24h || ' actions today';
    ELSIF v_momentum.momentum_level = 'medium' THEN
        v_reason := 'Engaged: ' || v_momentum.actions_72h || ' actions this week';
    ELSIF v_momentum.actions_7d > 0 THEN
        v_reason := 'Some activity: ' || v_momentum.actions_7d || ' actions last 7 days';
    ELSE
        v_reason := 'No recent activity';
    END IF;

    -- Update lead_scores
    UPDATE lead_scores SET
        momentum_score = v_momentum.momentum_score,
        momentum_level = v_momentum.momentum_level,
        actions_last_24h = v_momentum.actions_24h,
        actions_last_72h = v_momentum.actions_72h,
        actions_last_7d = v_momentum.actions_7d,
        surge_detected = v_momentum.has_surge,
        last_high_intent_action = v_momentum.last_high_intent,
        score_classification = v_new_classification,
        classification_reason = v_reason,
        momentum_updated_at = NOW(),
        updated_at = NOW()
    WHERE lead_id = NEW.lead_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_momentum_on_activity ON lead_activities;
CREATE TRIGGER trg_update_momentum_on_activity
    AFTER INSERT ON lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_momentum_on_activity();

-- =====================================================
-- STEP 8: Initialize momentum for existing leads
-- =====================================================
-- Run this after migration to populate momentum for existing data
DO $$
DECLARE
    v_lead RECORD;
    v_momentum RECORD;
    v_new_classification VARCHAR(20);
    v_reason VARCHAR(255);
BEGIN
    FOR v_lead IN
        SELECT ls.lead_id, ls.total_score, ls.tenant_id
        FROM lead_scores ls
    LOOP
        -- Calculate momentum
        SELECT * INTO v_momentum
        FROM calculate_lead_momentum(v_lead.lead_id, v_lead.tenant_id);

        -- Get classification
        v_new_classification := get_intelligent_classification(
            COALESCE(v_lead.total_score, 0),
            COALESCE(v_momentum.momentum_level, 'none')
        );

        -- Generate reason
        IF v_momentum.has_surge THEN
            v_reason := 'Surge: ' || COALESCE(v_momentum.actions_24h, 0) || ' actions in last hour';
        ELSIF v_momentum.momentum_level = 'high' THEN
            v_reason := 'Active: ' || COALESCE(v_momentum.actions_24h, 0) || ' actions today';
        ELSIF v_momentum.momentum_level = 'medium' THEN
            v_reason := 'Engaged: ' || COALESCE(v_momentum.actions_72h, 0) || ' actions this week';
        ELSIF COALESCE(v_momentum.actions_7d, 0) > 0 THEN
            v_reason := 'Some activity: ' || v_momentum.actions_7d || ' actions last 7 days';
        ELSE
            v_reason := 'No recent activity';
        END IF;

        -- Update
        UPDATE lead_scores SET
            momentum_score = COALESCE(v_momentum.momentum_score, 0),
            momentum_level = COALESCE(v_momentum.momentum_level, 'none'),
            actions_last_24h = COALESCE(v_momentum.actions_24h, 0),
            actions_last_72h = COALESCE(v_momentum.actions_72h, 0),
            actions_last_7d = COALESCE(v_momentum.actions_7d, 0),
            surge_detected = COALESCE(v_momentum.has_surge, FALSE),
            last_high_intent_action = v_momentum.last_high_intent,
            score_classification = v_new_classification,
            classification_reason = v_reason,
            momentum_updated_at = NOW()
        WHERE lead_id = v_lead.lead_id;
    END LOOP;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- Added momentum_score, momentum_level to lead_scores
-- Added classification_reason for human-readable reasons
-- Added action counters (24h, 72h, 7d)
-- Added surge_detected flag
-- Created calculate_lead_momentum() function
-- Created get_intelligent_classification() function
-- Created trigger to auto-update on new activities
-- Initialized momentum for existing leads
-- =====================================================
