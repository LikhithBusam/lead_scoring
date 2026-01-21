/**
 * Multi-Tenant Tracking Routes
 * Steps 37-48: Handle tracking events from JavaScript plugin
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateTenant, checkTenantLimits } from '../middleware/tenantAuth.js';
import { calculateLeadScoreMultiTenant } from '../utils/multiTenantScoring.js';
import { incrementLeadsCreated } from '../utils/usageTracking.js';

dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Deduplication time windows (in minutes)
const DEDUP_WINDOWS = {
  page_view: 5,
  cta_interaction: 30,
  form_submission: 0 // Always track forms
};

/**
 * Step 37: POST /api/v1/track - Receive tracking events from plugin
 * Step 143: Added tenant limits check
 */
router.post('/track', authenticateTenant, checkTenantLimits, async (req, res) => {
  console.log('📥 TRACKING REQUEST RECEIVED:', {
    headers: {
      'x-api-key': req.headers['x-api-key']?.substring(0, 20) + '...',
      'x-website-id': req.headers['x-website-id']
    },
    query: req.query,
    body: req.body?.event_type
  });
  
  try {
    const { event_type, visitor_id, session_id, data, metadata } = req.body;
    const tenant = req.tenant;
    const website = req.website;

    if (!event_type || !visitor_id) {
      return res.status(400).json({
        error: 'Missing required fields: event_type, visitor_id'
      });
    }

    // API usage is already tracked in authenticateTenant middleware

    // Handle different event types
    let result;
    switch (event_type) {
      case 'page_view':
        result = await handlePageView(tenant, website, visitor_id, data);
        break;
      case 'cta_interaction':
        result = await handleCTAInteraction(tenant, website, visitor_id, data);
        break;
      case 'form_submission':
        result = await handleFormSubmission(tenant, website, visitor_id, data);
        break;
      default:
        result = await handleGenericEvent(tenant, website, visitor_id, event_type, data);
    }

    res.json({
      success: true,
      event_type,
      ...result
    });

  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({
      error: 'Failed to track event',
      message: error.message
    });
  }
});

/**
 * Steps 38-40: Handle Page View Event
 */
async function handlePageView(tenant, website, visitorId, data) {
  const { page_url, page_title, timestamp } = data;

  // Step 38: Check if this page is configured for tracking
  const { data: page, error: pageError } = await supabase
    .from('tenant_pages')
    .select('*')
    .eq('website_id', website.website_id)
    .eq('page_url', page_url)
    .eq('is_tracked', true)
    .single();

  if (pageError || !page) {
    // Step 123: Auto-discover page - add to discovered_pages table
    await supabase
      .from('discovered_pages')
      .upsert({
        website_id: website.website_id,
        page_url,
        page_title: page_title || 'Untitled Page',
        visit_count: 1,
        last_seen_at: new Date().toISOString(),
        review_status: 'pending'
      }, {
        onConflict: 'website_id,page_url',
        // If already exists, increment visit count and update last_seen_at
        ignoreDuplicates: false
      });

    // Also increment visit count if page already discovered
    try {
      await supabase.rpc('increment_page_visit', {
        p_website_id: website.website_id,
        p_page_url: page_url
      });
    } catch (rpcError) {
      // Ignore error if RPC function doesn't exist yet
      // The upsert above will still work
    }

    // Page not configured for tracking - still log but no points
    return {
      tracked: false,
      reason: 'Page not configured for scoring',
      page_url,
      discovered: true
    };
  }

  // Step 39: Check deduplication - has visitor viewed this page recently?
  const dedupWindow = DEDUP_WINDOWS.page_view;
  const windowStart = new Date(Date.now() - dedupWindow * 60 * 1000).toISOString();

  const { data: recentActivity } = await supabase
    .from('lead_activities')
    .select('activity_id')
    .eq('tenant_id', tenant.tenant_id)
    .eq('website_id', website.website_id)
    .eq('visitor_id', visitorId)
    .eq('activity_type', 'page_view')
    .eq('page_url', page_url)
    .gte('activity_timestamp', windowStart)
    .limit(1);

  if (recentActivity && recentActivity.length > 0) {
    return {
      tracked: false,
      reason: 'Duplicate page view within deduplication window',
      window_minutes: dedupWindow
    };
  }

  // Step 40a: Check if this visitor is already identified (has a contact)
  // This links future page views to known leads
  let contactId = null;
  let leadId = null;
  const { data: existingActivity } = await supabase
    .from('lead_activities')
    .select('contact_id, lead_id')
    .eq('tenant_id', tenant.tenant_id)
    .eq('visitor_id', visitorId)
    .not('contact_id', 'is', null)
    .limit(1)
    .single();

  if (existingActivity) {
    contactId = existingActivity.contact_id;
    leadId = existingActivity.lead_id;
  }

  // Step 40: Insert activity record
  const { data: activity, error: activityError } = await supabase
    .from('lead_activities')
    .insert({
      tenant_id: tenant.tenant_id,
      website_id: website.website_id,
      visitor_id: visitorId,
      contact_id: contactId,  // Link to known contact
      lead_id: leadId,        // Link to known lead
      activity_type: 'page_view',
      activity_subtype: page.page_category,
      page_url,
      page_title,
      points_earned: page.base_points,
      activity_timestamp: timestamp || new Date().toISOString(),
      activity_details: data
    })
    .select()
    .single();

  if (activityError) {
    throw activityError;
  }

  return {
    tracked: true,
    points_earned: page.base_points,
    page_name: page.page_name,
    activity_id: activity.activity_id
  };
}

