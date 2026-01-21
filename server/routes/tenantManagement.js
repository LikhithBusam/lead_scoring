/**
 * Tenant Management Routes (Self-Service)
 * Steps 61-83: Complete tenant, website, page, CTA, and scoring rule management
 * Steps 134-135: Added cache invalidation on configuration updates
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { authenticateTenant, checkWebsiteLimit, checkTenantLimits } from '../middleware/tenantAuth.js';
import { z } from 'zod';
import { deleteCache, getPageConfigKey, getCTAConfigKey, getScoringRulesKey } from '../utils/cache.js';
import { getTenantUsage } from '../utils/usageTracking.js';
import { getPlanLimits, getUsagePercentage, isApproachingLimit, hasExceededLimit } from '../config/planLimits.js';

dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const registerTenantSchema = z.object({
  company_name: z.string().min(1).max(255),
  domain: z.string().optional(),
  plan_type: z.enum(['free', 'basic', 'pro', 'enterprise']).default('free')
});

const updateTenantSchema = z.object({
  company_name: z.string().min(1).max(255).optional(),
  domain: z.string().optional(),
  webhook_url: z.string().url().optional(),
  settings: z.record(z.any()).optional()
});

const addWebsiteSchema = z.object({
  website_url: z.string().url(),
  website_name: z.string().min(1).max(255),
  cors_origins: z.array(z.string()).optional()
});

const updateWebsiteSchema = z.object({
  website_url: z.string().url().optional(),
  website_name: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional(),
  cors_origins: z.array(z.string()).optional()
});

const addPageSchema = z.object({
  page_url: z.string().min(1).max(500),
  page_name: z.string().min(1).max(255),
  page_category: z.enum(['high-value', 'medium-value', 'low-value']),
  base_points: z.number().int().min(0).max(100)
});

const updatePageSchema = z.object({
  page_name: z.string().min(1).max(255).optional(),
  page_category: z.enum(['high-value', 'medium-value', 'low-value']).optional(),
  base_points: z.number().int().min(0).max(100).optional(),
  is_tracked: z.boolean().optional()
});

const addCTASchema = z.object({
  cta_identifier: z.string().min(1).max(500),
  cta_name: z.string().min(1).max(255),
  cta_type: z.enum(['button', 'form', 'link', 'video', 'download']),
  points: z.number().int().min(0).max(100)
});

const updateCTASchema = z.object({
  cta_identifier: z.string().min(1).max(500).optional(),
  cta_name: z.string().min(1).max(255).optional(),
  cta_type: z.enum(['button', 'form', 'link', 'video', 'download']).optional(),
  points: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional()
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Step 62: Generate secure API key
function generateApiKey() {
  return 'lsk_' + crypto.randomBytes(32).toString('hex');
}

// Generate tracking code
function generateTrackingCode() {
  return 'trk_' + crypto.randomBytes(16).toString('hex');
}

// ============================================
// TENANT ENDPOINTS (Steps 61-64)
// ============================================

/**
 * Step 61: POST /api/v1/tenants/register - Register new tenant
 */
