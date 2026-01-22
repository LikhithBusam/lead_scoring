/**
 * Scoring System Constants
 *
 * This file defines all the constants used in the lead scoring engine.
 * These values control how leads are scored and classified.
 *
 * Score Breakdown:
 * - Demographic (0-50): Company attributes, job title, authority level
 * - Behavioral (0-100): Page views, form submissions, engagement activities
 * - Negative (deductions): Invalid email, competitor, spam signals
 *
 * Total score range: 0-150 (demographic + behavioral)
 * Negative scores reduce the total but don't go below 0.
 *
 * Note: Momentum-based classification functions are imported from momentumCalculator.js
 * to avoid code duplication. Use those functions for intelligent classification.
 */

// Re-export momentum functions for backward compatibility
// Import from momentumCalculator.js for the canonical implementation
import {
  getIntelligentClassification as momentumGetIntelligentClassification,
  generateClassificationReason as momentumGenerateReason,
  getScoreTier as momentumGetScoreTier,
  MOMENTUM_THRESHOLDS
} from '../utils/momentumCalculator.js';

/**
 * Maximum scores per category
 */
export const SCORE_CAPS = {
  /** Maximum points from demographic factors (company size, industry, title) */
  DEMOGRAPHIC_MAX: 50,

  /** Maximum points from behavioral factors (page views, form submissions) */
  BEHAVIORAL_MAX: 100,

  /** Combined maximum score before negative adjustments */
  TOTAL_MAX: 150
};

/**
 * Lead classification thresholds
 * Leads are classified based on their total score
 */
export const CLASSIFICATION_THRESHOLDS = {
  /** Hot leads: ready to buy, high engagement */
  HOT: 80,

  /** Warm leads: high interest, engaged but not ready */
  WARM: 60,

  /** Qualified leads: meet criteria, worth pursuing */
  QUALIFIED: 40,

  /** Cold leads: need nurturing, low engagement */
  COLD: 0
};

/**
 * Get classification based on score only (legacy method)
 * @deprecated Use getIntelligentClassification instead
 * @param {number} score - Total lead score
 * @returns {string} Classification name
 */
export function getClassificationFromScore(score) {
  if (score >= CLASSIFICATION_THRESHOLDS.HOT) return 'hot';
  if (score >= CLASSIFICATION_THRESHOLDS.WARM) return 'warm';
  if (score >= CLASSIFICATION_THRESHOLDS.QUALIFIED) return 'qualified';
  return 'cold';
}

/**
 * Momentum-based Classification Matrix
 *
 * Classification now considers BOTH score AND momentum (recent activity)
 *
 * Matrix:
 * ─────────────────┬──────────────┬──────────────┬──────────────┐
 *                  │ HIGH         │ MEDIUM       │ LOW/NONE     │
 *                  │ MOMENTUM     │ MOMENTUM     │ MOMENTUM     │
 * ─────────────────┼──────────────┼──────────────┼──────────────┤
 *  HIGH SCORE (60+)│ HOT          │ WARM         │ COLD         │
 * ─────────────────┼──────────────┼──────────────┼──────────────┤
 *  MED SCORE (40-59)│ HOT          │ WARM         │ QUALIFIED    │
 * ─────────────────┼──────────────┼──────────────┼──────────────┤
 *  LOW SCORE (0-39)│ WARM         │ QUALIFIED    │ COLD         │
 * ─────────────────┴──────────────┴──────────────┴──────────────┘
 *
 * Note: Canonical implementation is in momentumCalculator.js
 * These are re-exported for backward compatibility
 */
export const CLASSIFICATION_MATRIX = {
  'high_high': 'hot',
  'high_medium': 'warm',
  'high_low': 'cold',
  'high_none': 'cold',
  'medium_high': 'hot',
  'medium_medium': 'warm',
  'medium_low': 'qualified',
  'medium_none': 'qualified',
  'low_high': 'warm',
  'low_medium': 'qualified',
  'low_low': 'cold',
  'low_none': 'cold'
};

/**
 * Get score tier based on total score
 * @deprecated Use import from momentumCalculator.js directly
 */
export const getScoreTier = momentumGetScoreTier;

/**
 * Get intelligent classification based on score AND momentum
 * @deprecated Use import from momentumCalculator.js directly
 */
export const getIntelligentClassification = momentumGetIntelligentClassification;

/**
 * Generate a human-readable classification reason
 * @deprecated Use import from momentumCalculator.js directly
 */
export const generateClassificationReason = momentumGenerateReason;

/**
 * Negative score handling
 */
export const NEGATIVE_SCORING = {
  /**
   * Multiplier for negative scores (reduces harsh penalties)
   * Example: A -100 negative score becomes -25 actual deduction
   */
  PENALTY_MULTIPLIER: 0.25,

  /** Maximum negative deduction allowed */
  MAX_DEDUCTION: 50
};

/**
 * Activity point values
 * Default points for common activities (can be overridden in database)
 */
export const DEFAULT_ACTIVITY_POINTS = {
  /** Form submission (highest value action) */
  FORM_SUBMISSION: 50,

  /** Pricing page view (high intent) */
  PRICING_PAGE: 20,

  /** Demo/trial request */
  DEMO_REQUEST: 40,

  /** Content download (whitepaper, ebook) */
  CONTENT_DOWNLOAD: 15,

  /** Regular page view */
  PAGE_VIEW: 5,

  /** CTA click */
  CTA_CLICK: 10,

  /** Email open */
  EMAIL_OPEN: 3,

  /** Email click */
  EMAIL_CLICK: 8
};

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Scoring rules cache TTL in milliseconds (5 minutes) */
  RULES_CACHE_TTL: 5 * 60 * 1000,

  /** Page configuration cache TTL in milliseconds (10 minutes) */
  PAGE_CONFIG_CACHE_TTL: 10 * 60 * 1000,

  /** CTA configuration cache TTL in milliseconds (10 minutes) */
  CTA_CONFIG_CACHE_TTL: 10 * 60 * 1000,

  /** Tenant settings cache TTL in milliseconds (10 minutes) */
  TENANT_SETTINGS_TTL: 10 * 60 * 1000
};

/**
 * Activity deduplication windows
 * Prevents double-counting of similar activities
 */
export const DEDUPLICATION_WINDOWS = {
  /** Page view deduplication window (5 minutes) */
  PAGE_VIEW_WINDOW_MS: 5 * 60 * 1000,

  /** CTA click deduplication window (30 minutes) */
  CTA_CLICK_WINDOW_MS: 30 * 60 * 1000,

  /** Form submission deduplication window (1 hour) */
  FORM_SUBMISSION_WINDOW_MS: 60 * 60 * 1000
};

/**
 * Score decay settings (optional, for long-inactive leads)
 */
export const SCORE_DECAY = {
  /** Days of inactivity before decay starts */
  DECAY_START_DAYS: 30,

  /** Percentage of behavioral score decayed per week after start */
  WEEKLY_DECAY_PERCENT: 10,

  /** Minimum behavioral score after decay */
  MINIMUM_BEHAVIORAL: 0
};

export default {
  SCORE_CAPS,
  CLASSIFICATION_THRESHOLDS,
  CLASSIFICATION_MATRIX,
  NEGATIVE_SCORING,
  DEFAULT_ACTIVITY_POINTS,
  CACHE_CONFIG,
  DEDUPLICATION_WINDOWS,
  SCORE_DECAY,
  getClassificationFromScore,
  getScoreTier,
  getIntelligentClassification,
  generateClassificationReason
};
