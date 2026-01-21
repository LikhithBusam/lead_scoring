/**
 * Usage Tracking Utilities
 * Steps 138-140: Track API calls, leads created, and storage usage
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get or create current month's usage record for a tenant
 */
async function getCurrentMonthUsage(tenantId) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // Try to get existing record - check both column naming conventions
  const { data: existing } = await supabase
    .from('tenant_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`period_month.eq.${month},month.eq.${month}`)
    .or(`period_year.eq.${year},year.eq.${year}`)
    .single();

  if (existing) {
    return existing;
  }

  // Create new record for this month - use both column naming conventions
  const { data: newUsage, error } = await supabase
    .from('tenant_usage')
    .insert({
      tenant_id: tenantId,
      period_month: month,
      period_year: year,
      month: month,
      year: year,
      leads_created: 0,
      api_calls_made: 0,
      storage_used_mb: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating usage record:', error);
    // Don't throw - just return null so tracking can continue
    return { usage_id: null, api_calls_made: 0, leads_created: 0 };
  }

  return newUsage;
}

/**
 * Step 138: Increment API calls counter
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<object>} Updated usage record
 */
export async function incrementApiCalls(tenantId) {
  try {
    const usage = await getCurrentMonthUsage(tenantId);
    
    // If no usage record (graceful fallback), skip update
    if (!usage || !usage.usage_id) {
      return null;
    }

    const { data, error } = await supabase
      .from('tenant_usage')
      .update({
        api_calls_made: (usage.api_calls_made || 0) + 1,
        last_updated: new Date().toISOString()
      })
      .eq('usage_id', usage.usage_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error incrementing API calls:', error);
    // Don't throw - we don't want to block requests if usage tracking fails
    return null;
  }
}

/**
 * Step 139: Increment leads created counter
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<object>} Updated usage record
 */
export async function incrementLeadsCreated(tenantId) {
  try {
    const usage = await getCurrentMonthUsage(tenantId);
    
    // If no usage record (graceful fallback), skip update
    if (!usage || !usage.usage_id) {
      return null;
    }

    const { data, error } = await supabase
      .from('tenant_usage')
      .update({
        leads_created: (usage.leads_created || 0) + 1,
        last_updated: new Date().toISOString()
      })
      .eq('usage_id', usage.usage_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error incrementing leads created:', error);
    return null;
  }
}

/**
 * Step 140: Calculate storage used by tenant
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<number>} Storage used in MB
 */
export async function calculateStorageUsed(tenantId) {
  try {
    // Get counts of all tenant data
    const [leadsRes, activitiesRes, scoresRes] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('lead_scores').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ]);

    const leadsCount = leadsRes.count || 0;
    const activitiesCount = activitiesRes.count || 0;
    const scoresCount = scoresRes.count || 0;

    // Estimate storage (rough approximation):
    // - Each lead: ~2KB (with contact, company data)
    // - Each activity: ~1KB (event data)
    // - Each score: ~0.5KB (score record with breakdown)
    const leadsSize = leadsCount * 2; // KB
    const activitiesSize = activitiesCount * 1; // KB
    const scoresSize = scoresCount * 0.5; // KB

    const totalKB = leadsSize + activitiesSize + scoresSize;
    const totalMB = totalKB / 1024;

    return Math.round(totalMB * 100) / 100; // Round to 2 decimals
  } catch (error) {
    console.error('Error calculating storage:', error);
    return 0;
  }
}

/**
 * Step 140: Update storage used for a tenant
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<object>} Updated usage record
 */
export async function updateStorageUsed(tenantId) {
  try {
    const usage = await getCurrentMonthUsage(tenantId);
    const storageMB = await calculateStorageUsed(tenantId);

    const { data, error } = await supabase
      .from('tenant_usage')
      .update({
        storage_used_mb: storageMB,
        last_updated: new Date().toISOString()
      })
      .eq('usage_id', usage.usage_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating storage usage:', error);
    return null;
  }
}

/**
 * Get current usage for a tenant
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<object>} Current month's usage
 */
export async function getTenantUsage(tenantId) {
  try {
    return await getCurrentMonthUsage(tenantId);
  } catch (error) {
    console.error('Error getting tenant usage:', error);
    return null;
  }
}

/**
 * Step 140: Scheduled job to update storage for all tenants
 * Run this daily via cron or similar
 */
export async function updateAllTenantsStorage() {
  try {
    console.log('🔄 Starting storage calculation for all tenants...');

    // Get all active tenants
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('tenant_id')
      .eq('is_active', true);

    if (error) throw error;

    let updated = 0;
    for (const tenant of tenants) {
      await updateStorageUsed(tenant.tenant_id);
      updated++;
    }

    console.log(`✅ Updated storage for ${updated} tenants`);
    return { success: true, updated };
  } catch (error) {
    console.error('❌ Error updating all tenants storage:', error);
    return { success: false, error: error.message };
  }
}

export default {
  incrementApiCalls,
  incrementLeadsCreated,
  calculateStorageUsed,
  updateStorageUsed,
  getTenantUsage,
  updateAllTenantsStorage
};
