/**
 * Momentum Calculator
 *
 * Calculates lead momentum based on recent activity patterns.
 * Used for intelligent lead classification that prioritizes recency over historical score.
 *
 * Core Principle:
 * - "A lead with score 45 who visited pricing 3x today = HOT"
 * - "A lead with score 85 inactive for 30 days = COLD"
 */

/**
 * Time decay windows with weights
 * More recent activities count more toward momentum
 */
export const TIME_DECAY_WINDOWS = {
  LAST_24H: { hoursMax: 24, weight: 1.0 },      // 100% weight
  LAST_72H: { hoursMax: 72, weight: 0.7 },      // 70% weight
  LAST_7D: { hoursMax: 168, weight: 0.4 },      // 40% weight (7 days)
  LAST_14D: { hoursMax: 336, weight: 0.2 },     // 20% weight (14 days)
  OLDER: { hoursMax: Infinity, weight: 0.05 }   // 5% weight
};

/**
 * High-intent activities that indicate buying signals
 */
export const HIGH_INTENT_ACTIVITIES = [
  'pricing_page',
  'demo_request',
  'contact_sales',
  'free_trial',
  'quote_request',
  'pricing',
  'demo',
  'trial'
];

/**
 * Medium-intent activities that show engagement
 */
export const MEDIUM_INTENT_ACTIVITIES = [
  'product_page',
  'product_comparison',
  'case_study',
  'whitepaper',
  'whitepaper_download',
  'webinar',
  'ebook',
  'ebook_download',
  'video_watch',
  'comparison',
  'product'
];

/**
 * Intent multipliers for different activity types
 */
export const INTENT_MULTIPLIERS = {
  HIGH: 3,    // 3x weight for high-intent actions
  MEDIUM: 2,  // 2x weight for medium-intent actions
  LOW: 1      // 1x weight for low-intent actions
};

/**
 * Momentum thresholds for classification
 */
export const MOMENTUM_THRESHOLDS = {
  HIGH: 60,    // Momentum score >= 60 = high momentum
  MEDIUM: 30,  // Momentum score >= 30 = medium momentum
  LOW: 10      // Momentum score >= 10 = low momentum
};

/**
 * Surge detection threshold
 * 3+ actions in 1 hour = automatic surge
 */
export const SURGE_THRESHOLD = {
  ACTIONS: 3,
  WINDOW_HOURS: 1
};

/**
 * Base points per activity for momentum calculation
 */
const BASE_POINTS_PER_ACTIVITY = 5;

/**
 * Surge bonus multiplier (50% boost)
 */
const SURGE_BONUS_MULTIPLIER = 1.5;

/**
 * Get the intent level of an activity type
 * @param {string} activityType - The activity type
 * @returns {string} 'high', 'medium', or 'low'
 */
export function getIntentLevel(activityType) {
  const normalizedType = activityType?.toLowerCase() || '';

  // Check for high-intent keywords
  if (HIGH_INTENT_ACTIVITIES.some(intent => normalizedType.includes(intent))) {
    return 'high';
  }

  // Check for medium-intent keywords
  if (MEDIUM_INTENT_ACTIVITIES.some(intent => normalizedType.includes(intent))) {
    return 'medium';
  }

  return 'low';
}

/**
 * Get the intent multiplier for an activity type
 * @param {string} activityType - The activity type
 * @returns {number} The multiplier (1, 2, or 3)
 */
export function getIntentMultiplier(activityType) {
  const level = getIntentLevel(activityType);
  return INTENT_MULTIPLIERS[level.toUpperCase()] || INTENT_MULTIPLIERS.LOW;
}

/**
 * Get the time decay weight based on how long ago an activity occurred
 * @param {number} hoursAgo - Hours since the activity
 * @returns {number} Weight between 0.05 and 1.0
 */
