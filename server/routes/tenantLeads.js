/**
 * Multi-Tenant Lead Management Routes
 * Steps 58-60: Get leads filtered by tenant
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateTenant } from '../middleware/tenantAuth.js';
import { calculateLeadScoreMultiTenant } from '../utils/multiTenantScoring.js';
import { 
  calculateMomentum, 
  getIntelligentClassification, 
  generateClassificationReason 
} from '../utils/momentumCalculator.js';

dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Step 58: GET /api/v1/leads - Get all leads for authenticated tenant
 * Supports pagination with ?page=1&limit=50 (max 100)
 * Now includes momentum data for intelligent classification
 */
router.get('/leads', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Query leads with activities for real-time momentum calculation
    let leads, error, count;
    
    // Query with activities for momentum calculation
    const result = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(first_name, last_name, email, phone, job_title),
        company:companies(company_name, industry, employee_count),
        score:lead_scores(
          total_score, 
          demographic_score, 
          behavioral_score, 
          negative_score, 
          score_classification
        ),
        activities:lead_activities(activity_type, activity_subtype, activity_timestamp, created_at)
      `, { count: 'exact' })
      .eq('tenant_id', tenant.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    leads = result.data;
    error = result.error;
    count = result.count;

    if (error) {
      throw error;
    }

    // Transform leads for response with real-time momentum calculation
    const transformedLeads = leads.map(lead => {
      // Get stored score data
      const storedScore = lead.score?.[0]?.total_score || 0;
      
      // Calculate momentum in real-time from activities
      const activities = lead.activities || [];
      const momentum = calculateMomentum(activities);
      
      // Get intelligent classification based on score AND momentum
      const classification = getIntelligentClassification(storedScore, momentum);
      
      // Generate human-readable reason
      const classificationReason = generateClassificationReason({
        score: storedScore,
        momentum,
        classification
      });

      return {
        id: lead.lead_id,
        name: `${lead.contact?.first_name || ''} ${lead.contact?.last_name || ''}`.trim() || 'N/A',
        email: lead.contact?.email || 'N/A',
        phone: lead.contact?.phone || '',
        company: lead.company?.company_name || 'N/A',
        jobTitle: lead.contact?.job_title || '',
        industry: lead.company?.industry || '',
        score: storedScore,
        classification,
        classificationReason,
        momentum: {
          score: momentum.score,
          level: momentum.level,
          actionsLast24h: momentum.actionsLast24h,
          actionsLast72h: momentum.actionsLast72h,
          lastHighIntentAction: momentum.lastHighIntentAction,
          surgeDetected: momentum.surgeDetected
        },
        scoreBreakdown: {
          demographic: lead.score?.[0]?.demographic_score || 0,
          behavioral: lead.score?.[0]?.behavioral_score || 0,
          negative: lead.score?.[0]?.negative_score || 0
        },
        lastActivity: lead.last_activity_date || lead.created_at,
        createdAt: lead.created_at,
        source: lead.lead_source,
        status: lead.lead_status,
        stage: lead.current_stage,
        activityCount: activities.length
      };
    });

    res.json({
      success: true,
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.company_name,
      leads: transformedLeads,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + leads.length < (count || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      error: 'Failed to fetch leads',
      message: error.message
    });
  }
});

/**
 * Step 59: GET /api/v1/leads/:id - Get single lead with full details
 */
router.get('/leads/:id', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const leadId = parseInt(req.params.id);

    // Query lead with full details
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        score:lead_scores(*)
      `)
      .eq('lead_id', leadId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (error || !lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    // Get score breakdown with matched rules
    const scoreData = await calculateLeadScoreMultiTenant(tenant.tenant_id, leadId);

    const transformedLead = {
      id: lead.lead_id,
      name: `${lead.contact?.first_name || ''} ${lead.contact?.last_name || ''}`.trim() || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      companySize: lead.company?.company_size || '',
      employeeCount: lead.company?.employee_count || 0,
      location: lead.company?.location || '',
      website: lead.company?.website || '',
      score: scoreData.totalScore,
      classification: scoreData.classification,
      scoreBreakdown: scoreData.breakdown,
      matchedRules: scoreData.matchedRules,
      lastScoreUpdate: scoreData.calculatedAt,
      lastActivity: lead.last_activity_date || lead.created_at,
      createdAt: lead.created_at,
      source: lead.lead_source,
      status: lead.lead_status,
      stage: lead.current_stage
    };

    res.json({
      success: true,
      lead: transformedLead
    });

  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({
      error: 'Failed to fetch lead',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/leads/:id/recalculate-score - Recalculate lead score
 */
router.post('/leads/:id/recalculate-score', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const leadId = parseInt(req.params.id);

    // Verify lead belongs to tenant
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    // Recalculate score
    const scoreData = await calculateLeadScoreMultiTenant(tenant.tenant_id, leadId);

    console.log(`✅ Score recalculated for lead ${leadId}: ${scoreData.totalScore} (${scoreData.classification})`);

    res.json({
      success: true,
      lead_id: leadId,
      score: scoreData.totalScore,
      classification: scoreData.classification,
      breakdown: scoreData.breakdown,
      matchedRules: scoreData.matchedRules
    });

  } catch (error) {
    console.error('Error recalculating score:', error);
    res.status(500).json({
      error: 'Failed to recalculate score',
      message: error.message
    });
  }
});

/**
 * Step 60: GET /api/v1/leads/:id/activities - Get activity timeline for lead
 * Supports pagination with ?page=1&limit=50 (max 100)
 */
router.get('/leads/:id/activities', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const leadId = parseInt(req.params.id);

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Verify lead belongs to tenant and get contact_id
    const { data: lead } = await supabase
      .from('leads')
      .select('lead_id, contact_id')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    // Get activities filtered by tenant and lead OR contact with pagination
    const { data: activities, error, count } = await supabase
      .from('lead_activities')
      .select('activity_id, activity_type, activity_subtype, page_url, points_earned, activity_timestamp, activity_details, website_id', { count: 'exact' })
      .eq('tenant_id', tenant.tenant_id)
      .or(`lead_id.eq.${leadId},contact_id.eq.${lead.contact_id}`)
      .order('activity_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform activities for response
    const transformedActivities = activities.map(activity => ({
      id: activity.activity_id,
      type: activity.activity_type,
      subtype: activity.activity_subtype,
      pageUrl: activity.page_url,
      points: activity.points_earned || 0,
      timestamp: activity.activity_timestamp,
      details: activity.activity_details,
      websiteId: activity.website_id
    }));

    res.json({
      success: true,
      lead_id: leadId,
      activities: transformedActivities,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + activities.length < (count || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      error: 'Failed to fetch activities',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/websites/:id/ctas - Get configured CTAs for tracking plugin
 */
router.get('/websites/:id/ctas', authenticateTenant, async (req, res) => {
  try {
    const websiteId = req.params.id;
    const tenant = req.tenant;

    // Verify website belongs to tenant
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .eq('is_active', true)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found or does not belong to tenant'
      });
    }

    // Get configured CTAs
    const { data: ctas, error } = await supabase
      .from('tenant_ctas')
      .select('*')
      .eq('website_id', websiteId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      website_id: websiteId,
      count: ctas.length,
      ctas: ctas
    });

  } catch (error) {
    console.error('Error fetching CTAs:', error);
    res.status(500).json({
      error: 'Failed to fetch CTAs',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/scoring-rules - Get behavioral scoring rules for Activity Simulator
 * Returns rules from scoring_rules_behavioral table
 */
router.get('/scoring-rules', authenticateTenant, async (req, res) => {
  try {
    // Fetch all scoring rules in parallel
    const [demographicRes, behavioralRes, negativeRes, thresholdsRes] = await Promise.all([
      supabase.from('scoring_rules_demographic').select('*').eq('is_active', true).order('priority_order'),
      supabase.from('scoring_rules_behavioral').select('*').eq('is_active', true),
      supabase.from('scoring_rules_negative').select('*').eq('is_active', true),
      supabase.from('scoring_thresholds').select('*').eq('is_active', true).order('min_score', { ascending: false })
    ]);

    res.json({
      success: true,
      demographic: demographicRes.data || [],
      behavioral: behavioralRes.data || [],
      negative: negativeRes.data || [],
      thresholds: thresholdsRes.data || []
    });

  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    res.status(500).json({
      error: 'Failed to fetch scoring rules',
      message: error.message
    });
  }
});

export default router;
