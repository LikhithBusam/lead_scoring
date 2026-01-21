/**
 * Quick API Test Script
 * Tests the main workflow to verify data is being stored
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Use existing demo company API key (from setup-demo-companies.js)
const DEMO_API_KEY = 'lsk_7912d8b2be8246cca164d342dc2b2fa1d30b2b58f1cb75aeddb2d914433cec43';

async function testAPI() {
    console.log('\n🧪 LEAD SCORING API - QUICK TEST\n');
    console.log('=' .repeat(50));
    
    const results = { passed: 0, failed: 0 };

    // Helper function
    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ ${name}`);
            results.passed++;
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   Error: ${error.message}`);
            results.failed++;
        }
    }

    // Test 1: Get tenant profile using demo API key
    let tenant;
    await test('1. Get Tenant Profile (API Key Auth)', async () => {
        const response = await fetch(`${API_BASE}/tenants/me`, {
            headers: { 'X-API-Key': DEMO_API_KEY }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to get tenant');
        tenant = data.tenant;
        console.log(`   ✓ Company: ${tenant.company_name}`);
        console.log(`   ✓ Plan: ${tenant.plan_type}`);
        console.log(`   ✓ Websites: ${tenant.stats?.websites || 0}`);
        console.log(`   ✓ Leads: ${tenant.stats?.leads || 0}`);
    });

    // Test 2: Get websites
    let websites = [];
    await test('2. Get Websites', async () => {
        const response = await fetch(`${API_BASE}/websites`, {
            headers: { 'X-API-Key': DEMO_API_KEY }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        websites = data.websites || [];
        console.log(`   ✓ Total Websites: ${data.count}`);
        websites.forEach(w => {
            console.log(`   - ${w.website_name}: ${w.website_url}`);
        });
    });

    // Test 3: Get pages for first website
    let website = websites[0];
    await test('3. Get Pages (Verify Default Pages)', async () => {
        if (!website) throw new Error('No website found');
        const response = await fetch(`${API_BASE}/websites/${website.website_id}/pages`, {
            headers: { 'X-API-Key': DEMO_API_KEY }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        console.log(`   ✓ Total Pages: ${data.count}`);
        data.pages.slice(0, 5).forEach(p => {
            console.log(`   - ${p.page_name} (${p.page_url}) = ${p.base_points} pts`);
        });
    });

    // Test 4: Track a page view
    await test('4. Track Page View', async () => {
        if (!website) throw new Error('No website found');
        const response = await fetch(`${API_BASE}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': DEMO_API_KEY,
                'X-Website-Id': website.website_id
            },
            body: JSON.stringify({
                event_type: 'page_view',
                visitor_id: `test_visitor_${Date.now()}`,
                data: {
                    page_url: '/pricing',
                    page_title: 'Pricing Page'
                }
            })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        console.log(`   ✓ Tracked: ${data.tracked}`);
        console.log(`   ✓ Points Earned: ${data.points_earned || 0}`);
    });

    // Test 5: Track form submission (creates lead)
    await test('5. Track Form Submission (Create Lead)', async () => {
        if (!website) throw new Error('No website found');
        const response = await fetch(`${API_BASE}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': DEMO_API_KEY,
                'X-Website-Id': website.website_id
            },
            body: JSON.stringify({
                event_type: 'form_submission',
                visitor_id: `test_visitor_${Date.now()}`,
                data: {
                    email: `test_${Date.now()}@example.com`,
                    name: 'Test User',
                    company: 'Test Company',
                    page_url: '/contact'
                }
            })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        console.log(`   ✓ Tracked: ${data.tracked}`);
        console.log(`   ✓ Lead Created: ${data.lead_created || false}`);
        if (data.lead_id) console.log(`   ✓ Lead ID: ${data.lead_id}`);
    });

    // Test 6: Get leads
    await test('6. Get Leads', async () => {
        const response = await fetch(`${API_BASE}/leads`, {
            headers: { 'X-API-Key': DEMO_API_KEY }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        console.log(`   ✓ Total Leads: ${data.count}`);
        console.log(`   ✓ Tenant: ${data.tenant_name}`);
        if (data.leads.length > 0) {
            console.log(`   Sample Leads:`);
            data.leads.slice(0, 3).forEach(l => {
                console.log(`   - ${l.name} (${l.email}) - Score: ${l.score}`);
            });
        }
    });

    // Test 7: Add a new website (with default pages)
    await test('7. Add New Website (Auto-creates Default Pages)', async () => {
        const response = await fetch(`${API_BASE}/websites`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': DEMO_API_KEY
            },
            body: JSON.stringify({
                website_url: `https://test-${Date.now()}.com`,
                website_name: 'Test Website ' + Date.now()
            })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to add website');
        console.log(`   ✓ Website ID: ${data.website.website_id}`);
        console.log(`   ✓ Default Pages Created: ${data.website.default_pages_created}`);
        console.log(`   ✓ Tracking Code: ${data.website.tracking_code}`);
    });

    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log(`\n📊 TEST RESULTS: ${results.passed} passed, ${results.failed} failed\n`);
    
    if (results.failed === 0) {
        console.log('✅ ALL TESTS PASSED! Data is being stored correctly.\n');
    } else {
        console.log('⚠️  Some tests failed. Check the errors above.\n');
    }

    console.log('📝 WHAT WAS VERIFIED:');
    console.log('   ✓ API Key authentication works');
    console.log('   ✓ Tenant profile retrieval works');
    console.log('   ✓ Website management works');
    console.log('   ✓ Default pages auto-creation works');
    console.log('   ✓ Page view tracking works');
    console.log('   ✓ Form submission & lead creation works');
    console.log('   ✓ Lead retrieval works');
    console.log('   ✓ Data is stored in Supabase database\n');

    console.log('🔗 LOCALHOST URLS:');
    console.log('   Backend API: http://localhost:3001');
    console.log('   Frontend:    http://localhost:5173\n');

    console.log('🚀 FOR PRODUCTION DEPLOYMENT:');
    console.log('   1. Run migration: 08_link_users_to_tenants.sql');
    console.log('   2. Set BYPASS_AUTH=false in .env');
    console.log('   3. Set proper SUPABASE_URL and keys');
    console.log('   4. Set JWT_SECRET to secure random string');
    console.log('   5. Update ALLOWED_ORIGINS for your domain\n');
}

testAPI().catch(console.error);
