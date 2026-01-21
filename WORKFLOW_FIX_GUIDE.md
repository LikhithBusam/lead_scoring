# Lead Scoring Multi-Tenant Workflow - Fixed Issues

## 🔍 Problems Identified & Fixed

### **Issue #1: Frontend API Response Mismatch** ✅ FIXED
**Location:** `src/components/AdminDashboard.jsx:86`

**Problem:** The frontend was expecting `discoveredPages` (camelCase) but backend returns `discovered_pages` (snake_case).

**Fix Applied:**
```javascript
// Before (WRONG):
setDiscoveredPages(data.discoveredPages || [])

// After (CORRECT):
setDiscoveredPages(data.discovered_pages || [])
```

---

### **Issue #2: Missing Lead Management View** ✅ FIXED
**Location:** `src/components/AdminDashboard.jsx`

**Problem:** The AdminDashboard component had NO functionality to:
- Fetch leads from the backend
- Display lead list
- Show lead scores
- Show lead activities

**Fix Applied:**
1. Added `leads` state variable
2. Added `fetchLeads()` function to call `/api/v1/leads` endpoint
3. Added comprehensive Lead Management table with:
   - Name, Email, Company columns
   - Score breakdown (Demographic, Behavioral, Negative)
   - Classification badges (hot/warm/qualified/cold)
   - Activity count
   - Last activity date
4. Auto-fetches leads on component mount

---

### **Issue #3: Tracking Script Must Be Installed** ⚠️ CRITICAL

**The JavaScript tracking plugin MUST be installed on your client websites for ANY tracking to work!**

#### How the Tracking Works:

1. **Company adds website in dashboard** → Receives installation script
2. **Installation script** must be pasted in `<head>` tag of EVERY page on the client website
3. **Tracking plugin** (`lead-scorer.js`) then:
   - Creates unique visitor ID (fingerprinting)
   - Tracks page views automatically
   - Fetches configured CTAs from backend
   - Attaches click listeners to CTAs
   - Tracks form submissions
   - Sends all events to backend

**Without the script installed, NOTHING will be tracked!**

---

## ✅ Complete Workflow (As Designed)

### **Step 1: Company Login**
Company logs into the CRM dashboard using their API key.

**Files Involved:**
- `src/components/CompanySelector.jsx` - Login screen
- `src/components/AdminDashboard.jsx` - Main dashboard

---

### **Step 2: Add Website**
Company adds their website to the system.

**API Endpoint:** `POST /api/v1/websites`
**Files:** `server/routes/tenantManagement.js:411`

**What Happens:**
1. Generates unique tracking code
2. Creates website record in database
3. Auto-creates 5 default pages:
   - `/` - Home (1 point)
   - `/about` - About Us (2 points)
   - `/pricing` - Pricing (10 points)
   - `/contact` - Contact (5 points)
   - `/demo` - Request Demo (15 points)
4. Returns installation script

---

### **Step 3: Install Tracking Script**
Company copies the installation script and pastes it in their website's `<head>` tag.

**Installation Script Format:**
```html
<script>
  window.LEAD_SCORER_CONFIG = {
    websiteId: "{WEBSITE_ID}",
    apiKey: "{API_KEY}",
    apiUrl: "http://localhost:3001/api/v1"
  };
</script>
<script src="http://localhost:3001/tracking-plugin/lead-scorer.js"></script>
```

**What This Does:**
- Loads the tracking plugin (`tracking-plugin/lead-scorer.js`)
- Initializes with website ID and API key
- Starts tracking immediately on page load

---

### **Step 4: User Visits Website**
When a user visits the client's website with the tracking script installed:

**File:** `tracking-plugin/lead-scorer.js`

**Automatic Actions:**
1. **Visitor Identification** (Step 23 in code)
   - Checks for existing visitor ID in cookies
   - If not found, generates browser fingerprint
   - Creates unique visitor ID
   - Stores in cookie for 365 days

2. **Session Creation**
   - Generates session ID for this visit
   - Tracks session across page navigation

3. **Initial Page View**
   - Immediately sends page view event
   - Includes: URL, title, referrer, timestamp

4. **CTA Configuration Fetch** (Step 25)
   - Calls `GET /api/v1/websites/{id}/ctas`
   - Fetches all configured CTAs for this website
   - Attaches click listeners to matching elements

---

### **Step 5: User Performs Actions**

#### **5A. Page View Tracking** (Step 24)
**Trigger:** User navigates to any page
**File:** `tracking-plugin/lead-scorer.js:164`

**Sent to Backend:**
```javascript
{
  event_type: "page_view",
  visitor_id: "v_xxx",
  session_id: "sess_xxx",
  data: {
    page_url: "/pricing",
    page_title: "Pricing - Company Name",
    referrer: "direct",
    timestamp: "2025-01-17T10:30:00Z"
  }
}
```

**Backend Handler:** `server/routes/tracking.js:81` (`handlePageView`)
1. Checks if page is configured for tracking
2. If not configured, adds to `discovered_pages` table
3. If configured, checks deduplication (5-minute window)
4. Inserts activity record with points earned
5. Returns success response

---

