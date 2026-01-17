/**
 * Multi-Tenant Lead Management Routes
 * Steps 58-60: Get leads filtered by tenant
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateTenant } from '../middleware/tenantAuth.js';
import { calculateLeadScoreMultiTenant } from '../utils/multiTenantScoring.js';

dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Step 58: GET /api/v1/leads - Get all leads for authenticated tenant
 */
router.get('/leads', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    // Query leads filtered by tenant_id (RLS automatically applies this filter)
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        score:lead_scores(*),
        activities:lead_activities(count)
      `)
      .eq('tenant_id', tenant.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform leads for response
    const transformedLeads = leads.map(lead => ({
      id: lead.lead_id,
      name: `${lead.contact?.first_name || ''} ${lead.contact?.last_name || ''}`.trim() || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      score: lead.score?.[0]?.total_score || 0,
      classification: lead.score?.[0]?.score_classification || 'unqualified',
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
      activityCount: lead.activities?.[0]?.count || 0
    }));

    res.json({
      success: true,
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.company_name,
      count: transformedLeads.length,
      leads: transformedLeads
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
 * Step 60: GET /api/v1/leads/:id/activities - Get activity timeline for lead
 */
router.get('/leads/:id/activities', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const leadId = parseInt(req.params.id);

    // Verify lead belongs to tenant
    const { data: lead } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    // Get activities filtered by tenant and lead
    const { data: activities, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('tenant_id', tenant.tenant_id)
      .eq('lead_id', leadId)
      .order('activity_timestamp', { ascending: false });

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
      count: transformedActivities.length,
      activities: transformedActivities
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

export default router;