export function getTimeWeight(hoursAgo) {
  if (hoursAgo <= TIME_DECAY_WINDOWS.LAST_24H.hoursMax) {
    return TIME_DECAY_WINDOWS.LAST_24H.weight;
  }
  if (hoursAgo <= TIME_DECAY_WINDOWS.LAST_72H.hoursMax) {
    return TIME_DECAY_WINDOWS.LAST_72H.weight;
  }
  if (hoursAgo <= TIME_DECAY_WINDOWS.LAST_7D.hoursMax) {
    return TIME_DECAY_WINDOWS.LAST_7D.weight;
  }
  if (hoursAgo <= TIME_DECAY_WINDOWS.LAST_14D.hoursMax) {
    return TIME_DECAY_WINDOWS.LAST_14D.weight;
  }
  return TIME_DECAY_WINDOWS.OLDER.weight;
}

/**
 * Calculate momentum from a list of activities
 *
 * @param {Array} activities - Array of activity objects with activity_type and activity_timestamp
 * @param {Date} currentTime - Current time (defaults to now)
 * @returns {Object} Momentum calculation result
 */
export function calculateMomentum(activities, currentTime = new Date()) {
  if (!activities || activities.length === 0) {
    return {
      score: 0,
      level: 'none',
      actionsLast24h: 0,
      actionsLast72h: 0,
      actionsLast7d: 0,
      surgeDetected: false,
      lastHighIntentAction: null,
      breakdown: {
        weightedScore: 0,
        timeWeightedPoints: 0,
        intentBonus: 0,
        surgeBonus: 0
      }
    };
  }

  const currentMs = currentTime.getTime();
  let weightedScore = 0;
  let actionsLast24h = 0;
  let actionsLast72h = 0;
  let actionsLast7d = 0;
  let actionsLast1h = 0;
  let lastHighIntentAction = null;

  // Process each activity
  for (const activity of activities) {
    const activityTime = new Date(activity.activity_timestamp || activity.activityTimestamp || activity.timestamp);
    const msAgo = currentMs - activityTime.getTime();
    const hoursAgo = msAgo / (1000 * 60 * 60);

    // Skip activities older than 14 days for momentum calculation
    if (hoursAgo > TIME_DECAY_WINDOWS.LAST_14D.hoursMax) {
      continue;
    }

    // Count activities in time windows
    if (hoursAgo <= 1) actionsLast1h++;
    if (hoursAgo <= 24) actionsLast24h++;
    if (hoursAgo <= 72) actionsLast72h++;
    if (hoursAgo <= 168) actionsLast7d++;

    // Get time and intent weights
    const activityType = activity.activity_type || activity.activityType || activity.type || '';
    const timeWeight = getTimeWeight(hoursAgo);
    const intentMultiplier = getIntentMultiplier(activityType);

    // Track last high-intent action
    if (getIntentLevel(activityType) === 'high') {
      if (!lastHighIntentAction || activityTime > new Date(lastHighIntentAction)) {
        lastHighIntentAction = activityTime.toISOString();
      }
    }

    // Calculate weighted contribution
    const activityPoints = BASE_POINTS_PER_ACTIVITY * timeWeight * intentMultiplier;
    weightedScore += activityPoints;
  }

  // Detect surge
  const surgeDetected = actionsLast1h >= SURGE_THRESHOLD.ACTIONS;

  // Apply surge bonus
  if (surgeDetected) {
    weightedScore *= SURGE_BONUS_MULTIPLIER;
  }

  // Normalize to 0-100 scale
  const score = Math.min(Math.round(weightedScore), 100);

  // Determine momentum level
  let level;
  if (surgeDetected || score >= MOMENTUM_THRESHOLDS.HIGH) {
    level = 'high';
  } else if (score >= MOMENTUM_THRESHOLDS.MEDIUM) {
    level = 'medium';
  } else if (score >= MOMENTUM_THRESHOLDS.LOW) {
    level = 'low';
  } else {
    level = 'none';
  }

  return {
    score,
    level,
    actionsLast24h,
    actionsLast72h,
    actionsLast7d,
    surgeDetected,
    lastHighIntentAction,
    breakdown: {
      weightedScore: Math.round(weightedScore * 100) / 100,
      totalActivities: activities.length,
      recentActivities: actionsLast7d
    }
  };
}

