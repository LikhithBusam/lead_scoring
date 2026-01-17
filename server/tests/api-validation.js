/**
 * API Endpoint Validation Script
 * Validates all API endpoints are working correctly
 *
 * Usage: node tests/api-validation.js <api-key> <website-id>
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/v1';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('❌ Usage: node api-validation.js <api-key> <website-id>');
  console.error('\nExample:');
  console.error('  node api-validation.js abc123-def456 web-uuid-1234');
  process.exit(1);
}

const [API_KEY, WEBSITE_ID] = args;

// Color codes
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

function logEndpoint(method, path) {
  log(`\n🔍 Testing: ${method} ${path}`, 'cyan');
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

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// Helper function to make API requests
async function testEndpoint(method, path, options = {}) {
  try {
    const url = `${API_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers
    };

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test 1: GET /websites - List all websites
async function testListWebsites() {
  logEndpoint('GET', '/websites');

  const result = await testEndpoint('GET', '/websites');

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved ${result.data.websites?.length || 0} websites`);
    results.passed++;
    return result.data.websites;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 2: GET /websites/:id - Get specific website
async function testGetWebsite(websiteId) {
  logEndpoint('GET', `/websites/${websiteId}`);

  const result = await testEndpoint('GET', `/websites/${websiteId}`);

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved website: ${result.data.website.website_name}`);
    results.passed++;
    return result.data.website;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 3: GET /websites/:id/pages - List pages for website
async function testListPages(websiteId) {
  logEndpoint('GET', `/websites/${websiteId}/pages`);

  const result = await testEndpoint('GET', `/websites/${websiteId}/pages`);

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved ${result.data.pages?.length || 0} pages`);
    results.passed++;
    return result.data.pages;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 4: POST /websites/:id/pages - Create new page
async function testCreatePage(websiteId) {
  logEndpoint('POST', `/websites/${websiteId}/pages`);

  const pageData = {
    page_url: '/test-api-page',
    page_name: 'API Test Page',
    page_category: 'test',
    base_points: 5
  };

  const result = await testEndpoint('POST', `/websites/${websiteId}/pages`, {
    body: pageData
  });

  if (result.ok && result.data.success) {
    logSuccess(`Created page: ${result.data.page.page_name}`);
    results.passed++;
    return result.data.page;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 5: PUT /websites/:id/pages/:pageId - Update page
async function testUpdatePage(websiteId, pageId) {
  logEndpoint('PUT', `/websites/${websiteId}/pages/${pageId}`);

  const updateData = {
    base_points: 10
  };

  const result = await testEndpoint('PUT', `/websites/${websiteId}/pages/${pageId}`, {
    body: updateData
  });

  if (result.ok && result.data.success) {
    logSuccess(`Updated page points to ${result.data.page.base_points}`);
    results.passed++;
    return result.data.page;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 6: POST /track - Track event
async function testTrackEvent(websiteId) {
  logEndpoint('POST', '/track');

  const eventData = {
    event_type: 'page_view',
    visitor_id: `test_visitor_${Date.now()}`,
    data: {
      page_url: '/test-api-page',
      page_title: 'API Test Page',
      user_agent: 'API-Test-Script'
    }
  };

  const result = await testEndpoint('POST', '/track', {
    body: eventData,
    headers: {
      'X-Website-Id': websiteId
    }
  });

  if (result.ok && result.data.success) {
    logSuccess('Event tracked successfully');
    results.passed++;
    return result.data;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 7: POST /track - Track form submission
async function testTrackFormSubmission(websiteId) {
  logEndpoint('POST', '/track (form_submission)');

  const eventData = {
    event_type: 'form_submission',
    visitor_id: `test_visitor_${Date.now()}`,
    data: {
      name: 'API Test User',
      email: `test_${Date.now()}@example.com`,
      company: 'Test Company',
      page_url: '/test-api-page'
    }
  };

  const result = await testEndpoint('POST', '/track', {
    body: eventData,
    headers: {
      'X-Website-Id': websiteId
    }
  });

  if (result.ok && result.data.success) {
    logSuccess('Form submission tracked successfully');
    logSuccess(`Lead ID: ${result.data.lead_id || 'N/A'}`);
    results.passed++;
    return result.data;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 8: GET /leads - List leads
async function testListLeads() {
  logEndpoint('GET', '/leads');

  const result = await testEndpoint('GET', '/leads');

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved ${result.data.leads?.length || 0} leads`);
    results.passed++;
    return result.data.leads;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 9: GET /leads/:id - Get specific lead
async function testGetLead(leadId) {
  logEndpoint('GET', `/leads/${leadId}`);

  const result = await testEndpoint('GET', `/leads/${leadId}`);

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved lead: ${result.data.lead.name}`);
    logSuccess(`  Score: ${result.data.lead.score}`);
    logSuccess(`  Status: ${result.data.lead.status}`);
    results.passed++;
    return result.data.lead;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 10: PUT /leads/:id - Update lead
async function testUpdateLead(leadId) {
  logEndpoint('PUT', `/leads/${leadId}`);

  const updateData = {
    status: 'qualified'
  };

  const result = await testEndpoint('PUT', `/leads/${leadId}`, {
    body: updateData
  });

  if (result.ok && result.data.success) {
    logSuccess(`Updated lead status to: ${result.data.lead.status}`);
    results.passed++;
    return result.data.lead;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 11: GET /usage - Get usage statistics
async function testGetUsage() {
  logEndpoint('GET', '/usage');

  const result = await testEndpoint('GET', '/usage');

  if (result.ok && result.data.success) {
    logSuccess('Retrieved usage statistics');
    logSuccess(`  API Calls: ${result.data.usage.api_calls?.current}/${result.data.usage.api_calls?.limit}`);
    logSuccess(`  Leads: ${result.data.usage.leads?.current}/${result.data.usage.leads?.limit}`);
    logSuccess(`  Websites: ${result.data.usage.websites?.current}/${result.data.usage.websites?.limit}`);
    results.passed++;
    return result.data.usage;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 12: GET /websites/:id/discovered-pages - Get discovered pages
async function testGetDiscoveredPages(websiteId) {
  logEndpoint('GET', `/websites/${websiteId}/discovered-pages`);

  const result = await testEndpoint('GET', `/websites/${websiteId}/discovered-pages`);

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved ${result.data.discovered_pages?.length || 0} discovered pages`);
    results.passed++;
    return result.data.discovered_pages;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 13: GET /websites/:id/discovered-ctas - Get discovered CTAs
async function testGetDiscoveredCTAs(websiteId) {
  logEndpoint('GET', `/websites/${websiteId}/discovered-ctas`);

  const result = await testEndpoint('GET', `/websites/${websiteId}/discovered-ctas`);

  if (result.ok && result.data.success) {
    logSuccess(`Retrieved ${result.data.discovered_ctas?.length || 0} discovered CTAs`);
    results.passed++;
    return result.data.discovered_ctas;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return null;
  }
}

// Test 14: DELETE /websites/:id/pages/:pageId - Delete page
async function testDeletePage(websiteId, pageId) {
  logEndpoint('DELETE', `/websites/${websiteId}/pages/${pageId}`);

  const result = await testEndpoint('DELETE', `/websites/${websiteId}/pages/${pageId}`);

  if (result.ok && result.data.success) {
    logSuccess('Page deleted successfully');
    results.passed++;
    return true;
  } else {
    logError(`Failed: ${result.data.error || result.error}`);
    results.failed++;
    return false;
  }
}

// Test 15: Invalid API Key (should fail)
async function testInvalidAPIKey() {
  logEndpoint('GET', '/websites (invalid API key)');

  const result = await testEndpoint('GET', '/websites', {
    headers: { 'X-API-Key': 'invalid-key-12345' }
  });

  if (!result.ok && result.status === 401) {
    logSuccess('Invalid API key properly rejected (401)');
    results.passed++;
    return true;
  } else {
    logError('Invalid API key was not rejected!');
    results.failed++;
    return false;
  }
}

// Test 16: Missing API Key (should fail)
async function testMissingAPIKey() {
  logEndpoint('GET', '/websites (missing API key)');

  const result = await testEndpoint('GET', '/websites', {
    headers: { 'X-API-Key': '' }
  });

  if (!result.ok && result.status === 401) {
    logSuccess('Missing API key properly rejected (401)');
    results.passed++;
    return true;
  } else {
    logError('Missing API key was not rejected!');
    results.failed++;
    return false;
  }
}

// Main test execution
async function runValidation() {
  log('\n' + '='.repeat(70), 'blue');
  log('  API ENDPOINT VALIDATION SUITE', 'blue');
  log('='.repeat(70), 'blue');
  log(`\nAPI URL: ${API_URL}`, 'cyan');
  log(`API Key: ${API_KEY.substring(0, 20)}...`, 'cyan');
  log(`Website ID: ${WEBSITE_ID}`, 'cyan');

  let createdPageId = null;
  let createdLeadId = null;

  try {
    // Test website endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 1: Website Management', 'yellow');
    log('-'.repeat(70), 'yellow');

    const websites = await testListWebsites();
    if (websites && websites.length > 0) {
      await testGetWebsite(WEBSITE_ID);
    }

    // Test page endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 2: Page Configuration', 'yellow');
    log('-'.repeat(70), 'yellow');

    await testListPages(WEBSITE_ID);
    const createdPage = await testCreatePage(WEBSITE_ID);
    if (createdPage) {
      createdPageId = createdPage.page_id;
      await testUpdatePage(WEBSITE_ID, createdPageId);
    }

    // Test tracking endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 3: Event Tracking', 'yellow');
    log('-'.repeat(70), 'yellow');

    await testTrackEvent(WEBSITE_ID);
    const formResult = await testTrackFormSubmission(WEBSITE_ID);
    if (formResult && formResult.lead_id) {
      createdLeadId = formResult.lead_id;
    }

    // Test lead endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 4: Lead Management', 'yellow');
    log('-'.repeat(70), 'yellow');

    const leads = await testListLeads();
    if (createdLeadId) {
      await testGetLead(createdLeadId);
      await testUpdateLead(createdLeadId);
    } else if (leads && leads.length > 0) {
      await testGetLead(leads[0].id);
      await testUpdateLead(leads[0].id);
    }

    // Test usage endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 5: Usage & Analytics', 'yellow');
    log('-'.repeat(70), 'yellow');

    await testGetUsage();

    // Test smart discovery endpoints
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 6: Smart Discovery', 'yellow');
    log('-'.repeat(70), 'yellow');

    await testGetDiscoveredPages(WEBSITE_ID);
    await testGetDiscoveredCTAs(WEBSITE_ID);

    // Test security
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 7: Security Validation', 'yellow');
    log('-'.repeat(70), 'yellow');

    await testInvalidAPIKey();
    await testMissingAPIKey();

    // Cleanup
    log('\n' + '-'.repeat(70), 'yellow');
    log('SECTION 8: Cleanup', 'yellow');
    log('-'.repeat(70), 'yellow');

    if (createdPageId) {
      await testDeletePage(WEBSITE_ID, createdPageId);
    }

  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    results.failed++;
  }

  // Print summary
  log('\n' + '='.repeat(70), 'blue');
  log('  VALIDATION SUMMARY', 'blue');
  log('='.repeat(70), 'blue');

  const total = results.passed + results.failed;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

  log(`✅ Passed:   ${results.passed}`, 'green');
  log(`❌ Failed:   ${results.failed}`, 'red');
  if (results.warnings > 0) {
    log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
  }
  log(`📊 Total:    ${total}`, 'cyan');
  log(`📈 Pass Rate: ${passRate}%`, passRate >= 90 ? 'green' : passRate >= 70 ? 'yellow' : 'red');

  log('\n' + '='.repeat(70), 'blue');

  if (results.failed === 0) {
    log('\n🎉 All API endpoints validated successfully!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some endpoints failed validation. Please review the errors above.', 'yellow');
    process.exit(1);
  }
}

// Run validation
runValidation().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
