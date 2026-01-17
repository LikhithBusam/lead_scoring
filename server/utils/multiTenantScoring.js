/**
 * Multi-Tenant Scoring Engine
 * Steps 49-57: Calculate scores using tenant-specific and system-wide rules
 * Step 132-133: Added Redis caching for performance optimization
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getCache, setCache, getScoringRulesKey, getPageConfigKey, getCTAConfigKey } from './cache.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache for system scoring rules (shared across all tenants)
let systemRulesCache = {
  demographic: [],
  negative: [],
  lastFetched: null
};

/**
 * Step 132: Fetch system-wide scoring rules with Redis caching
 */
async function fetchSystemScoringRules() {
  const cacheKey = 'system:scoring_rules';

  // Try Redis cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log('✅ System scoring rules loaded from Redis cache');
    return cached;
  }

  // Fall back to in-memory cache
  const now = Date.now();
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  if (systemRulesCache.lastFetched && (now - systemRulesCache.lastFetched) < CACHE_TTL) {
    return systemRulesCache;
  }

  try {
    // Step 50-52: Fetch global system scoring rules
    const [demographicRes, negativeRes] = await Promise.all([
      supabase.from('system_scoring_rules').select('*').eq('rule_category', 'demographic').eq('is_active', true),
      supabase.from('system_scoring_rules').select('*').eq('rule_category', 'negative').eq('is_active', true)
    ]);

    systemRulesCache = {
      demographic: demographicRes.data || [],
      negative: negativeRes.data || [],
      lastFetched: now
    };

    // Store in Redis with 10 minute TTL
    await setCache(cacheKey, systemRulesCache, 600);

    console.log(`📊 System scoring rules loaded from DB: ${systemRulesCache.demographic.length} demographic, ${systemRulesCache.negative.length} negative`);

    return systemRulesCache;
  } catch (error) {
    console.error('Error fetching system scoring rules:', error);
    return systemRulesCache;
  }
}

/**
 * Step 49-57: Calculate lead score for multi-tenant system
 */
export async function calculateLeadScoreMultiTenant(tenantId, leadId) {
  try {
    // Fetch lead with all related data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `)
      .eq('lead_id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
    }

    // Fetch system scoring rules (Step 50-52: demographic and negative)
    const systemRules = await fetchSystemScoringRules();

    // Step 53-56: Calculate scores
    let demographicScore = 0;
    let behavioralScore = 0;
    let negativeScore = 0;
    const matchedRules = [];

    // ===== DEMOGRAPHIC SCORING (System Rules) =====
    for (const rule of systemRules.demographic) {
      const fieldValue = extractFieldValue(lead, rule.condition_field);

      if (evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value)) {
        demographicScore += rule.points;
        matchedRules.push({
          type: 'demographic',
          rule: rule.rule_name,
          points: rule.points
        });
      }
    }

    // Cap demographic at 50
    demographicScore = Math.min(demographicScore, 50);

    // ===== BEHAVIORAL SCORING (Tenant-Specific Pages & CTAs) =====
    // Step 53-56: Query lead_activities for this tenant and lead
    const { data: activities } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .order('activity_timestamp', { ascending: false });

    // Step 54-55: Get points from tenant_pages and tenant_ctas with caching
    for (const activity of activities || []) {
      let points = activity.points_earned || 0;

      // If no points stored, calculate from config
      if (points === 0) {
        if (activity.activity_type === 'page_view' && activity.page_url) {
          // Step 133: Check cache for page configuration
          const pageConfigCacheKey = getPageConfigKey(tenantId, activity.website_id);
          let pageConfigs = await getCache(pageConfigCacheKey);

          if (!pageConfigs) {
            // Fetch all pages for this website and cache them
            const { data: pages } = await supabase
              .from('tenant_pages')
              .select('*')
              .eq('website_id', activity.website_id)
              .eq('is_tracked', true);

            pageConfigs = pages || [];
            await setCache(pageConfigCacheKey, pageConfigs, 600); // 10 min TTL
          }

          const page = pageConfigs.find(p => p.page_url === activity.page_url);
          points = page?.base_points || 0;

        } else if (activity.activity_type === 'cta_interaction' && activity.cta_id) {
          // Step 133: Check cache for CTA configuration
          const ctaConfigCacheKey = getCTAConfigKey(tenantId, activity.website_id);
          let ctaConfigs = await getCache(ctaConfigCacheKey);

          if (!ctaConfigs) {
            // Fetch all CTAs for this website and cache them
            const { data: ctas } = await supabase
              .from('tenant_ctas')
              .select('*')
              .eq('website_id', activity.website_id)
              .eq('is_active', true);

            ctaConfigs = ctas || [];
            await setCache(ctaConfigCacheKey, ctaConfigs, 600); // 10 min TTL
          }

          const cta = ctaConfigs.find(c => c.cta_id === activity.cta_id);
          points = cta?.points || 0;
        }
      }

      behavioralScore += points;
    }

    // Cap behavioral at 100
    behavioralScore = Math.min(behavioralScore, 100);

    // ===== NEGATIVE SCORING (System Rules) =====
    for (const rule of systemRules.negative) {
      const fieldValue = extractFieldValue(lead, rule.condition_field);

      if (evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value)) {
        negativeScore += rule.points; // Already negative in DB
        matchedRules.push({
          type: 'negative',
          rule: rule.rule_name,
          points: rule.points
        });
      }
    }

    // ===== CALCULATE TOTAL =====
    const totalScore = Math.max(0, demographicScore + behavioralScore + negativeScore);

    // Classify lead
    const classification = classifyLeadScore(totalScore);

    const scoreData = {
      totalScore,
      classification,
      breakdown: {
        demographic: demographicScore,
        behavioral: behavioralScore,
        negative: negativeScore
      },
      matchedRules,
      calculatedAt: new Date().toISOString()
    };

    // Step 57: Save score to database
    await saveScoreToDatabase(tenantId, leadId, scoreData);

    return scoreData;

  } catch (error) {
    console.error('Error calculating lead score:', error);
    throw error;
  }
}