/**
 * Classification matrix for intelligent lead classification
 * Combines score tier and momentum level
 */
const CLASSIFICATION_MATRIX = {
  // High score (60+)
  'high_high': 'hot',
  'high_medium': 'warm',
  'high_low': 'cold',      // High score but no momentum = cold
  'high_none': 'cold',

  // Medium score (40-59)
  'medium_high': 'hot',
  'medium_medium': 'warm',
  'medium_low': 'qualified',
  'medium_none': 'qualified',

  // Low score (0-39)
  'low_high': 'warm',      // Low score but high momentum = warm
  'low_medium': 'qualified',
  'low_low': 'cold',
  'low_none': 'cold'
};

/**
 * Get the score tier based on total score
 * @param {number} score - Total lead score
 * @returns {string} 'high', 'medium', or 'low'
 */
export function getScoreTier(score) {
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get intelligent classification based on score and momentum
 *
 * @param {number} score - Total lead score
 * @param {Object|string} momentum - Momentum object or momentum level string
 * @returns {string} Classification: 'hot', 'warm', 'qualified', or 'cold'
 */
export function getIntelligentClassification(score, momentum) {
  const scoreTier = getScoreTier(score);
  const momentumLevel = typeof momentum === 'string' ? momentum : (momentum?.level || 'none');

  const key = `${scoreTier}_${momentumLevel}`;
  return CLASSIFICATION_MATRIX[key] || 'cold';
}

/**
 * Generate a human-readable classification reason
 *
 * @param {Object} params - Parameters for reason generation
 * @param {number} params.score - Total lead score
 * @param {Object} params.momentum - Momentum calculation result
 * @param {string} params.classification - The classification result
 * @returns {string} Human-readable reason
 */
export function generateClassificationReason({ score, momentum, classification }) {
  const { surgeDetected, actionsLast24h, actionsLast72h, actionsLast7d, lastHighIntentAction } = momentum || {};

  // Surge case
  if (surgeDetected) {
    return `Surge: ${actionsLast24h || 0} actions in the last hour`;
  }

  // High momentum
  if (momentum?.level === 'high') {
    if (lastHighIntentAction) {
      return `High intent: ${actionsLast24h || 0} actions today, recent pricing/demo activity`;
    }
    return `Active: ${actionsLast24h || 0} actions today`;
  }

  // Medium momentum
  if (momentum?.level === 'medium') {
    return `Engaged: ${actionsLast72h || 0} actions in the last 3 days`;
  }

  // Low momentum with some activity
  if (actionsLast7d > 0) {
    return `Some activity: ${actionsLast7d} actions in the last 7 days`;
  }

  // No momentum
  if (classification === 'cold' && score >= 60) {
    return 'High score but no recent activity';
  }

  return 'No recent activity';
}

/**
 * Full momentum analysis for a lead
 *
 * @param {Array} activities - Lead activities
 * @param {number} currentScore - Current total lead score
 * @param {Date} currentTime - Current time (defaults to now)
 * @returns {Object} Complete momentum analysis with classification
 */
export function analyzeMomentum(activities, currentScore, currentTime = new Date()) {
  const momentum = calculateMomentum(activities, currentTime);
  const classification = getIntelligentClassification(currentScore, momentum);
  const reason = generateClassificationReason({
    score: currentScore,
    momentum,
    classification
  });

  return {
    momentum,
    classification,
    classificationReason: reason,
    scoreTier: getScoreTier(currentScore),
    summary: {
      totalScore: currentScore,
      momentumScore: momentum.score,
      momentumLevel: momentum.level,
      classification,
      reason
    }
  };
}

export default {
  calculateMomentum,
  getIntelligentClassification,
  generateClassificationReason,
  analyzeMomentum,
  getIntentLevel,
  getIntentMultiplier,
  getTimeWeight,
  getScoreTier,
  TIME_DECAY_WINDOWS,
  HIGH_INTENT_ACTIVITIES,
  MEDIUM_INTENT_ACTIVITIES,
  INTENT_MULTIPLIERS,
  MOMENTUM_THRESHOLDS,
  SURGE_THRESHOLD
};