#### **5B. CTA Interaction** (Step 27)
**Trigger:** User clicks configured button/link
**File:** `tracking-plugin/lead-scorer.js:254`

**Sent to Backend:**
```javascript
{
  event_type: "cta_interaction",
  visitor_id: "v_xxx",
  session_id: "sess_xxx",
  data: {
    cta_id: 123,
    cta_name: "Request Demo Button",
    cta_type: "button",
    page_url: "/pricing",
    points: 15
  }
}
```

**Backend Handler:** `server/routes/tracking.js:184` (`handleCTAInteraction`)
1. Validates CTA exists and is active
2. Checks deduplication (30-minute window)
3. Inserts activity record with CTA points
4. Returns success response

---

#### **5C. Form Submission** (Step 28)
**Trigger:** User submits form with email
**File:** `tracking-plugin/lead-scorer.js:297`

**Sent to Backend:**
```javascript
{
  event_type: "form_submission",
  visitor_id: "v_xxx",
  session_id: "sess_xxx",
  data: {
    email: "john@company.com",
    name: "John Doe",
    company: "Acme Corp",
    phone: "+1234567890",
    page_url: "/contact"
  }
}
```

**Backend Handler:** `server/routes/tracking.js:288` (`handleFormSubmission`)
1. Always tracks (NO deduplication)
2. Inserts activity record (25 points)
3. **LEAD CREATION LOGIC:**
   - If email exists → Links activities to existing contact/lead
   - If NEW email → Creates:
     - New contact record
     - New company record (if company name provided)
     - New lead record
     - Links ALL previous visitor activities to this lead
4. Triggers score calculation
5. Returns lead ID and success

---

### **Step 6: Lead Score Calculation**
**File:** `server/utils/multiTenantScoring.js`

**Triggered By:**
- Form submission (creates new lead)
- Manual recalculation

**Calculation Process:**
1. **Fetches System Scoring Rules** (Line 28)
   - Demographic rules (from `system_scoring_rules` table)
   - Negative rules (from `system_scoring_rules` table)
   - Cached in Redis for 10 minutes

2. **Demographic Scoring** (Line 102)
   - Evaluates company size, industry, job title, etc.
   - Max: 50 points

3. **Behavioral Scoring** (Line 119)
   - Fetches ALL activities for this lead
   - Gets points from `tenant_pages` and `tenant_ctas` tables
   - Cached in Redis for performance
   - Max: 100 points

4. **Negative Scoring** (Line 186)
   - Deducts points for inactive leads, invalid emails, etc.

5. **Total Score** (Line 200)
   ```
   Total = max(0, Demographic + Behavioral + Negative)
   ```

6. **Classification** (Line 308)
   - 80+: Hot
   - 60-79: Warm
   - 40-59: Qualified
   - 0-39: Cold

7. **Save to Database** (Line 318)
   - Upserts `lead_scores` table
   - Inserts into `score_history` table

---

### **Step 7: Leads Display in Dashboard**
**File:** `src/components/AdminDashboard.jsx` (NEWLY ADDED)

**API Endpoint:** `GET /api/v1/leads`
**Backend:** `server/routes/tenantLeads.js:24`

**What Happens:**
1. Frontend calls `/api/v1/leads` with API key
2. Backend:
   - Filters leads by `tenant_id` (RLS applied)
   - Joins with contacts, companies, scores tables
   - Returns transformed lead data
3. Frontend displays:
   - Lead name, email, company
   - Total score + breakdown (D/B/N)
   - Classification badge
   - Activity count
   - Last activity date

---

## 🧪 Testing the Complete Workflow

### **Test Scenario: Track a Lead from Demo Website**

#### Prerequisites:
1. Server running: `npm run server` (port 3001)
2. Client running: `npm run client` (port 5173)

#### Step-by-Step Test:

1. **Login to Dashboard**
   - Go to `http://localhost:5173`
   - Click "Connect CloudFlow" (demo account)
   - API Key: `lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7`

2. **Verify Website Configuration**
   - Check "Websites" panel
   - Select a website
   - Go to "Configured Pages" tab
   - Verify pages exist (Home, Pricing, Contact, etc.)

3. **Check Installation Script**
   - Go to "Install Script" tab
   - Copy the script code
   - **CRITICAL:** This script MUST be installed on your demo website

