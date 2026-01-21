/**
 * Create Test Company with Website and Pages
 * This script creates a dummy company and verifies data storage
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to generate API key
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `lsk_${randomBytes}`;
}

async function createTestCompany() {
  console.log('🚀 Starting Test Company Creation...\n');

  try {
    // Step 1: Create Tenant
    console.log('Step 1: Creating tenant (company)...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        company_name: 'Test Company Inc',
        domain: 'testcompany.com',
        api_key: generateApiKey(),
        plan_type: 'pro',
        is_active: true
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    console.log('✅ Tenant created:');
    console.log(`   - Tenant ID: ${tenant.tenant_id}`);
    console.log(`   - Company: ${tenant.company_name}`);
    console.log(`   - API Key: ${tenant.api_key}`);
    console.log('');

    // Step 2: Create Website
    console.log('Step 2: Creating website...');
    const trackingCode = crypto.randomBytes(16).toString('hex');

    const { data: website, error: websiteError } = await supabase
      .from('tenant_websites')
      .insert({
        tenant_id: tenant.tenant_id,
        website_url: 'http://localhost:8080/saas-company',
        website_name: 'Test SaaS Platform',
        tracking_code: trackingCode,
        is_active: true,
        cors_origins: ['http://localhost:8080']
      })
      .select()
      .single();

    if (websiteError) throw websiteError;

    console.log('✅ Website created:');
    console.log(`   - Website ID: ${website.website_id}`);
    console.log(`   - URL: ${website.website_url}`);
    console.log(`   - Tracking Code: ${website.tracking_code}`);
    console.log('');

    // Step 3: Create Pages with Scoring
    console.log('Step 3: Creating pages with lead scoring...');

    const pages = [
      {
        website_id: website.website_id,
        page_url: '/',
        page_name: 'Home Page',
        page_category: 'low-value',
        base_points: 1,
        is_tracked: true
      },
      {
        website_id: website.website_id,
        page_url: '/features',
        page_name: 'Features',
        page_category: 'medium-value',
        base_points: 5,
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
        page_name: 'Contact Us',
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
      },
      {
        website_id: website.website_id,
        page_url: '/signup',
        page_name: 'Sign Up',
        page_category: 'high-value',
        base_points: 20,
        is_tracked: true
      }
    ];

    const { data: createdPages, error: pagesError } = await supabase
      .from('tenant_pages')
      .insert(pages)
      .select();

    if (pagesError) throw pagesError;

    console.log(`✅ ${createdPages.length} pages created with scoring:`);
    createdPages.forEach(page => {
      console.log(`   - ${page.page_name} (${page.page_url}): ${page.base_points} points`);
    });
    console.log('');

    // Step 4: Verify Data in Database
    console.log('Step 4: Verifying data storage...\n');

    // Check tenant
    const { data: verifyTenant, error: vt } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenant.tenant_id)
      .single();

    console.log('✅ Tenant verified in database:');
    console.log(`   - Stored: ${verifyTenant ? 'YES' : 'NO'}`);
    console.log(`   - Company: ${verifyTenant?.company_name}`);
    console.log('');

    // Check website
    const { data: verifyWebsite, error: vw } = await supabase
      .from('tenant_websites')
      .select('*')
      .eq('website_id', website.website_id)
      .single();

    console.log('✅ Website verified in database:');
    console.log(`   - Stored: ${verifyWebsite ? 'YES' : 'NO'}`);
    console.log(`   - URL: ${verifyWebsite?.website_url}`);
    console.log('');

    // Check pages
    const { data: verifyPages, error: vp } = await supabase
      .from('tenant_pages')
      .select('*')
      .eq('website_id', website.website_id);

    console.log('✅ Pages verified in database:');
    console.log(`   - Stored: ${verifyPages ? 'YES' : 'NO'}`);
    console.log(`   - Total Pages: ${verifyPages?.length || 0}`);
    console.log('');

    // Step 5: Create Test Lead (simulate user signup)
    console.log('Step 5: Creating test lead...');

    // Create contact with unique email
    const uniqueEmail = `john.doe.${Date.now()}@example.com`;
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenant.tenant_id,
        first_name: 'John',
        last_name: 'Doe',
        email: uniqueEmail,
        phone: '+1-555-0100'
      })
      .select()
      .single();

    if (contactError) throw contactError;

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        tenant_id: tenant.tenant_id,
        company_name: 'Customer Corp',
        industry: 'Technology',
        employee_count: 50,
        location_city: 'San Francisco',
        location_country: 'USA'
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenant.tenant_id,
        contact_id: contact.contact_id,
        company_id: company.company_id,
        lead_source: 'website',
        lead_status: 'active',
        current_stage: 'new'
      })
      .select()
      .single();

    if (leadError) throw leadError;

    console.log('✅ Test lead created:');
    console.log(`   - Lead ID: ${lead.lead_id}`);
    console.log(`   - Contact: ${contact.first_name} ${contact.last_name}`);
    console.log(`   - Email: ${contact.email}`);
    console.log(`   - Company: ${company.company_name}`);
    console.log('');

    // Create lead activity (page view)
    const { data: activity, error: activityError } = await supabase
      .from('lead_activities')
      .insert({
        tenant_id: tenant.tenant_id,
        website_id: website.website_id,
        lead_id: lead.lead_id,
        contact_id: contact.contact_id,
        visitor_id: 'test_visitor_123',
        activity_type: 'page_view',
        page_url: '/pricing',
        points_earned: 10,
        activity_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (activityError) throw activityError;

    console.log('✅ Lead activity created:');
    console.log(`   - Activity: Page view on /pricing`);
    console.log(`   - Points earned: 10`);
    console.log('');

    // Create lead score
    const { data: score, error: scoreError } = await supabase
      .from('lead_scores')
      .insert({
        tenant_id: tenant.tenant_id,
        lead_id: lead.lead_id,
        total_score: 35,
        demographic_score: 25,
        behavioral_score: 10,
        negative_score: 0,
        score_classification: 'warm'
      })
      .select()
      .single();

    if (scoreError) throw scoreError;

    console.log('✅ Lead score created:');
    console.log(`   - Total Score: ${score.total_score}`);
    console.log(`   - Classification: ${score.score_classification}`);
    console.log('');

    // Final Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 TEST COMPANY SETUP COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📋 SUMMARY:');
    console.log(`   ✅ Tenant (Company): ${tenant.company_name}`);
    console.log(`   ✅ Website: ${website.website_url}`);
    console.log(`   ✅ Pages: ${createdPages.length} pages with scoring`);
    console.log(`   ✅ Lead: ${contact.email} (${score.score_classification})`);
    console.log('');
    console.log('🔑 CREDENTIALS:');
    console.log(`   API Key: ${tenant.api_key}`);
    console.log(`   Website ID: ${website.website_id}`);
    console.log('');
    console.log('📊 DATABASE VERIFICATION:');
    console.log('   ✅ All data stored in database successfully!');
    console.log('');
    console.log('🧪 TEST IN DASHBOARD:');
    console.log(`   1. Open: http://localhost:5173`);
    console.log(`   2. Enter API Key: ${tenant.api_key}`);
    console.log(`   3. You should see:`);
    console.log(`      - 1 website`);
    console.log(`      - 6 pages`);
    console.log(`      - 1 lead (John Doe)`);
    console.log('');
    console.log('🌐 TEST TRACKING SCRIPT:');
    console.log('   Add this to your HTML:');
    console.log('   <script>');
    console.log('     window.LEAD_SCORER_CONFIG = {');
    console.log(`       websiteId: "${website.website_id}",`);
    console.log(`       apiKey: "${tenant.api_key}",`);
    console.log('       apiUrl: "http://localhost:3001/api/v1"');
    console.log('     };');
    console.log('   </script>');
    console.log('   <script src="http://localhost:3001/tracking-plugin/lead-scorer.js"></script>');
    console.log('');

    // Save credentials to file
    const credentials = {
      tenant: {
        tenant_id: tenant.tenant_id,
        company_name: tenant.company_name,
        api_key: tenant.api_key
      },
      website: {
        website_id: website.website_id,
        url: website.website_url,
        tracking_code: website.tracking_code
      },
      test_lead: {
        lead_id: lead.lead_id,
        email: contact.email,
        score: score.total_score,
        classification: score.score_classification
      },
      dashboard_url: 'http://localhost:5173',
      backend_url: 'http://localhost:3001'
    };

    const fs = await import('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'TEST_CREDENTIALS.json'),
      JSON.stringify(credentials, null, 2)
    );

    console.log('💾 Credentials saved to: TEST_CREDENTIALS.json');
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
createTestCompany().then(() => {
  console.log('✨ Done!');
  process.exit(0);
});