/**
 * Steps 41-43: Handle CTA Interaction Event
 */
async function handleCTAInteraction(tenant, website, visitorId, data) {
  const { cta_id, cta_identifier, timestamp } = data;

  // Step 41: Query tenant_ctas table to get CTA configuration
  const { data: cta, error: ctaError } = await supabase
    .from('tenant_ctas')
    .select('*')
    .eq('cta_id', cta_id)
    .eq('website_id', website.website_id)
    .eq('is_active', true)
    .single();

  if (ctaError || !cta) {
    // Step 129: Auto-discover CTA - check if discovered_ctas table exists first
    // For now, we'll create the table schema inline if it doesn't exist
    try {
      await supabase
        .from('discovered_ctas')
        .upsert({
          website_id: website.website_id,
          cta_identifier,
          cta_type: data.cta_type || 'button',
          page_url: data.page_url || '',
          interaction_count: 1,
          last_seen_at: new Date().toISOString(),
          review_status: 'pending'
        }, {
          onConflict: 'website_id,cta_identifier',
          ignoreDuplicates: false
        });
    } catch (error) {
      // Table might not exist yet, log but don't fail
      console.log('discovered_ctas table might not exist:', error.message);
    }

    return {
      tracked: false,
      reason: 'CTA not found or not active',
      cta_id,
      cta_identifier,
      discovered: true
    };
  }

  // Step 42: Check deduplication
  const dedupWindow = DEDUP_WINDOWS.cta_interaction;
  const windowStart = new Date(Date.now() - dedupWindow * 60 * 1000).toISOString();

  const { data: recentActivity } = await supabase
    .from('lead_activities')
    .select('activity_id')
    .eq('tenant_id', tenant.tenant_id)
    .eq('website_id', website.website_id)
    .eq('visitor_id', visitorId)
    .eq('activity_type', 'cta_interaction')
    .eq('cta_id', cta_id)
    .gte('activity_timestamp', windowStart)
    .limit(1);

  if (recentActivity && recentActivity.length > 0) {
    return {
      tracked: false,
      reason: 'Duplicate CTA interaction within deduplication window',
      window_minutes: dedupWindow
    };
  }

  // Step 43: Insert activity record
  const { data: activity, error: activityError } = await supabase
    .from('lead_activities')
    .insert({
      tenant_id: tenant.tenant_id,
      website_id: website.website_id,
      visitor_id: visitorId,
      activity_type: 'cta_interaction',
      activity_subtype: cta.cta_type,
      cta_id: cta.cta_id,
      page_url: data.page_url,
      points_earned: cta.points,
      activity_timestamp: timestamp || new Date().toISOString(),
      activity_details: {
        cta_name: cta.cta_name,
        cta_identifier: cta.cta_identifier,
        ...data
      }
    })
    .select()
    .single();

  if (activityError) {
    throw activityError;
  }

  return {
    tracked: true,
    points_earned: cta.points,
    cta_name: cta.cta_name,
    activity_id: activity.activity_id
  };
}

/**
 * Steps 44-48: Handle Form Submission Event
 */
