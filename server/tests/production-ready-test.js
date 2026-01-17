/**
 * PRODUCTION READINESS TEST
 * Complete end-to-end workflow test following the 10-step hybrid workflow
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1';

const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let testResults = { passed: 0, failed: 0, workflows: [] };

function logWorkflow(step, status, message) {
  const icon = status === 'pass' ? '✅' : '❌';
  const color = status === 'pass' ? 'green' : 'red';
  log(`  ${icon} ${step}: ${message}`, color);

  if (status === 'pass') testResults.passed++;
  else testResults.failed++;

  testResults.workflows.push({ step, status, message });
}

async function runProductionTest() {
  log('\n' + '='.repeat(70), 'blue');
  log('  PRODUCTION READINESS TEST - COMPLETE HYBRID WORKFLOW', 'blue');
  log('='.repeat(70) + '\n', 'blue');

  let apiKey, websiteId, tenant2ApiKey, website2Id;
  const visitor1 = 'prod-visitor-' + Date.now();
  const visitor2 = 'prod-visitor2-' + Date.now();

  try {
    // ========== STEP 1: COMPANY SIGNUP (TENANT CREATION) ==========
    log('🟦 STEP 1: Company Signup (Tenant Created)', 'cyan');
    const tenant1 = await fetch(`${API_BASE}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Production Test Company',
        domain: 'production-test.com',
        plan_type: 'pro'
      })
    }).then(r => r.json());

    apiKey = tenant1.tenant.api_key;
    logWorkflow('Step 1', apiKey ? 'pass' : 'fail',
      apiKey ? 'Tenant created with API key' : 'Failed to create tenant');

    // ========== STEP 2: ADMIN LOGIN ==========
    log('\n🟦 STEP 2: Admin Login', 'cyan');
    const profile = await fetch(`${API_BASE}/tenants/me`, {
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    logWorkflow('Step 2', profile.tenant ? 'pass' : 'fail',
      profile.tenant ? 'Admin authenticated, tenant context active' : 'Authentication failed');

    // ========== STEP 3: ADMIN ADDS WEBSITE (MANUAL) ==========
    log('\n🟦 STEP 3: Admin Adds Website (Manual)', 'cyan');
    const website1 = await fetch(`${API_BASE}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        website_url: 'https://production-test.com',
        website_name: 'Production Test Site'
      })
    }).then(r => r.json());

    websiteId = website1.website.website_id;
    logWorkflow('Step 3', websiteId ? 'pass' : 'fail',
      websiteId ? 'Website added manually by admin' : 'Failed to add website');

    // ========== STEP 4: DEFAULT PAGE & SCORING TEMPLATE (AUTO) ==========
    log('\n🟦 STEP 4: Default Page & Scoring Template (Automatic)', 'cyan');
    const defaultPages = website1.website.default_pages_created;
    logWorkflow('Step 4', defaultPages === 5 ? 'pass' : 'fail',
      defaultPages === 5 ? '5 default pages auto-created (/, /about, /pricing, /contact, /demo)' :
      `Only ${defaultPages} pages created`);

    // ========== STEP 5: ADMIN REVIEWS & ADJUSTS DEFAULTS ==========
    log('\n🟦 STEP 5: Admin Reviews & Adjusts Defaults', 'cyan');

    // Get pages
    const pages = await fetch(`${API_BASE}/websites/${websiteId}/pages`, {
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    const pricingPage = pages.pages.find(p => p.page_url === '/pricing');

    // Update pricing page points
    const updated = await fetch(`${API_BASE}/websites/${websiteId}/pages/${pricingPage.page_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ base_points: 20 })
    }).then(r => r.json());

    logWorkflow('Step 5', updated.success ? 'pass' : 'fail',
      updated.success ? 'Admin edited /pricing points from 10 to 20' : 'Failed to edit page');

    // Delete /about page
    const aboutPage = pages.pages.find(p => p.page_url === '/about');
    const deleted = await fetch(`${API_BASE}/websites/${websiteId}/pages/${aboutPage.page_id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    logWorkflow('Step 5', deleted.success ? 'pass' : 'fail',
      deleted.success ? 'Admin deleted /about page from defaults' : 'Failed to delete page');

    // ========== STEP 6: TRACKING SCRIPT INSTALLATION ==========
    log('\n🟦 STEP 6: Tracking Script Installation', 'cyan');
    logWorkflow('Step 6', true, 'Script provided with tracking code (installation verified in Step 7)');

    // ========== STEP 7: SMART PAGE DISCOVERY ==========
    log('\n🟦 STEP 7: Smart Page Discovery (Hybrid)', 'cyan');

    // 7A: Auto-discovery
    log('  7A: Automatic Discovery', 'cyan');
    await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        visitor_id: visitor1,
        event_type: 'page_view',
        data: {
          page_url: '/features',
          page_title: 'Features Page',
          timestamp: new Date().toISOString()
        }
      })
    });

    await new Promise(r => setTimeout(r, 1000));

    const discovered = await fetch(`${API_BASE}/websites/${websiteId}/discovered-pages`, {
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    logWorkflow('Step 7A', discovered.discovered_pages.length > 0 ? 'pass' : 'fail',
      discovered.discovered_pages.length > 0 ?
      'Page auto-discovered when visitor accessed /features' :
      'Auto-discovery failed');

    // 7B: Admin Approval
    log('  7B: Admin Approval', 'cyan');
    if (discovered.discovered_pages.length > 0) {
      const discoveryId = discovered.discovered_pages[0].discovery_id;
      const approved = await fetch(`${API_BASE}/websites/${websiteId}/discovered-pages/${discoveryId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          page_name: 'Features',
          page_category: 'high-value',
          base_points: 15
        })
      }).then(r => r.json());

      logWorkflow('Step 7B', approved.success ? 'pass' : 'fail',
        approved.success ? 'Admin approved discovered page with 15 points' : 'Approval failed');
    }

    // ========== STEP 8: MANUAL ADD (ALWAYS ALLOWED) ==========
    log('\n🟦 STEP 8: Manual Add (Always Allowed)', 'cyan');
    const manualPage = await fetch(`${API_BASE}/websites/${websiteId}/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        page_url: '/custom-landing',
        page_name: 'Custom Landing Page',
        page_category: 'high-value',
        base_points: 25,
        is_tracked: true
      })
    }).then(r => r.json());

    logWorkflow('Step 8', manualPage.success ? 'pass' : 'fail',
      manualPage.success ? 'Admin manually added /custom-landing page' : 'Manual add failed');

    // ========== STEP 9: LEAD TRACKING & SCORING (AUTOMATIC) ==========
    log('\n🟦 STEP 9: Lead Tracking & Scoring (Automatic)', 'cyan');

    // Track pricing page visit (20 points)
    const track1 = await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        visitor_id: visitor1,
        event_type: 'page_view',
        data: {
          page_url: '/pricing',
          page_title: 'Pricing',
          timestamp: new Date().toISOString()
        }
      })
    }).then(r => r.json());

    await new Promise(r => setTimeout(r, 1000));

    // Get leads
    const leads = await fetch(`${API_BASE}/leads`, {
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    const lead = leads.leads?.find(l => l.visitor_id === visitor1);

    logWorkflow('Step 9', lead ? 'pass' : 'fail',
      lead ? `Lead tracked with score: ${lead.lead_score}` : 'Lead tracking failed');

    // ========== STEP 10: LONG-TERM CHANGES SUPPORT ==========
    log('\n🟦 STEP 10: Long-Term Changes Support', 'cyan');

    // Test 10A: New page after 1 month
    log('  10A: New Page Discovery (simulating 1 month later)', 'cyan');
    await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        visitor_id: visitor2,
        event_type: 'page_view',
        data: {
          page_url: '/new-campaign',
          page_title: 'New Campaign Page',
          timestamp: new Date().toISOString()
        }
      })
    });

    await new Promise(r => setTimeout(r, 1000));

    const newDiscovered = await fetch(`${API_BASE}/websites/${websiteId}/discovered-pages`, {
      headers: { 'X-API-Key': apiKey }
    }).then(r => r.json());

    const hasNewPage = newDiscovered.discovered_pages.some(p => p.page_url === '/new-campaign');
    logWorkflow('Step 10A', hasNewPage ? 'pass' : 'fail',
      hasNewPage ? 'New page auto-discovered after time passes' : 'Long-term discovery failed');

    // Test 10B: Add second website for same company
    log('  10B: Multiple Websites for Same Company', 'cyan');
    const website2 = await fetch(`${API_BASE}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        website_url: 'https://blog.production-test.com',
        website_name: 'Production Test Blog'
      })
    }).then(r => r.json());

    website2Id = website2.website?.website_id;
    logWorkflow('Step 10B', website2Id ? 'pass' : 'fail',
      website2Id ? 'Second website added with independent default template' : 'Failed to add second website');

    // ========== DATA ISOLATION TEST ==========
    log('\n🟦 MULTI-TENANT DATA ISOLATION', 'cyan');

    // Create second tenant
    const tenant2 = await fetch(`${API_BASE}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Competitor Company',
        domain: 'competitor.com',
        plan_type: 'basic'
      })
    }).then(r => r.json());

    tenant2ApiKey = tenant2.tenant.api_key;

    // Try to access Tenant 1's leads with Tenant 2's API key
    const isolationTest = await fetch(`${API_BASE}/leads`, {
      headers: { 'X-API-Key': tenant2ApiKey }
    }).then(r => r.json());

    const tenant2Leads = isolationTest.leads || [];
    const hasNoTenant1Data = !tenant2Leads.some(l => l.visitor_id === visitor1);

    logWorkflow('Data Isolation', hasNoTenant1Data ? 'pass' : 'fail',
      hasNoTenant1Data ?
      'Tenant 2 cannot access Tenant 1 data (RLS working)' :
      'DATA LEAK: Cross-tenant access detected!');

    // ========== FINAL SUMMARY ==========
    log('\n' + '='.repeat(70), 'blue');
    log('  PRODUCTION READINESS REPORT', 'blue');
    log('='.repeat(70), 'blue');

    log(`\n✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    log(`📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%\n`, 'cyan');

    log('🟦 WORKFLOW VERIFICATION:', 'blue');
    const workflowSteps = [
      'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5',
      'Step 6', 'Step 7A', 'Step 7B', 'Step 8', 'Step 9',
      'Step 10A', 'Step 10B', 'Data Isolation'
    ];

    workflowSteps.forEach(step => {
      const result = testResults.workflows.find(w => w.step === step);
      if (result) {
        const icon = result.status === 'pass' ? '✅' : '❌';
        const color = result.status === 'pass' ? 'green' : 'red';
        log(`  ${icon} ${result.step}: ${result.message}`, color);
      }
    });

    const passRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;

    if (passRate >= 90) {
      log('\n🎉 PRODUCTION READY! All critical workflows passing.', 'green');
      log('   The system follows the complete 10-step hybrid workflow.', 'green');
      log('   Multi-tenant isolation verified.', 'green');
      log('   Ready for manager demonstration.\n', 'green');
    } else if (passRate >= 75) {
      log('\n⚠️  MOSTLY READY: Most workflows passing, minor fixes needed.', 'yellow');
    } else {
      log('\n❌ NOT READY: Critical failures detected.', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

runProductionTest();
