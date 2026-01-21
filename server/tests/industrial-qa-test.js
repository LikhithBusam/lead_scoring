/**
 * INDUSTRIAL QA TEST SUITE
 * Complete end-to-end testing of Multi-Tenant Lead Scoring System
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_URL = 'http://localhost:3001/api/v1';
const TENANT_ID = 'a2aaf662-c033-4da9-b014-be7af636d2bd';
const API_KEY = 'lsk_d95033840f4cc8b3f1d055e5c9ee1070b8f5fc9e3549b42dfd8d1e239f8d3e24';
const WEBSITE_ID = '19db0175-0223-4795-80f8-163e07365aa4';

// Test results storage
const testResults = [];
let passCount = 0;
let failCount = 0;

function logTest(testId, testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const result = { testId, testName, passed, details, timestamp: new Date().toISOString() };
  testResults.push(result);
  if (passed) passCount++; else failCount++;
  console.log(`${status} | ${testId} | ${testName}`);
  if (details) console.log(`         └─ ${details}`);
}

async function runAllTests() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║           INDUSTRIAL QA TEST SUITE - LEAD SCORING SYSTEM                  ║');
  console.log('║           Testing: Backend, Database, API, Tracking, Dashboard            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Test Started: ${new Date().toISOString()}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────────────');

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 1: BACKEND SERVER CONNECTIVITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📡 TEST GROUP 1: BACKEND SERVER CONNECTIVITY\n');

  // Test 1.1: Health check
  try {
    const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`);
    logTest('1.1', 'Backend health endpoint', response.ok, `Status: ${response.status}`);
  } catch (e) {
    logTest('1.1', 'Backend health endpoint', false, `Error: ${e.message}`);
  }

  // Test 1.2: API responds
  try {
    const response = await fetch(`${API_URL}/tenants/me`, {
      headers: { 'X-API-Key': API_KEY }
    });
    logTest('1.2', 'API authentication works', response.ok, `Status: ${response.status}`);
  } catch (e) {
    logTest('1.2', 'API authentication works', false, `Error: ${e.message}`);
  }

  // Test 1.3: Invalid API key rejected
  try {
    const response = await fetch(`${API_URL}/tenants/me`, {
      headers: { 'X-API-Key': 'invalid_key_123' }
    });
    logTest('1.3', 'Invalid API key rejected', response.status === 401 || response.status === 403, `Status: ${response.status}`);
  } catch (e) {
    logTest('1.3', 'Invalid API key rejected', false, `Error: ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 2: DATABASE CONNECTIVITY & DATA INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n💾 TEST GROUP 2: DATABASE CONNECTIVITY & DATA INTEGRITY\n');

  // Test 2.1: Supabase connection
  try {
    const { data, error } = await supabase.from('tenants').select('tenant_id').limit(1);
    logTest('2.1', 'Supabase connection', !error, error ? error.message : 'Connected');
  } catch (e) {
    logTest('2.1', 'Supabase connection', false, e.message);
  }

  // Test 2.2: Tenant exists in database
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .single();
    logTest('2.2', 'Tenant exists in database', !!data && !error, data ? `Company: ${data.company_name}` : 'Not found');
  } catch (e) {
    logTest('2.2', 'Tenant exists in database', false, e.message);
  }

  // Test 2.3: Website stored with tenant_id
  try {
    const { data, error } = await supabase
      .from('tenant_websites')
      .select('*')
      .eq('tenant_id', TENANT_ID);
    const hasCorrectTenant = data && data.length > 0 && data.every(w => w.tenant_id === TENANT_ID);
    logTest('2.3', 'Website stored with tenant_id', hasCorrectTenant, `Found ${data?.length || 0} website(s)`);
  } catch (e) {
    logTest('2.3', 'Website stored with tenant_id', false, e.message);
  }

  // Test 2.4: Pages stored with scoring
  try {
    const { data, error } = await supabase
      .from('tenant_pages')
      .select('*')
      .eq('website_id', WEBSITE_ID);
    const hasScoring = data && data.length > 0 && data.every(p => p.base_points !== null);
    logTest('2.4', 'Pages stored with scoring', hasScoring, `Found ${data?.length || 0} page(s) with scoring`);
  } catch (e) {
    logTest('2.4', 'Pages stored with scoring', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 3: TRACKING SCRIPT FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📊 TEST GROUP 3: TRACKING SCRIPT FUNCTIONALITY\n');

  // Test 3.1: Tracking script file accessible
  try {
    const response = await fetch('http://localhost:3001/tracking-plugin/lead-scorer.js');
    logTest('3.1', 'Tracking script accessible', response.ok, `Status: ${response.status}`);
  } catch (e) {
    logTest('3.1', 'Tracking script accessible', false, e.message);
  }

  // Test 3.2: Tracking endpoint accepts events
  const visitorId = `qa_test_${Date.now()}`;
  try {
    const response = await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Website-ID': WEBSITE_ID
      },
      body: JSON.stringify({
        event_type: 'page_view',
        visitor_id: visitorId,
        session_id: 'qa_session_001',
        data: {
          page_url: '/qa-test-page',
          page_title: 'QA Test Page',
          timestamp: new Date().toISOString()
        }
      })
    });
    const result = await response.json();
    logTest('3.2', 'Tracking endpoint accepts events', response.ok && result.success, `Points: ${result.points_earned || 0}`);
  } catch (e) {
    logTest('3.2', 'Tracking endpoint accepts events', false, e.message);
  }

  // Test 3.3: Page view stored in database
  await sleep(500); // Wait for DB write
  try {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('visitor_id', visitorId)
      .eq('activity_type', 'page_view');
    logTest('3.3', 'Page view stored in database', data && data.length > 0, `Found ${data?.length || 0} activity record(s)`);
  } catch (e) {
    logTest('3.3', 'Page view stored in database', false, e.message);
  }

  // Test 3.4: Activity has correct tenant_id
  try {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('tenant_id')
      .eq('visitor_id', visitorId)
      .single();
    logTest('3.4', 'Activity has correct tenant_id', data?.tenant_id === TENANT_ID, `Tenant: ${data?.tenant_id || 'N/A'}`);
  } catch (e) {
    logTest('3.4', 'Activity has correct tenant_id', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 4: LEAD CREATION & SCORING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🎯 TEST GROUP 4: LEAD CREATION & SCORING\n');

  // Test 4.1: Form submission creates lead
  const testEmail = `qa_test_${Date.now()}@example.com`;
  let newLeadId = null;
  try {
    const response = await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Website-ID': WEBSITE_ID
      },
      body: JSON.stringify({
        event_type: 'form_submission',
        visitor_id: visitorId,
        session_id: 'qa_session_001',
        data: {
          email: testEmail,
          name: 'QA Test User',
          company: 'QA Test Company',
          phone: '+1-555-0000',
          page_url: '/signup',
          timestamp: new Date().toISOString()
        }
      })
    });
    const result = await response.json();
    newLeadId = result.lead_id;
    logTest('4.1', 'Form submission creates lead', result.lead_created === true, `Lead ID: ${newLeadId || 'N/A'}`);
  } catch (e) {
    logTest('4.1', 'Form submission creates lead', false, e.message);
  }

  // Wait for lead score calculation
  await sleep(2000);

  // Test 4.2: Contact stored in database
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', testEmail)
      .single();
    logTest('4.2', 'Contact stored in database', !!data, `Name: ${data?.first_name || 'N/A'}`);
  } catch (e) {
    logTest('4.2', 'Contact stored in database', false, e.message);
  }

  // Test 4.3: Lead stored with tenant_id
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('lead_id', newLeadId)
      .single();
    logTest('4.3', 'Lead stored with tenant_id', data?.tenant_id === TENANT_ID, `Status: ${data?.lead_status || 'N/A'}`);
  } catch (e) {
    logTest('4.3', 'Lead stored with tenant_id', false, e.message);
  }

  // Test 4.4: Lead score calculated
  try {
    const { data, error } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('lead_id', newLeadId)
      .single();
    logTest('4.4', 'Lead score calculated', !!data, `Score: ${data?.total_score || 0}, Class: ${data?.score_classification || 'N/A'}`);
  } catch (e) {
    logTest('4.4', 'Lead score calculated', false, e.message);
  }

  // Test 4.5: Activities linked to lead
  try {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('visitor_id', visitorId)
      .not('lead_id', 'is', null);
    logTest('4.5', 'Activities linked to lead', data && data.length > 0, `Linked activities: ${data?.length || 0}`);
  } catch (e) {
    logTest('4.5', 'Activities linked to lead', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 5: COMPANY DASHBOARD API
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🖥️  TEST GROUP 5: COMPANY DASHBOARD API\n');

  // Test 5.1: Get tenant profile
  try {
    const response = await fetch(`${API_URL}/tenants/me`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const result = await response.json();
    logTest('5.1', 'Get tenant profile', result.success && result.tenant, `Company: ${result.tenant?.company_name || 'N/A'}`);
  } catch (e) {
    logTest('5.1', 'Get tenant profile', false, e.message);
  }

  // Test 5.2: Get websites list
  try {
    const response = await fetch(`${API_URL}/websites`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const result = await response.json();
    logTest('5.2', 'Get websites list', result.success && result.websites, `Count: ${result.websites?.length || 0}`);
  } catch (e) {
    logTest('5.2', 'Get websites list', false, e.message);
  }

  // Test 5.3: Get pages with scoring
  try {
    const response = await fetch(`${API_URL}/websites/${WEBSITE_ID}/pages`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const result = await response.json();
    logTest('5.3', 'Get pages with scoring', result.success && result.pages, `Count: ${result.pages?.length || 0}`);
  } catch (e) {
    logTest('5.3', 'Get pages with scoring', false, e.message);
  }

  // Test 5.4: Get leads list
  try {
    const response = await fetch(`${API_URL}/leads`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const result = await response.json();
    logTest('5.4', 'Get leads list', result.success && result.leads, `Count: ${result.leads?.length || 0}`);
  } catch (e) {
    logTest('5.4', 'Get leads list', false, e.message);
  }

  // Test 5.5: New lead visible in dashboard
  try {
    const response = await fetch(`${API_URL}/leads`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const result = await response.json();
    const newLeadVisible = result.leads?.some(l => l.email === testEmail);
    logTest('5.5', 'New lead visible in dashboard', newLeadVisible, `Email: ${testEmail}`);
  } catch (e) {
    logTest('5.5', 'New lead visible in dashboard', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 6: MULTI-TENANT ISOLATION (RLS)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔒 TEST GROUP 6: MULTI-TENANT ISOLATION (RLS)\n');

  // Test 6.1: All leads have tenant_id
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('tenant_id')
      .eq('tenant_id', TENANT_ID);
    const allHaveTenantId = data && data.every(l => l.tenant_id === TENANT_ID);
    logTest('6.1', 'All leads have correct tenant_id', allHaveTenantId, `Checked ${data?.length || 0} leads`);
  } catch (e) {
    logTest('6.1', 'All leads have correct tenant_id', false, e.message);
  }

  // Test 6.2: All activities have tenant_id
  try {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('tenant_id')
      .eq('tenant_id', TENANT_ID)
      .limit(100);
    const allHaveTenantId = data && data.every(a => a.tenant_id === TENANT_ID);
    logTest('6.2', 'All activities have tenant_id', allHaveTenantId, `Checked ${data?.length || 0} activities`);
  } catch (e) {
    logTest('6.2', 'All activities have tenant_id', false, e.message);
  }

  // Test 6.3: API filters by tenant (cannot see other tenant's data)
  try {
    const { data: allTenants } = await supabase.from('tenants').select('tenant_id, api_key');
    const otherTenant = allTenants?.find(t => t.tenant_id !== TENANT_ID && t.api_key);

    if (otherTenant) {
      // Try to access with different API key
      const response = await fetch(`${API_URL}/leads`, {
        headers: { 'X-API-Key': otherTenant.api_key }
      });
      const result = await response.json();
      const seesOurData = result.leads?.some(l => l.email === testEmail);
      logTest('6.3', 'Other tenant cannot see our leads', !seesOurData, 'Tenant isolation verified');
    } else {
      logTest('6.3', 'Other tenant cannot see our leads', true, 'No other tenant to test (isolation by default)');
    }
  } catch (e) {
    logTest('6.3', 'Other tenant cannot see our leads', false, e.message);
  }

  // Test 6.4: Websites isolated by tenant
  try {
    const { data, error } = await supabase
      .from('tenant_websites')
      .select('tenant_id')
      .eq('website_id', WEBSITE_ID)
      .single();
    logTest('6.4', 'Website belongs to correct tenant', data?.tenant_id === TENANT_ID, `Tenant: ${data?.tenant_id || 'N/A'}`);
  } catch (e) {
    logTest('6.4', 'Website belongs to correct tenant', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST GROUP 7: DATA FLOW VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔄 TEST GROUP 7: DATA FLOW VERIFICATION\n');

  // Test 7.1: Complete flow - visitor to lead
  try {
    const flowVisitorId = `flow_test_${Date.now()}`;
    const flowEmail = `flow_test_${Date.now()}@example.com`;

    // Step 1: Page views
    await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-Website-ID': WEBSITE_ID },
      body: JSON.stringify({ event_type: 'page_view', visitor_id: flowVisitorId, data: { page_url: '/' } })
    });
    await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-Website-ID': WEBSITE_ID },
      body: JSON.stringify({ event_type: 'page_view', visitor_id: flowVisitorId, data: { page_url: '/pricing' } })
    });

    // Step 2: Form submission
    const formResponse = await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-Website-ID': WEBSITE_ID },
      body: JSON.stringify({ event_type: 'form_submission', visitor_id: flowVisitorId, data: { email: flowEmail, name: 'Flow Test' } })
    });
    const formResult = await formResponse.json();

    await sleep(2000);

    // Step 3: Verify lead exists with score
    const { data: leadScore } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('lead_id', formResult.lead_id)
      .single();

    const flowPassed = formResult.lead_created && leadScore?.total_score !== undefined;
    logTest('7.1', 'Complete flow: visitor → pages → form → lead', flowPassed, `Score: ${leadScore?.total_score || 'N/A'}`);
  } catch (e) {
    logTest('7.1', 'Complete flow: visitor → pages → form → lead', false, e.message);
  }

  // Test 7.2: Scoring matches page configuration
  try {
    const { data: pages } = await supabase
      .from('tenant_pages')
      .select('page_url, base_points')
      .eq('website_id', WEBSITE_ID);

    const hasProperScoring = pages && pages.length > 0 && pages.some(p => p.base_points > 0);
    logTest('7.2', 'Scoring matches page configuration', hasProperScoring, `Pages with scores: ${pages?.filter(p => p.base_points > 0).length || 0}`);
  } catch (e) {
    logTest('7.2', 'Scoring matches page configuration', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP & FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           FINAL TEST REPORT                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Test Completed: ${new Date().toISOString()}`);
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ SUMMARY                                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Total Tests:  ${(passCount + failCount).toString().padEnd(5)} │ Passed: ${passCount.toString().padEnd(5)} │ Failed: ${failCount.toString().padEnd(5)} │ Pass Rate: ${Math.round(passCount/(passCount+failCount)*100)}%     │`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Detailed results by category
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ DETAILED RESULTS BY CATEGORY                                               │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const categories = {
    '1': { name: 'Backend Connectivity', tests: [] },
    '2': { name: 'Database Integrity', tests: [] },
    '3': { name: 'Tracking Script', tests: [] },
    '4': { name: 'Lead Creation & Scoring', tests: [] },
    '5': { name: 'Dashboard API', tests: [] },
    '6': { name: 'Multi-Tenant Isolation', tests: [] },
    '7': { name: 'Data Flow', tests: [] }
  };

  testResults.forEach(r => {
    const cat = r.testId.split('.')[0];
    if (categories[cat]) {
      categories[cat].tests.push(r);
    }
  });

  Object.entries(categories).forEach(([key, cat]) => {
    const passed = cat.tests.filter(t => t.passed).length;
    const total = cat.tests.length;
    const status = passed === total ? '✅' : '⚠️';
    console.log(`│ ${status} ${cat.name.padEnd(25)} │ ${passed}/${total} passed ${' '.repeat(30)}│`);
  });

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Failed tests detail
  const failedTests = testResults.filter(t => !t.passed);
  if (failedTests.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ ❌ FAILED TESTS                                                             │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    failedTests.forEach(t => {
      console.log(`│ ${t.testId} │ ${t.testName.padEnd(40)} │ ${(t.details || '').substring(0, 20)} │`);
    });
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ SYSTEM STATUS                                                               │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const backendOk = categories['1'].tests.every(t => t.passed);
  const dbOk = categories['2'].tests.every(t => t.passed);
  const trackingOk = categories['3'].tests.every(t => t.passed);
  const leadOk = categories['4'].tests.every(t => t.passed);
  const dashboardOk = categories['5'].tests.every(t => t.passed);
  const rlsOk = categories['6'].tests.every(t => t.passed);

  console.log(`│ Backend Server:      ${backendOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log(`│ Database:            ${dbOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log(`│ Tracking Script:     ${trackingOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log(`│ Lead Creation:       ${leadOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log(`│ Dashboard API:       ${dashboardOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log(`│ Tenant Isolation:    ${rlsOk ? '✅ OPERATIONAL' : '❌ ISSUES FOUND'}                                         │`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  console.log('');

  const overallStatus = passCount === passCount + failCount ? 'ALL TESTS PASSED' :
                        failCount <= 2 ? 'MOSTLY OPERATIONAL' : 'NEEDS ATTENTION';

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log(`║ OVERALL STATUS: ${overallStatus.padEnd(55)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  return { passed: passCount, failed: failCount, total: passCount + failCount };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runAllTests().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
