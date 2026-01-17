# Testing Suite - Quick Reference

This directory contains all testing scripts for the Multi-Tenant Lead Scoring System.

## Test Files

1. **multi-tenant-test.js** - Automated end-to-end test suite
2. **api-validation.js** - API endpoint validation script
3. **update-test-credentials.js** - Helper script to update HTML test files
4. **test-site-tenant1.html** - Browser test page for Tenant 1 (Acme Corporation)
5. **test-site-tenant2.html** - Browser test page for Tenant 2 (TechStart Inc)

## Quick Start

### Step 1: Run Automated Tests

```bash
# From the server directory
node tests/multi-tenant-test.js
```

This will:
- Register 2 test tenants
- Create websites and configure pages
- Test tracking, isolation, and security
- Output credentials for manual testing

**Expected output:**
```
✅ Passed: 7
❌ Failed: 0

📝 TENANT CREDENTIALS FOR MANUAL TESTING:

Tenant 1 (Acme Corporation):
  API Key: [copy-this-key]
  Website ID: [copy-this-id]

Tenant 2 (TechStart Inc):
  API Key: [copy-this-key]
  Website ID: [copy-this-id]
```

### Step 2: Update HTML Test Files

Copy the credentials from Step 1 and run:

```bash
node tests/update-test-credentials.js \
  <tenant1-api-key> <tenant1-website-id> \
  <tenant2-api-key> <tenant2-website-id>
```

**Example:**
```bash
node tests/update-test-credentials.js \
  abc123-def456 web-uuid-1 \
  xyz789-uvw012 web-uuid-2
```

### Step 3: Run API Validation

Validate all API endpoints using Tenant 1's credentials:

```bash
node tests/api-validation.js <tenant1-api-key> <tenant1-website-id>
```

**Expected:**
```
✅ Passed:   16
❌ Failed:   0
📈 Pass Rate: 100%
```

### Step 4: Manual Browser Testing

Open the HTML test files in your browser:

**Tenant 1 (Purple theme):**
```
file:///[full-path]/server/tests/test-site-tenant1.html
```

**Tenant 2 (Pink theme):**
```
file:///[full-path]/server/tests/test-site-tenant2.html
```

**Test actions:**
1. Click navigation buttons to track page views
2. Fill and submit the form
3. Check browser console for tracking confirmation
4. Verify events in CRM dashboard

## Test Coverage

### ✅ Automated Tests (multi-tenant-test.js)

- [x] Tenant registration (2 tenants)
- [x] Website creation
- [x] Page configuration with different points
- [x] Event tracking (page views)
- [x] Data isolation verification
- [x] Cross-tenant security
- [x] Configuration updates

### ✅ API Validation (api-validation.js)

- [x] List websites
- [x] Get website details
- [x] List pages
- [x] Create page
- [x] Update page
- [x] Delete page
- [x] Track page view event
- [x] Track form submission
- [x] List leads
- [x] Get lead details
- [x] Update lead
- [x] Get usage statistics
- [x] Get discovered pages
- [x] Get discovered CTAs
- [x] Invalid API key rejection
- [x] Missing API key rejection

### ✅ Manual Browser Tests

- [x] Page view tracking
- [x] Form submission tracking
- [x] Lead creation
- [x] Score calculation
- [x] Multi-tenant isolation
- [x] CRM dashboard verification

## Troubleshooting

### Server not running
```bash
cd server
npm run dev
```

### Redis connection failed
```bash
# Option 1: Disable Redis
# Set REDIS_ENABLED=false in .env

# Option 2: Start Redis
redis-server
```

### Tests failing with 401 errors
- Check that server is running on http://localhost:3000
- Verify API key is correct
- Ensure tenant is active in database

### HTML files not tracking
- Open browser DevTools > Console
- Check for JavaScript errors
- Verify API key and Website ID are updated in the HTML file
- Check Network tab for failed requests

## Clean Up Test Data

To remove test tenants and data:

```sql
-- Run in Supabase SQL Editor
DELETE FROM tenants
WHERE company_name IN ('Acme Corporation', 'TechStart Inc');
```

This will cascade delete all related data (websites, pages, leads, activities).

## CI/CD Integration

To run tests in a CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run automated tests
  run: |
    cd server
    npm install
    node tests/multi-tenant-test.js

- name: Run API validation
  run: |
    cd server
    node tests/api-validation.js ${{ secrets.TEST_API_KEY }} ${{ secrets.TEST_WEBSITE_ID }}
```

## Performance Benchmarks

Expected response times (p95):
- GET /leads: < 200ms
- POST /track: < 150ms
- GET /usage: < 100ms
- Page configuration queries: < 50ms (with Redis cache)

## Support

For detailed testing instructions, see: [../TESTING_GUIDE.md](../TESTING_GUIDE.md)

For issues, check:
1. Server logs
2. Browser console
3. Network tab in DevTools
4. Database query logs in Supabase

---

**Last Updated:** Phase 12 - Multi-Tenant Testing Complete