async function handleFormSubmission(tenant, website, visitorId, data) {
  const { email, name, company, phone, fields, timestamp } = data;

  // Always track form submissions (no deduplication)
  // High points for form submission - this is a strong buying signal
  const FORM_SUBMISSION_POINTS = 50;
  
  const { data: activity, error: activityError } = await supabase
    .from('lead_activities')
    .insert({
      tenant_id: tenant.tenant_id,
      website_id: website.website_id,
      visitor_id: visitorId,
      activity_type: 'form_submission',
      page_url: data.page_url,
      points_earned: FORM_SUBMISSION_POINTS,
      activity_timestamp: timestamp || new Date().toISOString(),
      activity_details: data
    })
    .select()
    .single();

  if (activityError) {
    throw activityError;
  }

  // Step 44: If email provided, identify the lead
  if (!email) {
    return {
      tracked: true,
      points_earned: 25,
      lead_created: false,
      reason: 'No email provided'
    };
  }

  // Step 45: Check if contact already exists
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('contact_id, lead:leads(lead_id)')
    .eq('tenant_id', tenant.tenant_id)
    .eq('email', email)
    .single();

  if (existingContact) {
    // Contact exists - Step 47: Link activities to this contact
    await supabase
      .from('lead_activities')
      .update({ contact_id: existingContact.contact_id })
      .eq('visitor_id', visitorId)
      .eq('tenant_id', tenant.tenant_id)
      .is('contact_id', null);

    // Step 48: Trigger score recalculation
    const leadId = existingContact.lead?.[0]?.lead_id || existingContact.lead?.lead_id;
    if (leadId) {
      // Recalculate score asynchronously
      recalculateLeadScore(tenant.tenant_id, leadId).catch(err =>
        console.error('Error recalculating score:', err)
      );
    }

    return {
      tracked: true,
      points_earned: 25,
      lead_created: false,
      contact_id: existingContact.contact_id,
      activities_linked: true
    };
  }

  // Step 46: Create new contact and lead
  const [firstName, ...lastNameParts] = (name || '').split(' ');
  const lastName = lastNameParts.join(' ');

  // Create contact
  const { data: newContact, error: contactError } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenant.tenant_id,
      first_name: firstName || '',
      last_name: lastName || '',
      email,
      phone: phone || null
    })
    .select()
    .single();

  if (contactError) {
    throw contactError;
  }

  // Create or get company
  let companyId = null;
  if (company) {
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('company_id')
      .eq('tenant_id', tenant.tenant_id)
      .eq('company_name', company)
      .single();

    if (existingCompany) {
      companyId = existingCompany.company_id;
    } else {
      const { data: newCompany } = await supabase
        .from('companies')
        .insert({
          tenant_id: tenant.tenant_id,
          company_name: company
        })
        .select()
        .single();
      companyId = newCompany?.company_id;
    }
  }

  // Create lead
  const { data: newLead, error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenant.tenant_id,
      contact_id: newContact.contact_id,
      company_id: companyId,
      lead_source: 'website',
      lead_status: 'active',
      current_stage: 'new'
    })
    .select()
    .single();

  if (leadError) {
    throw leadError;
  }

  // Step 47: Link all previous activities to this contact
  await supabase
    .from('lead_activities')
    .update({
      contact_id: newContact.contact_id,
      lead_id: newLead.lead_id
    })
    .eq('visitor_id', visitorId)
    .eq('tenant_id', tenant.tenant_id)
    .is('contact_id', null);

  // Step 139: Increment lead usage
  await incrementLeadsCreated(tenant.tenant_id);

  // Step 48: Calculate initial score
  recalculateLeadScore(tenant.tenant_id, newLead.lead_id).catch(err =>
    console.error('Error calculating initial score:', err)
  );

  return {
    tracked: true,
    points_earned: 25,
    lead_created: true,
    contact_id: newContact.contact_id,
    lead_id: newLead.lead_id,
    activities_linked: true
  };
}

/**
 * Handle generic/custom events
 */
async function handleGenericEvent(tenant, website, visitorId, eventType, data) {
  const { data: activity, error } = await supabase
    .from('lead_activities')
    .insert({
      tenant_id: tenant.tenant_id,
      website_id: website.website_id,
      visitor_id: visitorId,
      activity_type: eventType,
      points_earned: 0,
      activity_timestamp: new Date().toISOString(),
      activity_details: data
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    tracked: true,
    points_earned: 0,
    activity_id: activity.activity_id
  };
}

/**
 * Step 48: Recalculate lead score asynchronously
 */
async function recalculateLeadScore(tenantId, leadId) {
  try {
    const scoreData = await calculateLeadScoreMultiTenant(tenantId, leadId);
    console.log(`✅ Score recalculated for lead ${leadId}: ${scoreData.totalScore} (${scoreData.classification})`);
    return scoreData;
  } catch (error) {
    console.error(`❌ Error recalculating score for lead ${leadId}:`, error);
    throw error;
  }
}

export default router;
