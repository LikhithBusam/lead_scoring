/**
 * Step 141: Plan Limits Configuration
 * Defines usage limits for each subscription plan tier
 */

export const PLAN_LIMITS = {
  free: {
    name: 'Free',
    price: 0,
    websites: 1,
    leads_per_month: 100,
    api_calls_per_month: 10000,
    storage_mb: 100,
    features: [
      'Basic lead scoring',
      '1 website',
      '100 leads/month',
      '10K API calls/month',
      'Email support'
    ]
  },
  basic: {
    name: 'Basic',
    price: 29,
    websites: 3,
    leads_per_month: 1000,
    api_calls_per_month: 100000,
    storage_mb: 1000,
    features: [
      'Advanced lead scoring',
      '3 websites',
      '1,000 leads/month',
      '100K API calls/month',
      'Priority email support',
      'Custom scoring rules'
    ]
  },
  pro: {
    name: 'Pro',
    price: 99,
    websites: 10,
    leads_per_month: 10000,
    api_calls_per_month: 1000000,
    storage_mb: 10000,
    features: [
      'Premium lead scoring',
      '10 websites',
      '10,000 leads/month',
      '1M API calls/month',
      'Priority support + Slack',
      'Custom scoring rules',
      'Webhooks',
      'Advanced analytics'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    price: 499,
    websites: -1, // Unlimited
    leads_per_month: -1, // Unlimited
    api_calls_per_month: -1, // Unlimited
    storage_mb: -1, // Unlimited
    features: [
      'Everything in Pro',
      'Unlimited websites',
      'Unlimited leads',
      'Unlimited API calls',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'White-label option'
    ]
  }
};

/**
 * Check if a value is within plan limit
 * @param {number} current - Current usage
 * @param {number} limit - Plan limit (-1 means unlimited)
 * @returns {boolean} True if within limit
 */
export function isWithinLimit(current, limit) {
  if (limit === -1) return true; // Unlimited
  return current < limit;
}

/**
 * Get plan limits for a specific plan type
 * @param {string} planType - Plan type (free, basic, pro, enterprise)
 * @returns {object} Plan limits
 */
export function getPlanLimits(planType) {
  return PLAN_LIMITS[planType] || PLAN_LIMITS.free;
}

/**
 * Calculate usage percentage
 * @param {number} current - Current usage
 * @param {number} limit - Plan limit
 * @returns {number} Percentage (0-100), or -1 for unlimited
 */
export function getUsagePercentage(current, limit) {
  if (limit === -1) return -1; // Unlimited
  if (limit === 0) return 100;
  return Math.min(100, (current / limit) * 100);
}

/**
 * Check if usage is approaching limit (>= 80%)
 * @param {number} current - Current usage
 * @param {number} limit - Plan limit
 * @returns {boolean}
 */
export function isApproachingLimit(current, limit) {
  if (limit === -1) return false; // Unlimited
  const percentage = getUsagePercentage(current, limit);
  return percentage >= 80;
}

/**
 * Check if usage has exceeded limit
 * @param {number} current - Current usage
 * @param {number} limit - Plan limit
 * @returns {boolean}
 */
export function hasExceededLimit(current, limit) {
  if (limit === -1) return false; // Unlimited
  return current >= limit;
}

export default {
  PLAN_LIMITS,
  isWithinLimit,
  getPlanLimits,
  getUsagePercentage,
  isApproachingLimit,
  hasExceededLimit
};
