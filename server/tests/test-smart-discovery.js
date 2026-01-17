/**
 * Smart Discovery Workflow Test (Step 7)
 * Tests the hybrid page discovery and approval workflow
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1';

// Color codes for console output
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

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function assert(condition, successMsg, failMsg) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    log(`  ✅ ${successMsg}`, 'green');
    return true;
  } else {
    testResults.failed++;
    log(`  ❌ ${failMsg}`, 'red');
    return false;
  }
}

async function apiRequest(method, endpoint, apiKey, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

async function runTests() {
  log('\n======================================================================', 'blue');
  log('  TESTING SMART DISCOVERY WORKFLOW (STEP 7)', 'blue');
  log('======================================================================\n', 'blue');

  let apiKey, websiteId, visitorId = 'test-visitor-' + Date.now();

  try {
    // Step 1: Register tenant
    log('📋 Step 1: Registering test tenant...', 'cyan');
    const tenantResponse = await fetch(`${API_BASE}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Smart Discovery Test Co',
        domain: 'discovery-test.example.com',
        plan_type: 'pro'
      })
    });
    const tenantData = await tenantResponse.json();
    apiKey = tenantData.tenant.api_key;
    assert(!!apiKey, 'Tenant created successfully', 'Failed to create tenant');

    // Step 2: Add website (creates default pages)
    log('\n📋 Step 2: Adding website with default pages...', 'cyan');
    const websiteData = await apiRequest('POST', '/websites', apiKey, {
      website_url: 'https://discovery-test.example.com',
      website_name: 'Discovery Test Site'
    });
    websiteId = websiteData.website.website_id;
    assert(websiteData.website.default_pages_created === 5,
      '5 default pages created automatically',
      'Default pages not created');

    // Step 3: Get initial pages
    log('\n📋 Step 3: Verifying default pages...', 'cyan');
    const initialPages = await apiRequest('GET', `/websites/${websiteId}/pages`, apiKey);
    log(`  Default pages: /, /about, /pricing, /contact, /demo`, 'reset');
    assert(initialPages.pages.length === 5,
      'All 5 default pages present',
      'Missing default pages');

    // Step 4: SMART DISCOVERY - Visitor accesses unconfigured page
    log('\n📋 Step 4: SMART DISCOVERY - Visitor accesses unconfigured page...', 'cyan');
    log('  Simulating visitor accessing /features page (not in defaults)', 'reset');

    const trackingResponse = await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        website_id: websiteId,
        visitor_id: visitorId,
        event_type: 'page_view',
        data: {
          page_url: '/features',
          page_title: 'Features Page',
          timestamp: new Date().toISOString()
        }
      })
    });
    const trackingData = await trackingResponse.json();

    assert(trackingData.discovered === true,
      'Page automatically discovered and saved as pending',
      'Page discovery failed');
    assert(trackingData.tracked === false,
      'Page NOT scored (no points assigned yet)',
      'Page should not be tracked until approved');

    // Step 5: Admin sees discovered page
    log('\n📋 Step 5: Admin checks discovered pages...', 'cyan');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB to update

    const discoveredPages = await apiRequest('GET', `/websites/${websiteId}/discovered-pages`, apiKey);
    assert(discoveredPages.discovered_pages.length > 0,
      `Found ${discoveredPages.discovered_pages.length} discovered page(s)`,
      'No discovered pages found');

    const discoveredPage = discoveredPages.discovered_pages[0];
    log(`  Page: ${discoveredPage.page_url} (${discoveredPage.page_title})`, 'reset');
    log(`  Status: ${discoveredPage.review_status}`, 'reset');
    log(`  Visits: ${discoveredPage.visit_count}`, 'reset');

    // Step 6: Visitor accesses the same page again (increments counter)
    log('\n📋 Step 6: Visitor accesses /features again (increment counter)...', 'cyan');
    await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        website_id: websiteId,
        visitor_id: visitorId,
        event_type: 'page_view',
        data: {
          page_url: '/features',
          page_title: 'Features Page',
          timestamp: new Date().toISOString()
        }
      })
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    const updatedDiscovered = await apiRequest('GET', `/websites/${websiteId}/discovered-pages`, apiKey);
    const updatedPage = updatedDiscovered.discovered_pages[0];

    assert(updatedPage.visit_count >= 2,
      `Visit count incremented to ${updatedPage.visit_count}`,
      'Visit count not incremented');

    // Step 7: Admin APPROVES discovered page with points
    log('\n📋 Step 7: Admin approves discovered page with points...', 'cyan');
    const approvalData = await apiRequest('POST',
      `/websites/${websiteId}/discovered-pages/${discoveredPage.discovery_id}/approve`,
      apiKey,
      {
        page_name: 'Features',
        page_category: 'high-value',
        base_points: 12
      }
    );

    assert(approvalData.success === true,
      'Page approved and added to tracking configuration',
      'Failed to approve page');

    // Step 8: Verify page is now in tracked pages
    log('\n📋 Step 8: Verifying page is now tracked...', 'cyan');
    const updatedPages = await apiRequest('GET', `/websites/${websiteId}/pages`, apiKey);
    const featuresPage = updatedPages.pages.find(p => p.page_url === '/features');

    assert(!!featuresPage,
      'Features page now appears in tracked pages',
      'Approved page not found in tracked pages');
    assert(featuresPage.base_points === 12,
      `Features page has correct points: ${featuresPage.base_points}`,
      'Points not set correctly');

    // Step 9: Visitor accesses page again - NOW IT SCORES
    log('\n📋 Step 9: Visitor accesses /features again - NOW IT SCORES...', 'cyan');
    const scoredTracking = await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        website_id: websiteId,
        visitor_id: visitorId,
        event_type: 'page_view',
        data: {
          page_url: '/features',
          page_title: 'Features Page',
          timestamp: new Date().toISOString()
        }
      })
    });
    const scoredData = await scoredTracking.json();

    assert(scoredData.tracked === true,
      'Page is now being tracked and scored!',
      'Page should be tracked after approval');
    assert(scoredData.points_awarded > 0,
      `Points awarded: ${scoredData.points_awarded}`,
      'No points awarded');

    // Step 10: Test REJECTION workflow
    log('\n📋 Step 10: Testing page REJECTION workflow...', 'cyan');
    log('  Visitor accesses /irrelevant-page...', 'reset');

    await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Website-ID': websiteId
      },
      body: JSON.stringify({
        website_id: websiteId,
        visitor_id: visitorId,
        event_type: 'page_view',
        data: {
          page_url: '/irrelevant-page',
          page_title: 'Irrelevant Page',
          timestamp: new Date().toISOString()
        }
      })
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    const discoveredWithRejection = await apiRequest('GET', `/websites/${websiteId}/discovered-pages`, apiKey);
    const pageToReject = discoveredWithRejection.discovered_pages.find(p => p.page_url === '/irrelevant-page');

    if (pageToReject) {
      log('  Admin rejects the page...', 'reset');
      const rejectionData = await apiRequest('POST',
        `/websites/${websiteId}/discovered-pages/${pageToReject.discovery_id}/reject`,
        apiKey
      );

      assert(rejectionData.success === true,
        'Page rejected successfully',
        'Failed to reject page');

      // Verify rejected page doesn't appear in tracked pages
      const finalPages = await apiRequest('GET', `/websites/${websiteId}/pages`, apiKey);
      const rejectedPage = finalPages.pages.find(p => p.page_url === '/irrelevant-page');

      assert(!rejectedPage,
        'Rejected page does NOT appear in tracked pages',
        'Rejected page should not be tracked');
    }

    // Summary
    log('\n======================================================================', 'blue');
    log('  TEST SUMMARY', 'blue');
    log('======================================================================', 'blue');
    log(`\n✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    log(`📊 Total:  ${testResults.total}`, 'cyan');

    if (testResults.failed === 0) {
      log('\n✅ ALL SMART DISCOVERY TESTS PASSED!', 'green');
      log('   • Pages auto-discovered when visited ✓', 'green');
      log('   • Visit counts tracked correctly ✓', 'green');
      log('   • Admin can approve pages with points ✓', 'green');
      log('   • Approved pages start scoring ✓', 'green');
      log('   • Admin can reject unwanted pages ✓', 'green');
      log('\n🎉 Smart Discovery (Step 7) is WORKING PERFECTLY!\n', 'green');
    } else {
      log('\n❌ SOME TESTS FAILED', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ TEST ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

runTests();