/**
 * Extract field value from lead object
 */
function extractFieldValue(lead, field) {
  const contact = lead.contact;
  const company = lead.company;

  switch (field) {
    case 'employee_count':
      let empCount = company?.employee_count || 0;
      if (typeof empCount === 'string') {
        const match = empCount.match(/\d+/);
        if (match) empCount = parseInt(match[0]);
      }
      return empCount;

    case 'job_title':
      return contact?.job_title || '';

    case 'industry':
      return company?.industry || '';

    case 'email':
      return contact?.email || '';

    case 'phone':
      return contact?.phone || '';

    case 'company_name':
      return company?.company_name || '';

    case 'has_budget_authority':
      return contact?.has_budget_authority ? 'true' : 'false';

    case 'last_activity_date':
      return lead.last_activity_date || lead.created_at;

    default:
      return lead[field] || contact?.[field] || company?.[field] || null;
  }
}

/**
 * Evaluate a condition
 */
function evaluateCondition(value, operator, conditionValue) {
  if (value === null || value === undefined) return false;

  const strValue = String(value).toLowerCase();
  const condStr = String(conditionValue).toLowerCase();

  switch (operator) {
    case 'equals':
      return strValue === condStr;

    case 'not_equals':
      return strValue !== condStr;

    case 'contains':
      return condStr.split(',').some(v => strValue.includes(v.trim()));

    case 'greater_than':
      return parseFloat(value) > parseFloat(conditionValue);

    case 'less_than':
      return parseFloat(value) < parseFloat(conditionValue);

    case 'in_range':
      const [min, max] = conditionValue.split(',').map(v => parseFloat(v.trim()));
      const numValue = parseFloat(value);
      return numValue >= min && numValue <= max;

    default:
      return false;
  }
}

/**
 * Classify lead based on total score
 */
function classifyLeadScore(score) {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'qualified';
  return 'cold';
}

/**
 * Step 57: Save calculated score to database
 */
async function saveScoreToDatabase(tenantId, leadId, scoreData) {
  try {
    // Upsert lead_scores
    await supabase
      .from('lead_scores')
      .upsert({
        tenant_id: tenantId,
        lead_id: leadId,
        demographic_score: scoreData.breakdown.demographic,
        behavioral_score: scoreData.breakdown.behavioral,
        negative_score: scoreData.breakdown.negative,
        total_score: scoreData.totalScore,
        score_classification: scoreData.classification,
        last_calculated_at: scoreData.calculatedAt,
        updated_at: scoreData.calculatedAt
      }, {
        onConflict: 'lead_id'
      });

    // Insert into score_history
    await supabase
      .from('score_history')
      .insert({
        lead_id: leadId,
        tenant_id: tenantId,
        demographic_score: scoreData.breakdown.demographic,
        behavioral_score: scoreData.breakdown.behavioral,
        negative_score: scoreData.breakdown.negative,
        total_score: scoreData.totalScore,
        score_classification: scoreData.classification,
        change_reason: 'Score recalculation'
      });

    return true;
  } catch (error) {
    console.error('Error saving score:', error);
    return false;
  }
}

export default {
  calculateLeadScoreMultiTenant,
  fetchSystemScoringRules
};