4. **Create Demo HTML Page**
   Create `test-websites/demo-site/index.html`:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Demo Site - Home</title>
     <!-- PASTE INSTALLATION SCRIPT HERE -->
     <script>
       window.LEAD_SCORER_CONFIG = {
         websiteId: "{YOUR_WEBSITE_ID}",
         apiKey: "{YOUR_API_KEY}",
         apiUrl: "http://localhost:3001/api/v1"
       };
     </script>
     <script src="http://localhost:3001/tracking-plugin/lead-scorer.js"></script>
   </head>
   <body>
     <h1>Welcome to Demo Site</h1>
     <a href="/pricing">View Pricing</a>
     <button id="demo-cta">Request Demo</button>

     <form id="contact-form">
       <input name="name" placeholder="Name" required>
       <input name="email" type="email" placeholder="Email" required>
       <input name="company" placeholder="Company">
       <button type="submit">Submit</button>
     </form>
   </body>
   </html>
   ```

5. **Test Page View Tracking**
   - Open the demo HTML file
   - Open browser DevTools → Network tab
   - Look for POST to `/api/v1/track`
   - Verify request payload contains `event_type: "page_view"`

6. **Test Form Submission**
   - Fill out the contact form
   - Submit with email: `test@example.com`
   - Check Network tab for form submission event
   - **Lead should be created now!**

7. **Verify Lead in Dashboard**
   - Refresh the dashboard
   - Check "Lead Management" section
   - You should see the new lead:
     - Name: from form
     - Email: test@example.com
     - Score: 25+ (form submission + page views)
     - Classification: cold/qualified

8. **Test Score Calculation**
   - Check the score breakdown:
     - Demographic: 0 (no company data)
     - Behavioral: 25+ (form + page views)
     - Negative: 0
   - Visit more pages to increase behavioral score
   - Submit another form to see score update

---

## 🐛 Troubleshooting

### **Problem: No leads showing in dashboard**

**Possible Causes:**
1. ❌ Tracking script not installed on client website
   - **Fix:** Copy installation script from dashboard and paste in `<head>` tag

2. ❌ Wrong API key or website ID in script
   - **Fix:** Verify values match those in dashboard

3. ❌ CORS issues blocking API calls
   - **Fix:** Check browser console for CORS errors
   - Verify `cors_origins` includes your website URL

4. ❌ Form submission didn't include email
   - **Fix:** Forms MUST have an `email` field to create leads

5. ❌ Backend not running
   - **Fix:** Run `npm run server` and check port 3001

### **Problem: Discovered pages not showing**

**Cause:** Frontend was using wrong response property (FIXED)

**Verification:**
- Check Network tab → `/api/v1/websites/{id}/discovered-pages`
- Response should have `discovered_pages` array
- Frontend now correctly reads `data.discovered_pages`

### **Problem: Scores not updating**

**Possible Causes:**
1. ❌ Activities not linked to lead
   - **Fix:** Ensure form submission includes email

2. ❌ Pages not configured for scoring
   - **Fix:** Add pages in "Configured Pages" or approve from "Discovered Pages"

3. ❌ Score calculation not triggered
   - **Fix:** Check backend logs for scoring errors

---

## 📊 Database Tables Explained

### **Core Tables**
- `tenants` - Companies using the CRM
- `users` - Login users (linked to tenants)
- `tenant_websites` - Websites tracked per tenant
- `tenant_pages` - Page configurations with point values
- `tenant_ctas` - CTA configurations with point values

### **Tracking Tables**
- `contacts` - Contact information (email, name, etc.)
- `companies` - Company information
- `leads` - Lead records (links contacts to companies)
- `lead_activities` - All tracked activities (page views, CTA clicks, forms)
- `lead_scores` - Current lead scores
- `score_history` - Historical score changes

### **Scoring Rules**
- `system_scoring_rules` - Global demographic & negative rules
- Behavioral rules come from `tenant_pages` and `tenant_ctas`

---

## 🚀 Next Steps

1. **Test the fixes:**
   - Restart your server
   - Refresh the dashboard
   - Verify Lead Management section appears
   - Test form submission workflow

2. **Install tracking script:**
   - Copy script from dashboard
   - Paste in your demo website's `<head>` tag
   - Test visitor tracking

3. **Configure pages:**
   - Review auto-created default pages
   - Adjust point values as needed
   - Approve discovered pages

4. **Monitor leads:**
   - Check Lead Management regularly
   - Review score breakdowns
   - Verify activities are being tracked

---

## 📝 Summary of Changes

### Files Modified:
1. ✅ `src/components/AdminDashboard.jsx`
   - Fixed `discoveredPages` → `discovered_pages`
   - Added `leads` state
   - Added `fetchLeads()` function
   - Added comprehensive Lead Management table

### No Backend Changes Required:
- All backend endpoints were working correctly
- Issue was purely frontend missing lead display functionality

---

## ⚡ Quick Reference

**Company Dashboard:** `http://localhost:5173`
**Backend API:** `http://localhost:3001/api/v1`
**Tracking Plugin:** `http://localhost:3001/tracking-plugin/lead-scorer.js`

**Key API Endpoints:**
- `GET /api/v1/leads` - Fetch all leads
- `POST /api/v1/track` - Track events
- `GET /api/v1/websites/{id}/pages` - Get configured pages
- `GET /api/v1/websites/{id}/discovered-pages` - Get discovered pages

**Demo API Keys:**
- CloudFlow: `lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7`
- TechGear: `lsk_7912d8b2be8246cca164d342dc2b2fa1d30b2b58f1cb75aeddb2d914433cec43`

---

## ✅ Checklist

- [x] Fixed `discovered_pages` response mismatch
- [x] Added Lead Management view to dashboard
- [x] Added lead fetching functionality
- [x] Added score breakdown display
- [x] Added classification badges
- [x] Documented complete workflow
- [x] Created troubleshooting guide

---

**Last Updated:** 2026-01-17
**Version:** 1.0 (Post-Fix)