router.post('/tenants/register', async (req, res) => {
  try {
    const validation = registerTenantSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    const { company_name, domain, plan_type } = validation.data;

    // Step 62: Generate secure API key
    const apiKey = generateApiKey();

    // Create tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        company_name,
        domain,
        api_key: apiKey, // Store unhashed for now (in production, hash it)
        plan_type,
        is_active: true,
        settings: {
          target_industries: [],
          deduplication_windows: {
            page_view: 5,
            cta_click: 30,
            download: 1440
          }
        }
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      tenant: {
        tenant_id: tenant.tenant_id,
        company_name: tenant.company_name,
        plan_type: tenant.plan_type,
        api_key: apiKey, // Return to user once
        created_at: tenant.created_at
      }
    });

  } catch (error) {
    console.error('Error registering tenant:', error);
    res.status(500).json({
      error: 'Failed to register tenant',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/tenants/register-with-admin - Register tenant with admin user (Traditional Login)
 * Creates a company AND its first admin user in one step
 */
router.post('/tenants/register-with-admin', async (req, res) => {
  try {
    // Extended validation schema for this endpoint
    const registerWithAdminSchema = z.object({
      company_name: z.string().min(1).max(255),
      domain: z.string().optional(),
      plan_type: z.enum(['free', 'basic', 'pro', 'enterprise']).default('free'),
      admin_email: z.string().email(),
      admin_password: z.string().min(8),
      admin_first_name: z.string().min(1).max(100),
      admin_last_name: z.string().min(1).max(100)
    });

    const validation = registerWithAdminSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    const { company_name, domain, plan_type, admin_email, admin_password, admin_first_name, admin_last_name } = validation.data;

    // Check if admin email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', admin_email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Generate secure API key
    const apiKey = generateApiKey();

    // Create tenant first
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        company_name,
        domain,
        api_key: apiKey,
        plan_type,
        is_active: true,
        settings: {
          target_industries: [],
          deduplication_windows: {
            page_view: 5,
            cta_click: 30,
            download: 1440
          }
        }
      })
      .select()
      .single();

    if (tenantError) {
      throw tenantError;
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(admin_password, 12);

    // Create admin user linked to this tenant
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: admin_email,
        password_hash: hashedPassword,
        first_name: admin_first_name,
        last_name: admin_last_name,
        role: 'admin',
        tenant_id: tenant.tenant_id,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select('user_id, email, first_name, last_name, role, tenant_id')
      .single();

    if (userError) {
      // Rollback: delete the tenant if user creation fails
      await supabase.from('tenants').delete().eq('tenant_id', tenant.tenant_id);
      throw userError;
    }

    // Generate JWT token for immediate login
    const { generateToken } = await import('../middleware/auth.js');
    const token = generateToken(adminUser.user_id, adminUser.email, adminUser.role);

    res.status(201).json({
      success: true,
      message: 'Company and admin user created successfully',
      user: {
        id: adminUser.user_id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role
      },
      tenant: {
        tenantId: tenant.tenant_id,
        companyName: tenant.company_name,
        domain: tenant.domain,
        planType: tenant.plan_type,
        apiKey: apiKey // Return API key once for integration purposes
      },
      token // JWT for immediate dashboard access
    });

  } catch (error) {
    console.error('Error registering tenant with admin:', error);
    res.status(500).json({
      error: 'Failed to register company',
      message: error.message
    });
  }
});

/**
 * Step 63: GET /api/v1/tenants/me - Get authenticated tenant profile
 */
router.get('/tenants/me', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    // Get current month usage
    const now = new Date();
    const { data: usage } = await supabase
      .from('tenant_usage')
      .select('*')
      .eq('tenant_id', tenant.tenant_id)
      .eq('period_month', now.getMonth() + 1)
      .eq('period_year', now.getFullYear())
      .single();

    // Get website count
    const { count: websiteCount } = await supabase
      .from('tenant_websites')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenant_id)
      .eq('is_active', true);

    // Get lead count
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenant_id);

    res.json({
      success: true,
      tenant: {
        tenant_id: tenant.tenant_id,
        company_name: tenant.company_name,
        domain: tenant.domain,
        plan_type: tenant.plan_type,
        is_active: tenant.is_active,
        webhook_url: tenant.webhook_url,
        settings: tenant.settings,
        created_at: tenant.created_at,
        stats: {
          websites: websiteCount || 0,
          leads: leadCount || 0,
          usage: {
            leads_created: usage?.leads_created || 0,
            api_calls: usage?.api_calls || 0,
            period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching tenant profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * Step 64: PUT /api/v1/tenants/me - Update tenant profile
 */
router.put('/tenants/me', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const validation = updateTenantSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    const updates = validation.data;

    const { data: updatedTenant, error } = await supabase
      .from('tenants')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenant.tenant_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      tenant: updatedTenant
    });

  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      error: 'Failed to update tenant',
      message: error.message
    });
  }
});

// ============================================
// WEBSITE ENDPOINTS (Steps 65-69)
// ============================================

/**
 * Step 65-66: POST /api/v1/websites - Add new website
 */
