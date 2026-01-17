-- =====================================================
-- Lead Scoring System - Analytics and Audit Tables
-- Part 4: Analytics, Logging, and AI Prediction Tables
-- =====================================================

-- =====================================================
-- 19. SCORING_PERFORMANCE_METRICS TABLE
-- =====================================================
CREATE TABLE scoring_performance_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    measurement_date DATE NOT NULL,
    total_leads INTEGER NOT NULL,
    hot_leads_count INTEGER DEFAULT 0,
    warm_leads_count INTEGER DEFAULT 0,
    qualified_leads_count INTEGER DEFAULT 0,
    cold_leads_count INTEGER DEFAULT 0,
    unqualified_leads_count INTEGER DEFAULT 0,
    hot_conversion_rate DECIMAL(5,2),
    warm_conversion_rate DECIMAL(5,2),
    qualified_conversion_rate DECIMAL(5,2),
    avg_score_at_conversion DECIMAL(6,2),
    false_positive_rate DECIMAL(5,2),
    false_negative_rate DECIMAL(5,2),
    model_accuracy DECIMAL(5,2),
    avg_time_to_conversion_days DECIMAL(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_metrics_date ON scoring_performance_metrics(measurement_date);
CREATE INDEX idx_metrics_date_desc ON scoring_performance_metrics(measurement_date DESC);

COMMENT ON TABLE scoring_performance_metrics IS 'Scoring model performance tracking';

-- =====================================================
-- 20. LEAD_SCORE_CHANGES_LOG TABLE
-- =====================================================
CREATE TABLE lead_score_changes_log (
    log_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    changed_by_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    change_type VARCHAR(50) CHECK (change_type IN ('auto_calculated', 'manual_adjustment', 'rule_change', 'decay_applied', 'ai_predicted')),
    old_total_score INTEGER NOT NULL,
    new_total_score INTEGER NOT NULL,
    score_delta INTEGER NOT NULL,
    old_classification VARCHAR(50),
    new_classification VARCHAR(50),
    change_reason VARCHAR(255),
    rule_id_applied BIGINT,
    activity_id_trigger BIGINT REFERENCES lead_activities(activity_id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_score_log_lead ON lead_score_changes_log(lead_id, changed_at DESC);
CREATE INDEX idx_score_log_changed ON lead_score_changes_log(changed_at DESC);
CREATE INDEX idx_score_log_type ON lead_score_changes_log(change_type);

COMMENT ON TABLE lead_score_changes_log IS 'Audit log for score modifications';

-- =====================================================
-- 21. AI_MODEL_PREDICTIONS TABLE
-- =====================================================
CREATE TABLE ai_model_predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    prediction_type VARCHAR(50) CHECK (prediction_type IN ('conversion', 'close_probability', 'optimal_score', 'churn_risk')),
    predicted_value DECIMAL(10,2) NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL,
    contributing_factors JSONB,
    prediction_horizon_days INTEGER DEFAULT 30,
    actual_outcome DECIMAL(10,2),
    prediction_accuracy DECIMAL(5,2),
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    outcome_observed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_predictions_lead ON ai_model_predictions(lead_id);
CREATE INDEX idx_predictions_type ON ai_model_predictions(prediction_type);
CREATE INDEX idx_predictions_date ON ai_model_predictions(predicted_at DESC);

COMMENT ON TABLE ai_model_predictions IS 'AI/ML prediction tracking for continuous improvement';

-- =====================================================
-- 22. LEAD_ENGAGEMENT_SUMMARY TABLE (New - for quick analytics)
-- =====================================================
CREATE TABLE lead_engagement_summary (
    summary_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE UNIQUE,
    total_activities INTEGER DEFAULT 0,
    total_email_opens INTEGER DEFAULT 0,
    total_email_clicks INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    total_content_downloads INTEGER DEFAULT 0,
    total_events_attended INTEGER DEFAULT 0,
    last_activity_date TIMESTAMP WITH TIME ZONE,
    first_activity_date TIMESTAMP WITH TIME ZONE,
    days_since_last_activity INTEGER,
    most_viewed_page_type VARCHAR(100),
    most_engaged_content_type VARCHAR(100),
    total_session_time_seconds INTEGER DEFAULT 0,
    average_session_duration_seconds INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_engagement_lead ON lead_engagement_summary(lead_id);
CREATE INDEX idx_engagement_last_activity ON lead_engagement_summary(last_activity_date DESC);

COMMENT ON TABLE lead_engagement_summary IS 'Aggregated engagement metrics per lead for quick access';

-- =====================================================
-- 23. LEAD_SOURCE_PERFORMANCE TABLE (New - for campaign analytics)
-- =====================================================
CREATE TABLE lead_source_performance (
    source_performance_id BIGSERIAL PRIMARY KEY,
    lead_source VARCHAR(100) NOT NULL,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    converted_leads INTEGER DEFAULT 0,
    avg_score DECIMAL(6,2),
    avg_time_to_qualified_days DECIMAL(6,2),
    avg_time_to_conversion_days DECIMAL(6,2),
    total_revenue_inr DECIMAL(15,2),
    roi_percentage DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_source_perf_source ON lead_source_performance(lead_source);
CREATE INDEX idx_source_perf_period ON lead_source_performance(period_start, period_end);
CREATE INDEX idx_source_perf_utm ON lead_source_performance(utm_source, utm_medium, utm_campaign);

COMMENT ON TABLE lead_source_performance IS 'Lead source and campaign performance analytics';

-- =====================================================
-- Update Trigger for engagement summary
-- =====================================================
CREATE TRIGGER update_engagement_summary_updated_at BEFORE UPDATE ON lead_engagement_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
