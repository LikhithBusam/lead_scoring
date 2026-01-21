# 🧪 Complete Testing Guide - Lead Scoring CRM

## Problem Summary
Login/Signup data not showing in Company Lead Management Dashboard

## Quick Diagnosis Steps

### Step 1: Test Backend Connection
```bash
# Terminal 1 - Check if backend is running
curl http://localhost:3001/api/v1/health

# Expected: Should return 200 OK or 404 (means server is running)
```

### Step 2: Open Debug Test Page
```
http://localhost:8080/DEBUG_TEST.html
```

**Actions:**
1. Open browser console (F12)
2. Click "Submit Test" button
3. Check console for:
   - ✅ `LeadScorer exists: true`
   - ✅ `API Response: {success: true}`
4. Check results div - should show SUCCESS

### Step 3: Verify Data in Database

**Open Supabase Dashboard > SQL Editor > Run:**

```sql
-- Check if lead was created
SELECT * FROM leads
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check if contact was created
SELECT * FROM contacts
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check lead activities
SELECT * FROM lead_activities
WHERE activity_timestamp > NOW() - INTERVAL '1 hour'
ORDER BY activity_timestamp DESC
LIMIT 10;
```

### Step 4: Test Actual Login Page

**URL:** http://localhost:8080/saas-company/login.html

**Actions:**
1. Open browser console (F12)
2. Fill login form:
   - Email: test@company.com
   - Password: anything
3. Click "Login"
4. Check console logs for:
   - `🔐 LOGIN ATTEMPT: test@company.com`
   - `✅ Login tracked to API:`
   - Look for the API response

### Step 5: Check Company Dashboard

**URL:** http://localhost:5174 (or 5173)

**Actions:**
1. Enter API Key: `lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7`
2. Go to "Leads" tab
3. You should see the lead from test@company.com

---

## Common Issues & Fixes

### Issue 1: Backend Not Running
**Symptom:** Console shows `ERR_CONNECTION_REFUSED`

**Fix:**
```bash
# Kill old process
tasklist | findstr node
taskkill //F //PID <PID_NUMBER>

# Restart
npm run dev
```

### Issue 2: Tracking Script 404
**Symptom:** Console shows `404 lead-scorer.js not found`

**Fix:**
- Backend must serve tracking-plugin folder
- Check server/index.js has static file serving

### Issue 3: CORS Error
**Symptom:** Console shows `CORS policy blocked`

**Fix:**
- Backend should have CORS enabled
- Check server/index.js for `cors()` middleware

### Issue 4: Wrong API Key/Website ID
**Symptom:** Console shows `401 Unauthorized` or `Invalid API Key`

**Fix:**
- Verify website_id and apiKey in tracking script
- Run: `node server/tests/setup-demo-companies.js`
- Use credentials from DEMO_CREDENTIALS.json

### Issue 5: Data in DB but Not in Dashboard
**Symptom:** SQL query shows data, but dashboard empty

**Fix:**
- Check browser console for JavaScript errors
- Check Network tab for failed API calls
- Verify API key in dashboard matches tenant
- Check if RLS migration was run (07_add_tenant_id_to_core_tables.sql)

---

## Verification Checklist

- [ ] Backend running on port 3001
- [ ] Frontend running on port 5173/5174
- [ ] Test website server on port 8080
- [ ] Tracking script loads without 404
- [ ] DEBUG_TEST.html shows SUCCESS
- [ ] Login form submission logs to console
- [ ] Lead created in database (SQL check)
- [ ] Lead visible in Company Dashboard

---

## If Still Not Working

### Get Full Diagnostic Info:

1. **Browser Console Log:**
   - Copy all console output during login
   - Include any errors (red text)

2. **Network Tab:**
   - Open DevTools > Network
   - Submit login form
   - Find POST request to `/api/v1/track`
   - Copy Request Headers and Response

3. **Database Check:**
   ```sql
   -- Get latest activity
   SELECT
       la.*,
       l.lead_id,
       c.email,
       c.first_name
   FROM lead_activities la
   LEFT JOIN leads l ON la.lead_id = l.lead_id
   LEFT JOIN contacts c ON l.contact_id = c.contact_id
   WHERE la.activity_timestamp > NOW() - INTERVAL '2 hours'
   ORDER BY la.activity_timestamp DESC
   LIMIT 10;
   ```

4. **Backend Logs:**
   - Check terminal where `npm run dev` is running
   - Look for tracking endpoint hits
   - Copy any error messages

---

## Expected Flow

```
USER LOGIN
    ↓
login.html → handleLogin(event)
    ↓
fetch POST /api/v1/track
    Headers: X-API-Key, X-Website-Id
    Body: { event_type: 'form_submission', visitor_id, data: { email } }
    ↓
Backend: server/routes/tracking.js → handleFormSubmission()
    ↓
Database:
    1. Insert lead_activity (form_submission)
    2. Create/find contact (by email)
    3. Create lead (if new)
    4. Link activities to contact
    5. Calculate lead score
    ↓
Response: { success: true, lead_id, contact_id }
    ↓
Company Dashboard: GET /api/v1/leads
    Headers: X-Tenant-Id (from API key)
    ↓
Display leads in dashboard
```

---

## Quick Test Command

```bash
# Test tracking endpoint directly
curl -X POST http://localhost:3001/api/v1/track \
  -H "Content-Type: application/json" \
  -H "X-API-Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7" \
  -H "X-Website-Id: e64d878d-d04f-438f-965f-6beba2d225a7" \
  -d '{
    "event_type": "form_submission",
    "visitor_id": "test_visitor_123",
    "data": {
      "email": "curl-test@example.com",
      "name": "Curl Test User",
      "company": "Test Company",
      "page_url": "/login"
    }
  }'

# Expected response:
# {"success":true,"event_type":"form_submission","tracked":true,"lead_created":true,"contact_id":...}
```

If this curl command works, backend is fine - issue is in frontend!
