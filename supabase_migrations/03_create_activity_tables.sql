-- =====================================================
-- Lead Scoring System - Activity Tracking Tables
-- Part 3: All Activity Tracking Tables
-- =====================================================

-- =====================================================
-- 14. LEAD_ACTIVITIES TABLE (Main Activity Table)
-- =====================================================
CREATE TABLE lead_activities (
    activity_id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    contact_id BIGINT REFERENCES contacts(contact_id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    activity_subtype VARCHAR(100),
    activity_title VARCHAR(255) NOT NULL,
    activity_details JSONB,
    activity_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    activity_source VARCHAR(100),
    page_url VARCHAR(500),
    referrer_url VARCHAR(500),
    device_type VARCHAR(50),
    session_id VARCHAR(100),
    points_earned INTEGER DEFAULT 0,
    triggered_workflow_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX idx_activities_lead_type ON lead_activities(lead_id, activity_type, activity_timestamp);
CREATE INDEX idx_activities_timestamp ON lead_activities(activity_timestamp DESC);
CREATE INDEX idx_activities_type ON lead_activities(activity_type);
CREATE INDEX idx_activities_session ON lead_activities(session_id);

COMMENT ON TABLE lead_activities IS 'All lead engagement activities';

-- =====================================================
-- 15. LEAD_ACTIVITIES_EMAIL TABLE
-- =====================================================
CREATE TABLE lead_activities_email (
    email_activity_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES lead_activities(activity_id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    email_campaign_id BIGINT,
    email_subject VARCHAR(255),
    action_type VARCHAR(50) CHECK (action_type IN ('sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed')),
    link_clicked VARCHAR(500),
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    first_opened_at TIMESTAMP WITH TIME ZONE,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    email_client VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_activities_lead ON lead_activities_email(lead_id);
CREATE INDEX idx_email_activities_action ON lead_activities_email(action_type);
CREATE INDEX idx_email_activities_campaign ON lead_activities_email(email_campaign_id);

COMMENT ON TABLE lead_activities_email IS 'Email engagement tracking';

-- =====================================================
-- 16. LEAD_ACTIVITIES_WEBSITE TABLE
-- =====================================================
CREATE TABLE lead_activities_website (
    web_activity_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES lead_activities(activity_id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    page_type VARCHAR(100) NOT NULL,
    page_url VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    time_on_page_seconds INTEGER,
    scroll_depth_percent INTEGER,
    form_submitted BOOLEAN DEFAULT FALSE,
    form_id VARCHAR(100),
    download_file VARCHAR(255),
    referrer_source VARCHAR(255),
    session_duration_seconds INTEGER,
    pages_viewed_in_session INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_activities_lead ON lead_activities_website(lead_id);
CREATE INDEX idx_web_activities_page_type ON lead_activities_website(page_type);
CREATE INDEX idx_web_activities_url ON lead_activities_website(page_url);

COMMENT ON TABLE lead_activities_website IS 'Website behavior tracking';

-- =====================================================
-- 17. LEAD_ACTIVITIES_EVENTS TABLE
-- =====================================================
CREATE TABLE lead_activities_events (
    event_activity_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES lead_activities(activity_id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    event_type VARCHAR(50) CHECK (event_type IN ('webinar', 'demo', 'meeting', 'conference', 'workshop', 'trade_show')),
    event_name VARCHAR(255) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_status VARCHAR(50) CHECK (registration_status IN ('registered', 'attended', 'no_show', 'cancelled')),
    attended_duration_minutes INTEGER,
    engagement_level VARCHAR(50) CHECK (engagement_level IN ('high', 'medium', 'low')),
    questions_asked INTEGER DEFAULT 0,
    poll_responses INTEGER DEFAULT 0,
    event_recording_watched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_activities_lead ON lead_activities_events(lead_id);
CREATE INDEX idx_event_activities_type ON lead_activities_events(event_type);
CREATE INDEX idx_event_activities_date ON lead_activities_events(event_date);
CREATE INDEX idx_event_activities_status ON lead_activities_events(registration_status);

COMMENT ON TABLE lead_activities_events IS 'Event participation tracking (webinars, demos, meetings)';

-- =====================================================
-- 18. LEAD_ACTIVITIES_CONTENT TABLE
-- =====================================================
CREATE TABLE lead_activities_content (
    content_activity_id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES lead_activities(activity_id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES leads(lead_id) ON DELETE CASCADE,
    content_type VARCHAR(50) CHECK (content_type IN ('whitepaper', 'ebook', 'case_study', 'video', 'guide', 'calculator', 'comparison')),
    content_title VARCHAR(255) NOT NULL,
    content_id VARCHAR(100),
    content_category VARCHAR(100),
    action_type VARCHAR(50) CHECK (action_type IN ('viewed', 'downloaded', 'completed', 'shared')),
    consumption_percent INTEGER,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_activities_lead ON lead_activities_content(lead_id);
CREATE INDEX idx_content_activities_type ON lead_activities_content(content_type);
CREATE INDEX idx_content_activities_action ON lead_activities_content(action_type);

COMMENT ON TABLE lead_activities_content IS 'Content consumption tracking';