// Step 142: Add website limit check middleware
router.post('/websites', authenticateTenant, checkWebsiteLimit, async (req, res) => {
  try {
    const tenant = req.tenant;
    const validation = addWebsiteSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    const { website_url, website_name, cors_origins } = validation.data;

    // Step 66: Generate tracking code
    const trackingCode = generateTrackingCode();

    const { data: website, error } = await supabase
      .from('tenant_websites')
      .insert({
        tenant_id: tenant.tenant_id,
        website_url,
        website_name,
        tracking_code: trackingCode,
        is_active: true,
        cors_origins: cors_origins || [website_url]
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Step 176: Create default page template for new website
    const defaultPages = [
      {
        website_id: website.website_id,
        page_url: '/',
        page_name: 'Home',
        page_category: 'low-value',
        base_points: 1,
        is_tracked: true
      },
      {
        website_id: website.website_id,
        page_url: '/about',
        page_name: 'About Us',
        page_category: 'low-value',
        base_points: 2,
        is_tracked: true
      },
      {
        website_id: website.website_id,
        page_url: '/pricing',
        page_name: 'Pricing',
        page_category: 'high-value',
        base_points: 10,
        is_tracked: true
      },
      {
        website_id: website.website_id,
        page_url: '/contact',
        page_name: 'Contact',
        page_category: 'medium-value',
        base_points: 5,
        is_tracked: true
      },
      {
        website_id: website.website_id,
        page_url: '/demo',
        page_name: 'Request Demo',
        page_category: 'high-value',
        base_points: 15,
        is_tracked: true
      }
    ];

    // Insert default pages
    const { data: createdPages, error: pagesError } = await supabase
      .from('tenant_pages')
      .insert(defaultPages)
      .select();

    if (pagesError) {
      console.error('Error creating default pages:', pagesError);
      // Don't fail the whole request if default pages fail
    }

    // Step 177: Invalidate cache for this website's pages
    const { deleteCache, getPageConfigKey } = await import('../utils/cache.js');
    const cacheKey = getPageConfigKey(tenant.tenant_id, website.website_id);
    await deleteCache(cacheKey);

    res.status(201).json({
      success: true,
      message: 'Website added successfully with default page template',
      website: {
        website_id: website.website_id,
        website_url: website.website_url,
        website_name: website.website_name,
        tracking_code: trackingCode,
        default_pages_created: createdPages?.length || 0,
        installation_script: `
<script>
  window.LEAD_SCORER_CONFIG = {
    websiteId: "${website.website_id}",
    apiKey: "${tenant.api_key}",
    apiUrl: "http://localhost:3001/api/v1"
  };
</script>
<script src="https://cdn.yourcrm.com/lead-scorer.js"></script>
        `.trim()
      }
    });

  } catch (error) {
    console.error('Error adding website:', error);
    res.status(500).json({
      error: 'Failed to add website',
      message: error.message
    });
  }
});

/**
 * Step 67: GET /api/v1/websites - Get all websites
 */
router.get('/websites', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    const { data: websites, error } = await supabase
      .from('tenant_websites')
      .select('*')
      .eq('tenant_id', tenant.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: websites.length,
      websites
    });

  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({
      error: 'Failed to fetch websites',
      message: error.message
    });
  }
});

/**
 * Step 68: PUT /api/v1/websites/:id - Update website
 */
router.put('/websites/:id', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;
    const validation = updateWebsiteSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    // Verify website belongs to tenant
    const { data: existing } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!existing) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: website, error } = await supabase
      .from('tenant_websites')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString()
      })
      .eq('website_id', websiteId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Website updated successfully',
      website
    });

  } catch (error) {
    console.error('Error updating website:', error);
    res.status(500).json({
      error: 'Failed to update website',
      message: error.message
    });
  }
});

/**
 * Step 69: DELETE /api/v1/websites/:id - Delete website
 */
router.delete('/websites/:id', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;

    // Verify ownership
    const { data: existing } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!existing) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    // Soft delete by deactivating
    const { error } = await supabase
      .from('tenant_websites')
      .update({ is_active: false })
      .eq('website_id', websiteId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Website deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting website:', error);
    res.status(500).json({
      error: 'Failed to delete website',
      message: error.message
    });
  }
});

// ============================================
// PAGE ENDPOINTS (Steps 70-73)
// ============================================

/**
 * Step 70: POST /api/v1/websites/:id/pages - Add page
 */
router.post('/websites/:id/pages', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;
    const validation = addPageSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    // Verify website ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: page, error } = await supabase
      .from('tenant_pages')
      .insert({
        website_id: websiteId,
        ...validation.data,
        is_tracked: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Step 135: Invalidate page configuration cache
    const cacheKey = getPageConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated page config cache for website ${websiteId}`);

    res.status(201).json({
      success: true,
      message: 'Page added successfully',
      page
    });

  } catch (error) {
    console.error('Error adding page:', error);
    res.status(500).json({
      error: 'Failed to add page',
      message: error.message
    });
  }
});

/**
 * Step 71: GET /api/v1/websites/:id/pages - Get all pages
 */
router.get('/websites/:id/pages', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: pages, error } = await supabase
      .from('tenant_pages')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: pages.length,
      pages
    });

  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({
      error: 'Failed to fetch pages',
      message: error.message
    });
  }
});

/**
 * Step 72: PUT /api/v1/websites/:id/pages/:pageId - Update page
 */
router.put('/websites/:id/pages/:pageId', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, pageId } = req.params;
    const validation = updatePageSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    // Verify ownership through website
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: page, error } = await supabase
      .from('tenant_pages')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString()
      })
      .eq('page_id', pageId)
      .eq('website_id', websiteId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Step 135: Invalidate page configuration cache
    const cacheKey = getPageConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated page config cache for website ${websiteId}`);

    res.json({
      success: true,
      message: 'Page updated successfully',
      page
    });

  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({
      error: 'Failed to update page',
      message: error.message
    });
  }
});

