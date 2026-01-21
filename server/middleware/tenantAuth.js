/**
 * Multi-Tenant Authentication Middleware
 * Steps 32-36: Authenticate tenant, verify website, set tenant context
 * Steps 138-143: Added usage tracking and limit enforcement
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { incrementApiCalls } from '../utils/usageTracking.js';
import { getPlanLimits, hasExceededLimit } from '../config/planLimits.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Step 32-36: Authenticate Tenant Middleware
 * - Extracts API key from headers
 * - Finds tenant with matching API key
 * - Verifies website belongs to tenant
 * - Attaches tenant and website to request
 * - Sets tenant context for RLS
 */
export async function authenticateTenant(req, res, next) {
  try {
    // Step 32: Extract API key from request headers OR query parameters
    // Query parameters are used by sendBeacon (page exit events)
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const websiteId = req.headers['x-website-id'] || req.query.website_id;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    // Step 33: Query tenants table to find tenant with matching API key
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Step 34: Extract website ID and verify it belongs to this tenant
    if (websiteId) {
      const { data: website, error: websiteError } = await supabase
        .from('tenant_websites')
        .select('*')
        .eq('website_id', websiteId)
        .eq('tenant_id', tenant.tenant_id)
        .eq('is_active', true)
        .single();

      if (websiteError || !website) {
        return res.status(403).json({
          error: 'Invalid website ID or website does not belong to this tenant',
          code: 'INVALID_WEBSITE'
        });
      }

      // Step 35: Attach website object to request
      req.website = website;
    }

    // Step 35: Attach tenant object to request
    req.tenant = tenant;

    // Step 36: Set tenant context in Supabase for Row Level Security
    // This ensures all subsequent queries are automatically filtered by tenant_id
    await supabase.rpc('set_current_tenant', { tenant_uuid: tenant.tenant_id });

    // Log successful authentication (optional)
    console.log(`✅ Tenant authenticated: ${tenant.company_name} (${tenant.tenant_id})`);

    // Step 138: Track API call (async, don't wait)
    incrementApiCalls(tenant.tenant_id).catch(err =>
      console.error('Error tracking API call:', err)
    );

    next();
  } catch (error) {
    console.error('Tenant authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Step 142-143: Check tenant usage limits middleware
 */
export async function checkTenantLimits(req, res, next) {
  try {
    const tenant = req.tenant;
    const planLimits = getPlanLimits(tenant.plan_type);

    // Get current month usage
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data: usage, error } = await supabase
      .from('tenant_usage')
      .select('*')
      .eq('tenant_id', tenant.tenant_id)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    // Step 143: Check API call limits
    if (usage && hasExceededLimit(usage.api_calls_made, planLimits.api_calls_per_month)) {
      return res.status(429).json({
        error: 'API call limit exceeded for your plan',
        code: 'API_LIMIT_EXCEEDED',
        limit: planLimits.api_calls_per_month,
        current: usage.api_calls_made,
        plan: tenant.plan_type,
        upgrade_url: '/upgrade'
      });
    }

    // Check lead limits (for form submissions)
    if (usage && hasExceededLimit(usage.leads_created, planLimits.leads_per_month)) {
      return res.status(429).json({
        error: 'Lead creation limit exceeded for your plan',
        code: 'LEAD_LIMIT_EXCEEDED',
        limit: planLimits.leads_per_month,
        current: usage.leads_created,
        plan: tenant.plan_type,
        upgrade_url: '/upgrade'
      });
    }

    // Attach usage and limits to request
    req.usage = usage || { api_calls_made: 0, leads_created: 0, storage_used_mb: 0 };
    req.planLimits = planLimits;

    next();
  } catch (error) {
    console.error('Limit check error:', error);
    next(); // Don't block on limit check errors
  }
}

/**
 * Step 142: Check if tenant can add more websites
 */
export async function checkWebsiteLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    const planLimits = getPlanLimits(tenant.plan_type);

    // Get current website count
    const { count, error } = await supabase
      .from('tenant_websites')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenant_id)
      .eq('is_active', true);

    if (error) throw error;

    const currentWebsites = count || 0;

    // Check if limit exceeded
    if (hasExceededLimit(currentWebsites, planLimits.websites)) {
      return res.status(403).json({
        error: 'Website limit exceeded for your plan',
        code: 'WEBSITE_LIMIT_EXCEEDED',
        limit: planLimits.websites,
        current: currentWebsites,
        plan: tenant.plan_type,
        upgrade_url: '/upgrade'
      });
    }

    next();
  } catch (error) {
    console.error('Website limit check error:', error);
    next(); // Don't block on errors
  }
}
