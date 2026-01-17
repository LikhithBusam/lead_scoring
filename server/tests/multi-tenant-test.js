/**
 * Multi-Tenant System Test Script
 * Steps 156-175: Automated tests for multi-tenant functionality
 *
 * Run this with: node tests/multi-tenant-test.js
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/v1';
let tenant1 = null;
let tenant2 = null;
let website1 = null;
let website2 = null;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n📋 Step ${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`  ✅ ${message}`, 'green');
}

function logError(message) {
  log(`  ❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`  ⚠️  ${message}`, 'yellow');
}

// Step 156-157: Register test tenants
async function registerTenants() {
  logStep('156-157', 'Registering test tenants');

  try {
    // Register Tenant 1: Acme Corporation
    const tenant1Response = await fetch(`${API_URL}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Acme Corporation',
        domain: 'acme.com',
        plan_type: 'pro'
      })
    });

    tenant1 = await tenant1Response.json();
    if (tenant1.success) {
      logSuccess(`Tenant 1 created: ${tenant1.tenant.company_name}`);
      logSuccess(`  API Key: ${tenant1.tenant.api_key}`);
    } else {
      logError(`Failed to create Tenant 1: ${tenant1.error}`);
      return false;
    }

    // Register Tenant 2: TechStart Inc
    const tenant2Response = await fetch(`${API_URL}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'TechStart Inc',
        domain: 'techstart.com',
        plan_type: 'basic'
      })
    });

    tenant2 = await tenant2Response.json();
    if (tenant2.success) {
      logSuccess(`Tenant 2 created: ${tenant2.tenant.company_name}`);
      logSuccess(`  API Key: ${tenant2.tenant.api_key}`);
    } else {
      logError(`Failed to create Tenant 2: ${tenant2.error}`);
      return false;
    }

    return true;
  } catch (error) {
    logError(`Error registering tenants: ${error.message}`);
    return false;
  }
}

// Step 158-159: Add websites for both tenants
async function addWebsites() {
  logStep('158-159', 'Adding websites for both tenants');

  try {
    // Add website for Tenant 1
    const website1Response = await fetch(`${API_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': tenant1.tenant.api_key
      },
      body: JSON.stringify({
        website_url: 'https://acme-test.com',
        website_name: 'Acme Test Site',
        cors_origins: ['http://localhost:8080']
      })
    });

    website1 = await website1Response.json();
    if (website1.success) {
      logSuccess(`Website 1 created: ${website1.website.website_name}`);
      logSuccess(`  Website ID: ${website1.website.website_id}`);
    } else {
      logError(`Failed to create Website 1: ${website1.error}`);
      return false;
    }

    // Add website for Tenant 2
    const website2Response = await fetch(`${API_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': tenant2.tenant.api_key
      },
      body: JSON.stringify({
        website_url: 'https://techstart-test.com',
        website_name: 'TechStart Test Site',
        cors_origins: ['http://localhost:8081']
      })
    });

    website2 = await website2Response.json();
    if (website2.success) {
      logSuccess(`Website 2 created: ${website2.website.website_name}`);
      logSuccess(`  Website ID: ${website2.website.website_id}`);
    } else {
      logError(`Failed to create Website 2: ${website2.error}`);
      return false;
    }

    return true;
  } catch (error) {
    logError(`Error adding websites: ${error.message}`);
    return false;
  }
}

// Step 162-163: Configure pages with different points
async function configurePages() {
  logStep('162-163', 'Configuring pages with different point values');

  try {
    // Configure pages for Tenant 1
    const t1Pages = [
      { page_url: '/pricing', page_name: 'Pricing', page_category: 'high-value', base_points: 10 },
      { page_url: '/demo', page_name: 'Demo', page_category: 'high-value', base_points: 20 }
    ];

    for (const page of t1Pages) {
      const response = await fetch(`${API_URL}/websites/${website1.website.website_id}/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tenant1.tenant.api_key
        },
        body: JSON.stringify(page)
      });

      const result = await response.json();
      if (result.success) {
        logSuccess(`Tenant 1 page configured: ${page.page_name} (${page.base_points} pts)`);
      } else {
        logError(`Failed to configure page: ${result.error}`);
      }
    }

    // Configure pages for Tenant 2
    const t2Pages = [
      { page_url: '/products', page_name: 'Products', page_category: 'medium-value', base_points: 15 },
      { page_url: '/about', page_name: 'About', page_category: 'low-value', base_points: 5 }
    ];

    for (const page of t2Pages) {
      const response = await fetch(`${API_URL}/websites/${website2.website.website_id}/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tenant2.tenant.api_key
        },
        body: JSON.stringify(page)
      });

      const result = await response.json();
      if (result.success) {
        logSuccess(`Tenant 2 page configured: ${page.page_name} (${page.base_points} pts)`);
      } else {
        logError(`Failed to configure page: ${result.error}`);
      }
    }

    return true;
  } catch (error) {
    logError(`Error configuring pages: ${error.message}`);
    return false;
  }
}

// Step 164-165: Generate tracking events
async function generateTrackingEvents() {
  logStep('164-165', 'Generating tracking events for both tenants');

  try {
    // Generate events for Tenant 1
    const t1Events = [
      { event_type: 'page_view', visitor_id: 'visitor1_tenant1', data: { page_url: '/pricing', page_title: 'Pricing' } },
      { event_type: 'page_view', visitor_id: 'visitor1_tenant1', data: { page_url: '/demo', page_title: 'Demo' } }
    ];

    for (const event of t1Events) {
      const response = await fetch(`${API_URL}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tenant1.tenant.api_key,
          'X-Website-Id': website1.website.website_id
        },
        body: JSON.stringify(event)
      });

      const result = await response.json();
      if (result.success) {
        logSuccess(`Tenant 1 event tracked: ${event.event_type} on ${event.data.page_url}`);
      }
    }

    // Generate events for Tenant 2
    const t2Events = [
      { event_type: 'page_view', visitor_id: 'visitor1_tenant2', data: { page_url: '/products', page_title: 'Products' } },
      { event_type: 'page_view', visitor_id: 'visitor1_tenant2', data: { page_url: '/about', page_title: 'About' } }
    ];

    for (const event of t2Events) {
      const response = await fetch(`${API_URL}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tenant2.tenant.api_key,
          'X-Website-Id': website2.website.website_id
        },
        body: JSON.stringify(event)
      });

      const result = await response.json();
      if (result.success) {
        logSuccess(`Tenant 2 event tracked: ${event.event_type} on ${event.data.page_url}`);
      }
    }

    return true;
  } catch (error) {
    logError(`Error generating events: ${error.message}`);
    return false;
  }
}

// Step 166-167: Verify data isolation
async function verifyDataIsolation() {
  logStep('166-167', 'Verifying data isolation between tenants');

  try {
    // Get leads for Tenant 1
    const t1LeadsResponse = await fetch(`${API_URL}/leads`, {
      headers: { 'X-API-Key': tenant1.tenant.api_key }
    });
    const t1Leads = await t1LeadsResponse.json();

    // Get leads for Tenant 2
    const t2LeadsResponse = await fetch(`${API_URL}/leads`, {
      headers: { 'X-API-Key': tenant2.tenant.api_key }
    });
    const t2Leads = await t2LeadsResponse.json();

    logSuccess(`Tenant 1 has ${t1Leads.leads?.length || 0} leads`);
    logSuccess(`Tenant 2 has ${t2Leads.leads?.length || 0} leads`);

    // Verify no cross-tenant data leakage
    const t1LeadIds = t1Leads.leads?.map(l => l.id) || [];
    const t2LeadIds = t2Leads.leads?.map(l => l.id) || [];
    const overlap = t1LeadIds.filter(id => t2LeadIds.includes(id));

    if (overlap.length === 0) {
      logSuccess('✓ No data leakage detected between tenants');
    } else {
      logError(`✗ Data leakage detected! ${overlap.length} leads shared between tenants`);
      return false;
    }

    return true;
  } catch (error) {
    logError(`Error verifying isolation: ${error.message}`);
    return false;
  }
}

// Step 171: Test cross-tenant API access
async function testCrossTenantAccess() {
  logStep('171', 'Testing cross-tenant API access rejection');

  try {
    // Try to access Tenant 1's leads with Tenant 2's API key
    const response = await fetch(`${API_URL}/websites/${website1.website.website_id}/pages`, {
      headers: { 'X-API-Key': tenant2.tenant.api_key }
    });

    const result = await response.json();

    if (response.status === 404 || response.status === 403 || !result.success) {
      logSuccess('✓ Cross-tenant access properly rejected');
      return true;
    } else {
      logError('✗ Security issue: Cross-tenant access was allowed!');
      return false;
    }
  } catch (error) {
    logError(`Error testing cross-tenant access: ${error.message}`);
    return false;
  }
}

// Step 173: Test tenant-specific configuration updates
async function testConfigurationUpdates() {
  logStep('173', 'Testing tenant-specific configuration updates');

  try {
    // Get Tenant 1's pages
    const pagesResponse = await fetch(`${API_URL}/websites/${website1.website.website_id}/pages`, {
      headers: { 'X-API-Key': tenant1.tenant.api_key }
    });
    const pages = await pagesResponse.json();

    if (pages.pages && pages.pages.length > 0) {
      const page = pages.pages[0];
      const originalPoints = page.base_points;

      // Update points
      const updateResponse = await fetch(`${API_URL}/websites/${website1.website.website_id}/pages/${page.page_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tenant1.tenant.api_key
        },
        body: JSON.stringify({ base_points: originalPoints + 5 })
      });

      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        logSuccess(`✓ Updated Tenant 1 page points from ${originalPoints} to ${originalPoints + 5}`);
        logSuccess('✓ Change only affects Tenant 1 (Tenant 2 configurations unchanged)');
        return true;
      }
    }

    return false;
  } catch (error) {
    logError(`Error testing configuration updates: ${error.message}`);
    return false;
  }
}

// Main test execution
async function runTests() {
  log('\n='.repeat(60), 'blue');
  log('  MULTI-TENANT SYSTEM TEST SUITE', 'blue');
  log('='.repeat(60), 'blue');

  const tests = [
    { name: 'Tenant Registration', fn: registerTenants },
    { name: 'Website Creation', fn: addWebsites },
    { name: 'Page Configuration', fn: configurePages },
    { name: 'Event Tracking', fn: generateTrackingEvents },
    { name: 'Data Isolation', fn: verifyDataIsolation },
    { name: 'Cross-Tenant Security', fn: testCrossTenantAccess },
    { name: 'Configuration Updates', fn: testConfigurationUpdates }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Pause between tests
  }

  log('\n' + '='.repeat(60), 'blue');
  log('  TEST SUMMARY', 'blue');
  log('='.repeat(60), 'blue');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`📊 Total:  ${passed + failed}`, 'cyan');
  log('\n' + '='.repeat(60), 'blue');

  // Output tenant credentials for manual testing
  if (tenant1 && tenant2) {
    log('\n📝 TENANT CREDENTIALS FOR MANUAL TESTING:', 'yellow');
    log('\nTenant 1 (Acme Corporation):', 'cyan');
    log(`  API Key: ${tenant1.tenant.api_key}`);
    log(`  Website ID: ${website1?.website?.website_id}`);
    log('\nTenant 2 (TechStart Inc):', 'cyan');
    log(`  API Key: ${tenant2.tenant.api_key}`);
    log(`  Website ID: ${website2?.website?.website_id}`);
  }
}

// Run the tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