/**
 * Step 73: DELETE /api/v1/websites/:id/pages/:pageId - Delete page
 */
router.delete('/websites/:id/pages/:pageId', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, pageId } = req.params;

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    // Soft delete by setting is_tracked to false
    const { error } = await supabase
      .from('tenant_pages')
      .update({ is_tracked: false })
      .eq('page_id', pageId)
      .eq('website_id', websiteId);

    if (error) {
      throw error;
    }

    // Step 135: Invalidate page configuration cache
    const cacheKey = getPageConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated page config cache for website ${websiteId}`);

    res.json({
      success: true,
      message: 'Page deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({
      error: 'Failed to delete page',
      message: error.message
    });
  }
});

// ============================================
// DISCOVERED PAGES ENDPOINTS (Steps 124-128)
// ============================================

/**
 * Step 124: GET /api/v1/websites/:id/discovered-pages - Get discovered pages
 */
router.get('/websites/:id/discovered-pages', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;

    // Verify website ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    // Get discovered pages with pending status
    const { data: discoveredPages, error } = await supabase
      .from('discovered_pages')
      .select('*')
      .eq('website_id', websiteId)
      .eq('review_status', 'pending')
      .order('visit_count', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      website_id: websiteId,
      discovered_pages: discoveredPages || []
    });

  } catch (error) {
    console.error('Error fetching discovered pages:', error);
    res.status(500).json({
      error: 'Failed to fetch discovered pages',
      message: error.message
    });
  }
});

/**
 * Step 126: POST /api/v1/websites/:id/discovered-pages/:discoveryId/approve - Approve discovered page
 */
router.post('/websites/:id/discovered-pages/:discoveryId/approve', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, discoveryId } = req.params;
    const { page_name, page_category, base_points } = req.body;

    // Verify ownership and get discovered page
    const { data: discoveredPage } = await supabase
      .from('discovered_pages')
      .select('*')
      .eq('discovery_id', discoveryId)
      .eq('website_id', websiteId)
      .single();

    if (!discoveredPage) {
      return res.status(404).json({
        error: 'Discovered page not found'
      });
    }

    // Move to tenant_pages
    const { data: newPage, error: pageError } = await supabase
      .from('tenant_pages')
      .insert({
        website_id: websiteId,
        page_url: discoveredPage.page_url,
        page_name: page_name || discoveredPage.page_title,
        page_category: page_category || 'medium-value',
        base_points: base_points || 5,
        is_tracked: true
      })
      .select()
      .single();

    if (pageError) {
      throw pageError;
    }

    // Mark as approved in discovered_pages
    await supabase
      .from('discovered_pages')
      .update({ review_status: 'approved' })
      .eq('discovery_id', discoveryId);

    res.json({
      success: true,
      message: 'Page approved and added to tracking',
      page: newPage
    });

  } catch (error) {
    console.error('Error approving discovered page:', error);
    res.status(500).json({
      error: 'Failed to approve page',
      message: error.message
    });
  }
});

/**
 * Step 127: POST /api/v1/websites/:id/discovered-pages/:discoveryId/reject - Reject discovered page
 */
router.post('/websites/:id/discovered-pages/:discoveryId/reject', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, discoveryId } = req.params;

    // Mark as rejected
    const { error } = await supabase
      .from('discovered_pages')
      .update({ review_status: 'rejected' })
      .eq('discovery_id', discoveryId)
      .eq('website_id', websiteId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Page rejected and removed from discovery list'
    });

  } catch (error) {
    console.error('Error rejecting discovered page:', error);
    res.status(500).json({
      error: 'Failed to reject page',
      message: error.message
    });
  }
});

/**
 * Step 128: POST /api/v1/websites/:id/discovered-pages/bulk-approve - Bulk approve pages
 */
router.post('/websites/:id/discovered-pages/bulk-approve', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;
    const { discovery_ids, page_category, base_points } = req.body;

    if (!Array.isArray(discovery_ids) || discovery_ids.length === 0) {
      return res.status(400).json({
        error: 'discovery_ids must be a non-empty array'
      });
    }

    // Get all discovered pages
    const { data: discoveredPages } = await supabase
      .from('discovered_pages')
      .select('*')
      .in('discovery_id', discovery_ids)
      .eq('website_id', websiteId);

    if (!discoveredPages || discoveredPages.length === 0) {
      return res.status(404).json({
        error: 'No discovered pages found'
      });
    }

    // Bulk insert to tenant_pages
    const pagesToInsert = discoveredPages.map(dp => ({
      website_id: websiteId,
      page_url: dp.page_url,
      page_name: dp.page_title || 'Unnamed Page',
      page_category: page_category || 'medium-value',
      base_points: base_points || 5,
      is_tracked: true
    }));

    const { error: insertError } = await supabase
      .from('tenant_pages')
      .insert(pagesToInsert);

    if (insertError) {
      throw insertError;
    }

    // Mark all as approved
    await supabase
      .from('discovered_pages')
      .update({ review_status: 'approved' })
      .in('discovery_id', discovery_ids);

    res.json({
      success: true,
      message: `${discoveredPages.length} pages approved and added to tracking`,
      pages_count: discoveredPages.length
    });

  } catch (error) {
    console.error('Error bulk approving pages:', error);
    res.status(500).json({
      error: 'Failed to bulk approve pages',
      message: error.message
    });
  }
});

// ============================================
// DISCOVERED CTA ENDPOINTS (Step 129)
// ============================================

/**
 * Step 129a: GET /api/v1/websites/:id/discovered-ctas - Get discovered CTAs pending review
 */
router.get('/websites/:id/discovered-ctas', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    // Get discovered CTAs with pending review status
    const { data: discoveredCTAs, error } = await supabase
      .from('discovered_ctas')
      .select('*')
      .eq('website_id', websiteId)
      .eq('review_status', 'pending')
      .order('interaction_count', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      discovered_ctas: discoveredCTAs || []
    });

  } catch (error) {
    console.error('Error fetching discovered CTAs:', error);
    res.status(500).json({
      error: 'Failed to fetch discovered CTAs',
      message: error.message
    });
  }
});

/**
 * Step 129b: POST /api/v1/websites/:id/discovered-ctas/:discoveryId/approve - Approve discovered CTA
 */
router.post('/websites/:id/discovered-ctas/:discoveryId/approve', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, discoveryId } = req.params;
    const { cta_name, cta_type, points } = req.body;

    // Get the discovered CTA
    const { data: discoveredCTA } = await supabase
      .from('discovered_ctas')
      .select('*')
      .eq('discovery_id', discoveryId)
      .eq('website_id', websiteId)
      .single();

    if (!discoveredCTA) {
      return res.status(404).json({
        error: 'Discovered CTA not found'
      });
    }

    // Move to tenant_ctas
    const { data: newCTA, error: insertError } = await supabase
      .from('tenant_ctas')
      .insert({
        website_id: websiteId,
        cta_name: cta_name || `CTA: ${discoveredCTA.cta_identifier}`,
        cta_identifier: discoveredCTA.cta_identifier,
        cta_type: cta_type || discoveredCTA.cta_type || 'button',
        points: points || 10,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Mark as approved
    const { error: updateError } = await supabase
      .from('discovered_ctas')
      .update({ review_status: 'approved' })
      .eq('discovery_id', discoveryId);

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      message: 'CTA approved and added to tracking',
      cta: newCTA
    });

  } catch (error) {
    console.error('Error approving discovered CTA:', error);
    res.status(500).json({
      error: 'Failed to approve CTA',
      message: error.message
    });
  }
});

/**
 * Step 129c: POST /api/v1/websites/:id/discovered-ctas/:discoveryId/reject - Reject discovered CTA
 */
router.post('/websites/:id/discovered-ctas/:discoveryId/reject', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, discoveryId } = req.params;

    // Mark as rejected
    const { error } = await supabase
      .from('discovered_ctas')
      .update({ review_status: 'rejected' })
      .eq('discovery_id', discoveryId)
      .eq('website_id', websiteId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'CTA rejected and removed from discovery list'
    });

  } catch (error) {
    console.error('Error rejecting discovered CTA:', error);
    res.status(500).json({
      error: 'Failed to reject CTA',
      message: error.message
    });
  }
});

/**
 * Step 129d: POST /api/v1/websites/:id/discovered-ctas/bulk-approve - Bulk approve CTAs
 */
router.post('/websites/:id/discovered-ctas/bulk-approve', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;
    const { discovery_ids, cta_type, points } = req.body;

    if (!Array.isArray(discovery_ids) || discovery_ids.length === 0) {
      return res.status(400).json({
        error: 'discovery_ids must be a non-empty array'
      });
    }

    // Get all discovered CTAs
    const { data: discoveredCTAs } = await supabase
      .from('discovered_ctas')
      .select('*')
      .in('discovery_id', discovery_ids)
      .eq('website_id', websiteId);

    if (!discoveredCTAs || discoveredCTAs.length === 0) {
      return res.status(404).json({
        error: 'No discovered CTAs found'
      });
    }

    // Bulk insert to tenant_ctas
    const ctasToInsert = discoveredCTAs.map(dc => ({
      website_id: websiteId,
      cta_name: `CTA: ${dc.cta_identifier}`,
      cta_identifier: dc.cta_identifier,
      cta_type: cta_type || dc.cta_type || 'button',
      points: points || 10,
      is_active: true
    }));

    const { error: insertError } = await supabase
      .from('tenant_ctas')
      .insert(ctasToInsert);

    if (insertError) {
      throw insertError;
    }

    // Mark all as approved
    await supabase
      .from('discovered_ctas')
      .update({ review_status: 'approved' })
      .in('discovery_id', discovery_ids);

    res.json({
      success: true,
      message: `${discoveredCTAs.length} CTAs approved and added to tracking`,
      ctas_count: discoveredCTAs.length
    });

  } catch (error) {
    console.error('Error bulk approving CTAs:', error);
    res.status(500).json({
      error: 'Failed to bulk approve CTAs',
      message: error.message
    });
  }
});

// ============================================
// CTA ENDPOINTS (Steps 74-77)
// ============================================

/**
 * Step 74: POST /api/v1/websites/:id/ctas - Add CTA
 */
router.post('/websites/:id/ctas', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;
    const validation = addCTASchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: cta, error } = await supabase
      .from('tenant_ctas')
      .insert({
        website_id: websiteId,
        ...validation.data,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Step 135: Invalidate CTA configuration cache
    const cacheKey = getCTAConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated CTA config cache for website ${websiteId}`);

    res.status(201).json({
      success: true,
      message: 'CTA added successfully',
      cta
    });

  } catch (error) {
    console.error('Error adding CTA:', error);
    res.status(500).json({
      error: 'Failed to add CTA',
      message: error.message
    });
  }
});

