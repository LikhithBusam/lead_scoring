/**
 * Lead Transformation Utilities
 * Centralizes lead data transformation to avoid code duplication
 */

/**
 * Transform database lead record to API response format
 * @param {Object} lead - Raw lead from database with relations
 * @returns {Object} Transformed lead for API response
 */
export function transformLeadForResponse(lead) {
  const contact = lead.contact || {};
  const company = lead.company || {};

  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ') || 'N/A';

  return {
    id: lead.lead_id,
    name: fullName,
    email: contact.email || 'N/A',
    phone: contact.phone || '',
    jobTitle: contact.job_title || '',
    company: company.company_name || 'N/A',
    industry: company.industry || '',
    companySize: company.company_size || '',
    employeeCount: company.employee_count || 0,
    revenue: company.annual_revenue || '',
    revenueAmount: company.revenue_inr_crore || 0,
    location: company.location_city || company.location || '',
    authority: contact.has_budget_authority ? 'Final Decision Maker' : '',
    source: lead.lead_source || '',
    campaign: lead.campaign_id || '',
    status: lead.lead_status || 'new',
    stage: lead.current_stage || '',
    createdAt: lead.created_at,
    lastActivity: lead.last_activity_date || lead.created_at
  };
}

/**
 * Transform lead with pre-joined score data
 * Use this when scores are already joined in the query
 * @param {Object} lead - Lead with score relation from database
 * @returns {Object} Transformed lead with score data
 */
export function transformLeadWithPreJoinedScore(lead) {
  const baseData = transformLeadForResponse(lead);

  // Get pre-calculated score from lead_scores table (joined as array)
  const scoreData = Array.isArray(lead.score) ? lead.score[0] : lead.score;

  return {
    ...baseData,
    score: scoreData?.total_score || 0,
    classification: scoreData?.score_classification || 'unqualified',
    scoreBreakdown: {
      demographic: scoreData?.demographic_score || 0,
      behavioral: scoreData?.behavioral_score || 0,
      negative: scoreData?.negative_score || 0
    },
    lastScoreUpdate: scoreData?.last_calculated_at || null
  };
}

/**
 * Transform lead with calculated score data
 * Use this when scores are calculated on-the-fly
 * @param {Object} lead - Raw lead from database
 * @param {Object} scoreData - Calculated score data
 * @returns {Object} Transformed lead with score data
 */
export function transformLeadWithCalculatedScore(lead, scoreData) {
  const baseData = transformLeadForResponse(lead);

  return {
    ...baseData,
    score: scoreData?.totalScore || 0,
    classification: scoreData?.classification || 'unqualified',
    scoreBreakdown: scoreData?.breakdown || {
      demographic: 0,
      behavioral: 0,
      negative: 0
    },
    matchedRules: scoreData?.matchedRules || [],
    lastScoreUpdate: scoreData?.calculatedAt || null
  };
}

/**
 * Transform lead for list view (minimal data)
 * @param {Object} lead - Lead with relations
 * @returns {Object} Minimal lead data for list display
 */
export function transformLeadForList(lead) {
  const contact = lead.contact || {};
  const company = lead.company || {};
  const scoreData = Array.isArray(lead.score) ? lead.score[0] : lead.score;

  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ') || 'N/A';

  return {
    id: lead.lead_id,
    name: fullName,
    email: contact.email || 'N/A',
    company: company.company_name || 'N/A',
    jobTitle: contact.job_title || '',
    score: scoreData?.total_score || 0,
    classification: scoreData?.score_classification || 'unqualified',
    lastActivity: lead.last_activity_date || lead.created_at,
    source: lead.lead_source || ''
  };
}

export default {
  transformLeadForResponse,
  transformLeadWithPreJoinedScore,
  transformLeadWithCalculatedScore,
  transformLeadForList
};
