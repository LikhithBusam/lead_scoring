/**
 * Update Test HTML Credentials Script
 * Steps 160-161: Automatically updates HTML test files with tenant credentials
 *
 * Usage: node tests/update-test-credentials.js <tenant1-api-key> <tenant1-website-id> <tenant2-api-key> <tenant2-website-id>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 4) {
  console.error('❌ Usage: node update-test-credentials.js <tenant1-api-key> <tenant1-website-id> <tenant2-api-key> <tenant2-website-id>');
  console.error('\nExample:');
  console.error('  node update-test-credentials.js abc123 web-id-1 xyz789 web-id-2');
  process.exit(1);
}

const [tenant1ApiKey, tenant1WebsiteId, tenant2ApiKey, tenant2WebsiteId] = args;

// Update Tenant 1 HTML file
function updateTenant1HTML() {
  const filePath = path.join(__dirname, 'test-site-tenant1.html');

  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace API key
    content = content.replace(
      /apiKey: 'SET_TENANT1_API_KEY'/g,
      `apiKey: '${tenant1ApiKey}'`
    );

    // Replace Website ID
    content = content.replace(
      /websiteId: 'SET_TENANT1_WEBSITE_ID'/g,
      `websiteId: '${tenant1WebsiteId}'`
    );

    // Replace in the display sections as well
    content = content.replace(
      /<code id="apiKey">SET_TENANT1_API_KEY<\/code>/g,
      `<code id="apiKey">${tenant1ApiKey}</code>`
    );

    content = content.replace(
      /<code id="websiteId">SET_TENANT1_WEBSITE_ID<\/code>/g,
      `<code id="websiteId">${tenant1WebsiteId}</code>`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Updated test-site-tenant1.html');
    console.log(`   API Key: ${tenant1ApiKey}`);
    console.log(`   Website ID: ${tenant1WebsiteId}`);
  } catch (error) {
    console.error(`❌ Error updating Tenant 1 HTML: ${error.message}`);
  }
}

// Update Tenant 2 HTML file
function updateTenant2HTML() {
  const filePath = path.join(__dirname, 'test-site-tenant2.html');

  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace API key
    content = content.replace(
      /apiKey: 'SET_TENANT2_API_KEY'/g,
      `apiKey: '${tenant2ApiKey}'`
    );

    // Replace Website ID
    content = content.replace(
      /websiteId: 'SET_TENANT2_WEBSITE_ID'/g,
      `websiteId: '${tenant2WebsiteId}'`
    );

    // Replace in the display sections as well
    content = content.replace(
      /<code id="apiKey">SET_TENANT2_API_KEY<\/code>/g,
      `<code id="apiKey">${tenant2ApiKey}</code>`
    );

    content = content.replace(
      /<code id="websiteId">SET_TENANT2_WEBSITE_ID<\/code>/g,
      `<code id="websiteId">${tenant2WebsiteId}</code>`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Updated test-site-tenant2.html');
    console.log(`   API Key: ${tenant2ApiKey}`);
    console.log(`   Website ID: ${tenant2WebsiteId}`);
  } catch (error) {
    console.error(`❌ Error updating Tenant 2 HTML: ${error.message}`);
  }
}

console.log('\n🔧 Updating test HTML files with credentials...\n');
updateTenant1HTML();
updateTenant2HTML();
console.log('\n✅ All test files updated successfully!');
console.log('\n📝 Next steps:');
console.log('  1. Open test-site-tenant1.html in your browser');
console.log('  2. Open test-site-tenant2.html in another browser tab');
console.log('  3. Test form submissions and page navigation');
console.log('  4. Check the CRM dashboard to verify data isolation\n');