/**
 * Step 75: GET /api/v1/websites/:id/ctas - Get all CTAs
 * (This endpoint is already in tenantLeads.js, but we'll add it here too for consistency)
 */
router.get('/websites/:id/ctas', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const websiteId = req.params.id;

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: ctas, error } = await supabase
      .from('tenant_ctas')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: ctas.length,
      ctas
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
 * Step 76: PUT /api/v1/websites/:id/ctas/:ctaId - Update CTA
 */
router.put('/websites/:id/ctas/:ctaId', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, ctaId } = req.params;
    const validation = updateCTASchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      });
    }

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    const { data: cta, error } = await supabase
      .from('tenant_ctas')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString()
      })
      .eq('cta_id', ctaId)
      .eq('website_id', websiteId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Step 135: Invalidate CTA configuration cache
    const cacheKey = getCTAConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated CTA config cache for website ${websiteId}`);

    res.json({
      success: true,
      message: 'CTA updated successfully',
      cta
    });

  } catch (error) {
    console.error('Error updating CTA:', error);
    res.status(500).json({
      error: 'Failed to update CTA',
      message: error.message
    });
  }
});

/**
 * Step 77: DELETE /api/v1/websites/:id/ctas/:ctaId - Delete CTA
 */
router.delete('/websites/:id/ctas/:ctaId', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { id: websiteId, ctaId } = req.params;

    // Verify ownership
    const { data: website } = await supabase
      .from('tenant_websites')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('tenant_id', tenant.tenant_id)
      .single();

    if (!website) {
      return res.status(404).json({
        error: 'Website not found'
      });
    }

    // Soft delete
    const { error } = await supabase
      .from('tenant_ctas')
      .update({ is_active: false })
      .eq('cta_id', ctaId)
      .eq('website_id', websiteId);

    if (error) {
      throw error;
    }

    // Step 135: Invalidate CTA configuration cache
    const cacheKey = getCTAConfigKey(tenant.tenant_id, websiteId);
    await deleteCache(cacheKey);
    console.log(`🗑️  Invalidated CTA config cache for website ${websiteId}`);

    res.json({
      success: true,
      message: 'CTA deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting CTA:', error);
    res.status(500).json({
      error: 'Failed to delete CTA',
      message: error.message
    });
  }
});

// ============================================
// SCORING RULES ENDPOINTS (Steps 78-83)
// NOTE: In the multi-tenant system, we use SYSTEM scoring rules
// Tenants don't create their own demographic/negative rules
// They only configure pages and CTAs for behavioral scoring
// These endpoints return the system rules (read-only)
// ============================================

/**
 * Step 78: GET /api/v1/scoring-rules/demographic - Get demographic rules
 */
router.get('/scoring-rules/demographic', authenticateTenant, async (req, res) => {
  try {
    const { data: rules, error } = await supabase
      .from('system_scoring_rules')
      .select('*')
      .eq('rule_category', 'demographic')
      .eq('is_active', true)
      .order('points', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'System demographic rules (read-only)',
      count: rules.length,
      rules
    });

  } catch (error) {
    console.error('Error fetching demographic rules:', error);
    res.status(500).json({
      error: 'Failed to fetch rules',
      message: error.message
    });
  }
});

/**
 * Step 79-81: POST/PUT/DELETE demographic rules
 * These return "not available" since tenants use system rules
 */
router.post('/scoring-rules/demographic', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Demographic rules are system-managed',
    message: 'Tenants cannot create custom demographic rules. Use system rules instead.'
  });
});

router.put('/scoring-rules/demographic/:id', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Demographic rules are system-managed',
    message: 'Tenants cannot modify system demographic rules.'
  });
});

router.delete('/scoring-rules/demographic/:id', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Demographic rules are system-managed',
    message: 'Tenants cannot delete system demographic rules.'
  });
});

/**
 * Step 82: Behavioral rules endpoints
 * Behavioral scoring comes from tenant_pages and tenant_ctas configuration
 */
router.get('/scoring-rules/behavioral', authenticateTenant, (req, res) => {
  res.json({
    success: true,
    message: 'Behavioral scoring is configured via Pages and CTAs',
    info: {
      pages_endpoint: '/api/v1/websites/:id/pages',
      ctas_endpoint: '/api/v1/websites/:id/ctas',
      description: 'Configure pages and CTAs to define behavioral scoring'
    }
  });
});

router.post('/scoring-rules/behavioral', authenticateTenant, (req, res) => {
  res.status(400).json({
    error: 'Use pages and CTAs for behavioral scoring',
    message: 'Create pages at POST /api/v1/websites/:id/pages and CTAs at POST /api/v1/websites/:id/ctas'
  });
});

router.put('/scoring-rules/behavioral/:id', authenticateTenant, (req, res) => {
  res.status(400).json({
    error: 'Use pages and CTAs for behavioral scoring',
    message: 'Update pages at PUT /api/v1/websites/:id/pages/:pageId or CTAs at PUT /api/v1/websites/:id/ctas/:ctaId'
  });
});

router.delete('/scoring-rules/behavioral/:id', authenticateTenant, (req, res) => {
  res.status(400).json({
    error: 'Use pages and CTAs for behavioral scoring',
    message: 'Delete pages or CTAs using their respective endpoints'
  });
});

/**
 * Step 83: GET /api/v1/scoring-rules/negative - Get negative rules
 */
router.get('/scoring-rules/negative', authenticateTenant, async (req, res) => {
  try {
    const { data: rules, error } = await supabase
      .from('system_scoring_rules')
      .select('*')
      .eq('rule_category', 'negative')
      .eq('is_active', true)
      .order('points', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'System negative rules (read-only)',
      count: rules.length,
      rules
    });

  } catch (error) {
    console.error('Error fetching negative rules:', error);
    res.status(500).json({
      error: 'Failed to fetch rules',
      message: error.message
    });
  }
});

// POST/PUT/DELETE for negative rules (system-managed)
router.post('/scoring-rules/negative', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Negative rules are system-managed',
    message: 'Tenants cannot create custom negative rules. Use system rules instead.'
  });
});

router.put('/scoring-rules/negative/:id', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Negative rules are system-managed',
    message: 'Tenants cannot modify system negative rules.'
  });
});

router.delete('/scoring-rules/negative/:id', authenticateTenant, (req, res) => {
  res.status(403).json({
    error: 'Negative rules are system-managed',
    message: 'Tenants cannot delete system negative rules.'
  });
});

// ============================================
// CACHE MONITORING ENDPOINT (Step 136)
// ============================================

/**
 * Step 136: GET /api/v1/cache/stats - Get cache statistics and health
 */
router.get('/cache/stats', authenticateTenant, async (req, res) => {
  try {
    const { getCacheStats } = await import('../utils/cache.js');
    const stats = getCacheStats();

    res.json({
      success: true,
      cache_stats: stats,
      recommendations: generateCacheRecommendations(stats)
    });

  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      message: error.message
    });
  }
});

/**
 * Step 136: Helper function to analyze cache performance and suggest adjustments
 */
function generateCacheRecommendations(stats) {
  if (!stats.isEnabled) {
    return [{
      type: 'info',
      message: 'Redis caching is disabled. Enable it for better performance.'
    }];
  }

  if (!stats.isConnected) {
    return [{
      type: 'error',
      message: 'Redis is not connected. Check your Redis configuration.'
    }];
  }

  if (stats.total === 0) {
    return [{
      type: 'info',
      message: 'No cache operations yet. Waiting for traffic...'
    }];
  }

  const recommendations = [];
  const hitRate = parseFloat(stats.hitRate);

  // Analyze hit rate
  if (hitRate < 50) {
    recommendations.push({
      type: 'low_hit_rate',
      message: `Cache hit rate is ${stats.hitRate}. Consider increasing TTL if data doesn't change frequently.`,
      suggestion: 'Review cache TTL settings in .env (CACHE_TTL_SECONDS)'
    });
  } else if (hitRate >= 80) {
    recommendations.push({
      type: 'good_hit_rate',
      message: `Cache hit rate is ${stats.hitRate} - performing well!`
    });
  }

  // Check error rate
  if (stats.errors > 0) {
    const errorRate = (stats.errors / (stats.total + stats.errors)) * 100;
    if (errorRate > 5) {
      recommendations.push({
        type: 'high_error_rate',
        message: `Cache error rate is ${errorRate.toFixed(2)}%. Check Redis connection.`,
        errors: stats.errors
      });
    }
  }

  return recommendations;
}

