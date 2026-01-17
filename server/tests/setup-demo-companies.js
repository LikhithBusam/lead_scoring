/**
 * Setup Demo Companies for Manual Testing
 * Creates 2 companies with websites and provides credentials
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1';

const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupDemoCompanies() {
  log('\n' + '='.repeat(70), 'blue');
  log('  SETTING UP DEMO COMPANIES FOR MANUAL TESTING', 'blue');
  log('='.repeat(70) + '\n', 'blue');

  try {
    // ========== COMPANY 1: TechCorp Solutions ==========
    log('🏢 Creating Company 1: TechCorp Solutions...', 'cyan');
    const company1 = await fetch(`${API_BASE}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'TechCorp Solutions',
        domain: 'techcorp.com',
        plan_type: 'pro'
      })
    }).then(r => r.json());

    const apiKey1 = company1.tenant.api_key;
    const tenantId1 = company1.tenant.tenant_id;
    log('  ✅ Company created successfully!', 'green');

    // Add website for Company 1
    log('  🌐 Adding website...', 'cyan');
    const website1 = await fetch(`${API_BASE}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey1
      },
      body: JSON.stringify({
        website_url: 'https://www.techcorp-solutions.com',
        website_name: 'TechCorp Main Website'
      })
    }).then(r => r.json());

    const websiteId1 = website1.website.website_id;
    log('  ✅ Website added with 5 default pages!', 'green');

    // ========== COMPANY 2: Digital Marketing Pro ==========
    log('\n🏢 Creating Company 2: Digital Marketing Pro...', 'cyan');
    const company2 = await fetch(`${API_BASE}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Digital Marketing Pro',
        domain: 'digitalmarketingpro.com',
        plan_type: 'pro'
      })
    }).then(r => r.json());

    const apiKey2 = company2.tenant.api_key;
    const tenantId2 = company2.tenant.tenant_id;
    log('  ✅ Company created successfully!', 'green');

    // Add website for Company 2
    log('  🌐 Adding website...', 'cyan');
    const website2 = await fetch(`${API_BASE}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey2
      },
      body: JSON.stringify({
        website_url: 'https://www.digitalmarketingpro.io',
        website_name: 'Digital Marketing Pro Website'
      })
    }).then(r => r.json());

    const websiteId2 = website2.website.website_id;
    log('  ✅ Website added with 5 default pages!', 'green');

    // ========== PRINT CREDENTIALS ==========
    log('\n' + '='.repeat(70), 'blue');
    log('  DEMO COMPANIES - LOGIN CREDENTIALS', 'blue');
    log('='.repeat(70) + '\n', 'blue');

    log('┌─────────────────────────────────────────────────────────────────────┐', 'yellow');
    log('│                     COMPANY 1: TechCorp Solutions                   │', 'yellow');
    log('└─────────────────────────────────────────────────────────────────────┘', 'yellow');
    log('', 'reset');
    log('  Company Name:  TechCorp Solutions', 'green');
    log('  Domain:        techcorp.com', 'green');
    log('  Plan:          Pro', 'green');
    log('', 'reset');
    log('  🔑 API Key (copy this):', 'cyan');
    log(`     ${apiKey1}`, 'bold');
    log('', 'reset');
    log('  🌐 Website URL:', 'cyan');
    log('     https://www.techcorp-solutions.com', 'green');
    log('', 'reset');
    log('  📋 Website ID:', 'cyan');
    log(`     ${websiteId1}`, 'reset');
    log('', 'reset');
    log('  📊 Tenant ID:', 'cyan');
    log(`     ${tenantId1}`, 'reset');
    log('', 'reset');

    log('\n┌─────────────────────────────────────────────────────────────────────┐', 'yellow');
    log('│                  COMPANY 2: Digital Marketing Pro                   │', 'yellow');
    log('└─────────────────────────────────────────────────────────────────────┘', 'yellow');
    log('', 'reset');
    log('  Company Name:  Digital Marketing Pro', 'green');
    log('  Domain:        digitalmarketingpro.com', 'green');
    log('  Plan:          Pro', 'green');
    log('', 'reset');
    log('  🔑 API Key (copy this):', 'cyan');
    log(`     ${apiKey2}`, 'bold');
    log('', 'reset');
    log('  🌐 Website URL:', 'cyan');
    log('     https://www.digitalmarketingpro.io', 'green');
    log('', 'reset');
    log('  📋 Website ID:', 'cyan');
    log(`     ${websiteId2}`, 'reset');
    log('', 'reset');
    log('  📊 Tenant ID:', 'cyan');
    log(`     ${tenantId2}`, 'reset');
    log('', 'reset');

    // ========== TESTING INSTRUCTIONS ==========
    log('\n' + '='.repeat(70), 'blue');
    log('  HOW TO TEST IN THE BROWSER', 'blue');
    log('='.repeat(70) + '\n', 'blue');

    log('📝 STEP 1: Open the application', 'cyan');
    log('   Open: http://localhost:5173', 'green');
    log('', 'reset');

    log('📝 STEP 2: Login as Company 1 (TechCorp Solutions)', 'cyan');
    log('   1. You should see a Company Selector screen', 'reset');
    log('   2. Click "Add Company" or enter API key', 'reset');
    log('   3. Paste the API Key for Company 1 (shown above)', 'reset');
    log('   4. You should see the TechCorp dashboard', 'reset');
    log('', 'reset');

    log('📝 STEP 3: View the website and default pages', 'cyan');
    log('   • Website: https://www.techcorp-solutions.com', 'reset');
    log('   • Default Pages: /, /about, /pricing, /contact, /demo', 'reset');
    log('   • You can edit points, delete pages, or add new pages', 'reset');
    log('', 'reset');

    log('📝 STEP 4: Switch to Company 2 (Digital Marketing Pro)', 'cyan');
    log('   1. Click on company selector/switcher', 'reset');
    log('   2. Add Company 2 using its API Key', 'reset');
    log('   3. You should see a DIFFERENT dashboard', 'reset');
    log('   4. Data from Company 1 should NOT be visible', 'reset');
    log('', 'reset');

    log('📝 STEP 5: Test Multi-Tenant Isolation', 'cyan');
    log('   • Switch between companies', 'reset');
    log('   • Verify each company only sees their own data', 'reset');
    log('   • Add leads/websites to one company', 'reset');
    log('   • Verify other company cannot see them', 'reset');
    log('', 'reset');

    log('📝 STEP 6: Test the Hybrid Workflow', 'cyan');
    log('   ✅ Default pages created automatically', 'reset');
    log('   ✅ Edit page points (try changing /pricing points)', 'reset');
    log('   ✅ Delete a default page (try deleting /about)', 'reset');
    log('   ✅ Add a custom page manually', 'reset');
    log('   ✅ Test smart discovery (see discovered pages)', 'reset');
    log('', 'reset');

    log('=' .repeat(70), 'green');
    log('  ✅ SETUP COMPLETE! Ready for manual testing.', 'green');
    log('=' .repeat(70) + '\n', 'green');

    // Save to file for reference
    const credentials = {
      company1: {
        name: 'TechCorp Solutions',
        domain: 'techcorp.com',
        api_key: apiKey1,
        tenant_id: tenantId1,
        website_url: 'https://www.techcorp-solutions.com',
        website_id: websiteId1
      },
      company2: {
        name: 'Digital Marketing Pro',
        domain: 'digitalmarketingpro.com',
        api_key: apiKey2,
        tenant_id: tenantId2,
        website_url: 'https://www.digitalmarketingpro.io',
        website_id: websiteId2
      }
    };

    // Write to file
    const fs = await import('fs');
    fs.writeFileSync(
      'DEMO_CREDENTIALS.json',
      JSON.stringify(credentials, null, 2)
    );

    log('💾 Credentials saved to: DEMO_CREDENTIALS.json\n', 'cyan');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

setupDemoCompanies();
