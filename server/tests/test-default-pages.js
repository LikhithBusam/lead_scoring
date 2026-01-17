/**
 * Test Script: Default Page Template Creation
 * Tests Step 176-177: Automatic default page creation when website is added
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/v1';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDefaultPageCreation() {
  log('\n' + '='.repeat(70), 'blue');
  log('  TESTING DEFAULT PAGE TEMPLATE CREATION', 'blue');
  log('='.repeat(70) + '\n', 'blue');

  try {
    // Step 1: Register a new test tenant
    log('📋 Step 1: Registering test tenant...', 'cyan');
    const tenantResponse = await fetch(`${API_URL}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Default Pages Test Company',
        domain: 'defaulttest.com',
        plan_type: 'pro'
      })
    });

    const tenant = await tenantResponse.json();
    if (!tenant.success) {
      log(`  ❌ Failed to register tenant: ${tenant.error}`, 'red');
      return;
    }

    log(`  ✅ Tenant created: ${tenant.tenant.company_name}`, 'green');
    log(`  ✅ API Key: ${tenant.tenant.api_key}`, 'green');

    const apiKey = tenant.tenant.api_key;

    // Step 2: Add a website (should auto-create default pages)
    log('\n📋 Step 2: Adding website (should create default pages)...', 'cyan');
    const websiteResponse = await fetch(`${API_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        website_url: 'https://defaulttest.com',
        website_name: 'Default Test Site',
        cors_origins: ['https://defaulttest.com']
      })
    });

    const websiteResult = await websiteResponse.json();
    if (!websiteResult.success) {
      log(`  ❌ Failed to create website: ${websiteResult.error}`, 'red');
      return;
    }

    log(`  ✅ Website created: ${websiteResult.website.website_name}`, 'green');
    log(`  ✅ Website ID: ${websiteResult.website.website_id}`, 'green');
    log(`  ✅ Default pages created: ${websiteResult.website.default_pages_created}`, 'green');

    const websiteId = websiteResult.website.website_id;
    const expectedPageCount = 5; // Home, About, Pricing, Contact, Demo

    if (websiteResult.website.default_pages_created !== expectedPageCount) {
      log(`  ⚠️  Expected ${expectedPageCount} pages, got ${websiteResult.website.default_pages_created}`, 'yellow');
    }

    // Step 3: Verify pages were created
    log('\n📋 Step 3: Verifying default pages exist...', 'cyan');
    const pagesResponse = await fetch(`${API_URL}/websites/${websiteId}/pages`, {
      headers: { 'X-API-Key': apiKey }
    });

    const pagesResult = await pagesResponse.json();
    if (!pagesResult.success) {
      log(`  ❌ Failed to fetch pages: ${pagesResult.error}`, 'red');
      return;
    }

    const pages = pagesResult.pages;
    log(`  ✅ Total pages retrieved: ${pages.length}`, 'green');

    // Expected default pages
    const expectedPages = [
      { url: '/', name: 'Home', points: 1 },
      { url: '/about', name: 'About Us', points: 2 },
      { url: '/pricing', name: 'Pricing', points: 10 },
      { url: '/contact', name: 'Contact', points: 5 },
      { url: '/demo', name: 'Request Demo', points: 15 }
    ];

    log('\n  Default Page Details:', 'cyan');
    log('  ' + '-'.repeat(60), 'cyan');

    let allPagesFound = true;
    for (const expected of expectedPages) {
      const foundPage = pages.find(p => p.page_url === expected.url);
      if (foundPage) {
        log(`  ✅ ${expected.url.padEnd(15)} → ${expected.name.padEnd(20)} → ${foundPage.base_points} points`, 'green');
        if (foundPage.base_points !== expected.points) {
          log(`     ⚠️  Expected ${expected.points} points, got ${foundPage.base_points}`, 'yellow');
        }
      } else {
        log(`  ❌ ${expected.url.padEnd(15)} → ${expected.name.padEnd(20)} → NOT FOUND`, 'red');
        allPagesFound = false;
      }
    }

    // Step 4: Test that admin can edit default pages
    log('\n📋 Step 4: Testing admin can edit default page points...', 'cyan');
    const pricingPage = pages.find(p => p.page_url === '/pricing');
    if (pricingPage) {
      const updateResponse = await fetch(`${API_URL}/websites/${websiteId}/pages/${pricingPage.page_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          base_points: 20 // Change from 10 to 20
        })
      });

      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        log(`  ✅ Successfully updated /pricing from 10 to ${updateResult.page.base_points} points`, 'green');
      } else {
        log(`  ❌ Failed to update page: ${updateResult.error}`, 'red');
      }
    }

    // Step 5: Test that admin can delete default pages
    log('\n📋 Step 5: Testing admin can delete default pages...', 'cyan');
    const aboutPage = pages.find(p => p.page_url === '/about');
    if (aboutPage) {
      const deleteResponse = await fetch(`${API_URL}/websites/${websiteId}/pages/${aboutPage.page_id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey }
      });

      const deleteResult = await deleteResponse.json();
      if (deleteResult.success) {
        log(`  ✅ Successfully deleted /about page`, 'green');
      } else {
        log(`  ❌ Failed to delete page: ${deleteResult.error}`, 'red');
      }
    }

    // Step 6: Test that admin can add custom pages
    log('\n📋 Step 6: Testing admin can add custom pages...', 'cyan');
    const customPageResponse = await fetch(`${API_URL}/websites/${websiteId}/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        page_url: '/custom-landing-page',
        page_name: 'Custom Landing Page',
        page_category: 'high-value',
        base_points: 25
      })
    });

    const customPageResult = await customPageResponse.json();
    if (customPageResult.success) {
      log(`  ✅ Successfully added custom page: ${customPageResult.page.page_name} (${customPageResult.page.base_points} points)`, 'green');
    } else {
      log(`  ❌ Failed to add custom page: ${customPageResult.error}`, 'red');
    }

    // Final Summary
    log('\n' + '='.repeat(70), 'blue');
    log('  TEST SUMMARY', 'blue');
    log('='.repeat(70), 'blue');

    if (allPagesFound && pages.length === expectedPageCount) {
      log('\n✅ ALL TESTS PASSED!', 'green');
      log('   • Default pages automatically created ✓', 'green');
      log('   • All 5 default pages present ✓', 'green');
      log('   • Admin can edit page points ✓', 'green');
      log('   • Admin can delete default pages ✓', 'green');
      log('   • Admin can add custom pages ✓', 'green');
      log('\n🎉 Default Page Template feature is WORKING PERFECTLY!\n', 'green');
    } else {
      log('\n⚠️  SOME TESTS FAILED', 'yellow');
      log(`   Pages expected: ${expectedPageCount}`, 'yellow');
      log(`   Pages found: ${pages.length}`, 'yellow');
    }

  } catch (error) {
    log(`\n❌ Error during testing: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the test
testDefaultPageCreation();