// ============================================
// USAGE TRACKING ENDPOINT (Step 144)
// ============================================

/**
 * Step 144: GET /api/v1/usage - Get current month's usage statistics
 */
router.get('/usage', authenticateTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const planLimits = getPlanLimits(tenant.plan_type);

    // Get current usage
    const usage = await getTenantUsage(tenant.tenant_id);

    // Get website count
    const { count: websiteCount } = await supabase
      .from('tenant_websites')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenant_id)
      .eq('is_active', true);

    // Calculate usage percentages and warnings
    const usageData = {
      current_period: {
        month: usage?.month || new Date().getMonth() + 1,
        year: usage?.year || new Date().getFullYear()
      },
      plan: {
        type: tenant.plan_type,
        name: planLimits.name,
        price: planLimits.price
      },
      usage: {
        websites: {
          current: websiteCount || 0,
          limit: planLimits.websites,
          percentage: getUsagePercentage(websiteCount || 0, planLimits.websites),
          approaching_limit: isApproachingLimit(websiteCount || 0, planLimits.websites),
          exceeded: hasExceededLimit(websiteCount || 0, planLimits.websites)
        },
        leads: {
          current: usage?.leads_created || 0,
          limit: planLimits.leads_per_month,
          percentage: getUsagePercentage(usage?.leads_created || 0, planLimits.leads_per_month),
          approaching_limit: isApproachingLimit(usage?.leads_created || 0, planLimits.leads_per_month),
          exceeded: hasExceededLimit(usage?.leads_created || 0, planLimits.leads_per_month)
        },
        api_calls: {
          current: usage?.api_calls_made || 0,
          limit: planLimits.api_calls_per_month,
          percentage: getUsagePercentage(usage?.api_calls_made || 0, planLimits.api_calls_per_month),
          approaching_limit: isApproachingLimit(usage?.api_calls_made || 0, planLimits.api_calls_per_month),
          exceeded: hasExceededLimit(usage?.api_calls_made || 0, planLimits.api_calls_per_month)
        },
        storage: {
          current_mb: usage?.storage_used_mb || 0,
          limit_mb: planLimits.storage_mb,
          percentage: getUsagePercentage(usage?.storage_used_mb || 0, planLimits.storage_mb),
          approaching_limit: isApproachingLimit(usage?.storage_used_mb || 0, planLimits.storage_mb),
          exceeded: hasExceededLimit(usage?.storage_used_mb || 0, planLimits.storage_mb)
        }
      },
      last_updated: usage?.last_updated
    };

    res.json({
      success: true,
      ...usageData
    });

  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      error: 'Failed to fetch usage statistics',
      message: error.message
    });
  }
});

export default router;

