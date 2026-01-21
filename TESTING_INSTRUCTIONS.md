# 🧪 Complete Testing Instructions

## ✅ Current Status

**All servers are running:**
- ✅ Backend API: `http://localhost:3001` (Healthy)
- ✅ Frontend Dashboard: `http://localhost:5173`
- ✅ Test Websites: `http://localhost:8080`

**Test Websites Available:**
1. **CloudFlow SaaS** - `http://localhost:8080/saas-company/`
   - API Key: `lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7`
   - Website ID: `e64d878d-d04f-438f-965f-6beba2d225a7`
   - ✅ Tracking script already installed

2. **TechGear E-commerce** - `http://localhost:8080/ecommerce-store/`
   - API Key: `lsk_7912d8b2be8246cca164d342dc2b2fa1d30b2b58f1cb75aeddb2d914433cec43`

---

## 🎯 Complete End-to-End Test

### **Step 1: Open Dashboard**
1. Open browser: `http://localhost:5173`
2. Click **"Connect CloudFlow"** button (uses demo API key automatically)
3. You should see the **AdminDashboard** load

### **Step 2: Verify Dashboard Shows Fixed Components**
Check that you can see:
- ✅ **Lead Management Section** (NEW - just added!)
- ✅ Tenant Profile
- ✅ Websites panel
- ✅ Page Configuration
- ✅ Discovered Pages

**If Lead Management is missing:**
- Clear browser cache and refresh
- Check browser console for errors

### **Step 3: Open Test Website in New Tab**
1. Open new tab: `http://localhost:8080/saas-company/`
2. Open **DevTools** (F12)
3. Go to **Console** tab

**What You Should See in Console:**
```
[LeadScorer] Initializing Lead Scorer... {websiteId: "e64d878d...", apiKey: "lsk_5d9ff8f0...", ...}
[LeadScorer] Page view tracked {page_url: "/", page_title: "CloudFlow SaaS", ...}
[LeadScorer] Fetched 0 configured CTAs
[LeadScorer] Lead Scorer initialized successfully {visitorId: "v_...", sessionId: "sess_..."}
```

**If you see errors:**
- Check Network tab for failed requests
- Verify backend is running: `http://localhost:3001/api/health`

### **Step 4: Test Page View Tracking**
1. In test website, click **"Pricing"** in navigation
2. **Console should log:** `[LeadScorer] Page view tracked {page_url: "/pricing.html"...}`
3. In **Network** tab, look for:
   - POST to `http://localhost:3001/api/v1/track`
   - Status: 200 OK
   - Response: `{success: true, tracked: true, points_earned: 10, ...}`

4. Go back to **Dashboard** tab
5. Click **"Discovered Pages"** tab in page configuration
6. **You should see:** `/pricing.html` or `/pricing` in discovered pages!

### **Step 5: Test Form Submission (Creates Lead)**
1. Go to test website: `http://localhost:8080/saas-company/contact.html`
2. Fill out the contact form:
   - **Name:** John Doe
   - **Email:** `test-lead-${Date.now()}@example.com` (use unique email)
   - **Company:** Acme Corp
   - **Message:** Testing lead tracking
3. Click **"Send Message"**

**What Should Happen:**
- Console logs: `[LeadScorer] Form submission tracked`
- Network tab shows POST with `event_type: "form_submission"`
- Response includes: `{lead_created: true, lead_id: xxx, newScore: 26+}`

### **Step 6: Verify Lead Appears in Dashboard**
1. Go back to **Dashboard** tab
2. Click the **Refresh** button in Lead Management section
3. **You should now see your lead:**
   - Name: John Doe
   - Email: test-lead-...@example.com
   - Company: Acme Corp
   - Score: 26+ (25 for form + page views)
   - Classification: cold/qualified
   - Activities: 2+ (form submission + page views)

**If lead doesn't appear:**
- Check browser console in dashboard for errors
- Verify API endpoint: Open DevTools → Network → Look for `/api/v1/leads`
- Check response - should have `success: true, leads: [...]`

### **Step 7: Test Score Accumulation**
1. Go back to test website
2. Visit multiple pages:
   - Home → Pricing → Features → Contact → Pricing again
3. Submit another form (use same email or different)
4. Refresh dashboard
5. **Lead score should increase** based on:
   - Page views (deduplication: same page within 5 min = no points)
   - Form submission (+25 points each time)

---

## 📊 Expected Scores Breakdown

### **For CloudFlow Website:**

**Default Page Points:**
- `/` (Home): 1 point
- `/about`: 2 points
- `/pricing`: 10 points
- `/contact`: 5 points
- `/demo`: 15 points

**Form Submission:** 25 points

**Example Scenario:**
1. User visits Home (1 pt)
2. User visits Pricing (10 pt)
3. User submits contact form (25 pt)
4. **Total:** 36 points → **"Qualified"** classification

---

## 🔍 Troubleshooting

### **Issue: "No leads yet" showing in dashboard**

**Possible Causes:**
1. ❌ Form submission didn't include email field
2. ❌ Backend not running
3. ❌ CORS blocking requests
4. ❌ API key mismatch

**Debug Steps:**
```bash
# 1. Check if backend received the tracking event
# Look at terminal where you ran `npm run server`
# Should see: "✅ Score recalculated for lead XXX: 26 (qualified)"

# 2. Check database directly (if using Supabase)
# Go to Supabase Dashboard → Table Editor → leads
# Should see new lead entry

# 3. Test API endpoint directly
curl -H "X-API-Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7" \
  http://localhost:3001/api/v1/leads
```

### **Issue: Tracking script not loading**

**Symptoms:**
- Console shows: `Failed to load resource: net::ERR_CONNECTION_REFUSED`
- Or: `lead-scorer.js 404 Not Found`

**Fix:**
```bash
# 1. Verify backend is serving tracking plugin
curl http://localhost:3001/tracking-plugin/lead-scorer.js | head -20

# Should return JavaScript code starting with:
# /**
#  * Lead Scorer - Universal Multi-Tenant Tracking Plugin

# 2. If not found, restart backend server
npm run server
```

### **Issue: "discovered_pages is undefined" error**

**Symptoms:**
- Console error in dashboard
- Discovered Pages tab shows error

**This was the bug we fixed!** If you still see this:
1. Clear browser cache completely
2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Verify `AdminDashboard.jsx` line 86 shows: `data.discovered_pages`

### **Issue: Lead shows score of 0**

**Causes:**
1. ❌ Pages not configured (check Configured Pages tab)
2. ❌ Activities not linked to lead
3. ❌ Scoring calculation failed

**Fix:**
```bash
# Force recalculate score
curl -X POST \
  -H "X-API-Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7" \
  http://localhost:3001/api/recalculate-score/{LEAD_ID}
```

---

## 🎬 Quick Video Demo Script

**If recording a demo:**

1. **"Dashboard View"** (15 sec)
   - Show Lead Management table
   - Point out Score breakdown (D/B/N)
   - Show classification badges

2. **"Website Tracking"** (30 sec)
   - Open test website in new tab
   - Show browser console with tracking logs
   - Navigate to Pricing page
   - Show Network request to `/track` endpoint

3. **"Lead Creation"** (30 sec)
   - Fill out contact form
   - Submit form
   - Show console log "Form submission tracked"
   - Show response with `lead_created: true`

4. **"Lead Appears"** (15 sec)
   - Switch to dashboard tab
   - Click Refresh button
   - **Show new lead appearing in table!**
   - Point out score and classification

5. **"Score Increases"** (20 sec)
   - Go back to website
   - Visit more pages
   - Submit another form
   - Refresh dashboard
   - **Show score increased!**

**Total:** ~2 minutes

---

## 🚀 Production Deployment Notes

When deploying to production:

### **1. Update API URLs**
Replace `http://localhost:3001` with your production domain:
```javascript
// In tracking script configuration:
apiUrl: "https://api.yourcrm.com/api/v1"

// In tracking plugin src:
<script src="https://api.yourcrm.com/tracking-plugin/lead-scorer.js"></script>
```

### **2. Set CORS Origins**
In `server/index.js`:
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://yourcrm.com',
    'https://client-website.com'
  ],
  credentials: true
}));
```

### **3. Update Website Records**
For each client website in `tenant_websites` table:
```javascript
cors_origins: ['https://client-website.com', 'https://www.client-website.com']
```

### **4. Enable HTTPS**
- Tracking script won't work from HTTP to HTTPS (mixed content)
- Both dashboard and tracking endpoint must use HTTPS

### **5. Environment Variables**
```env
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
ALLOWED_ORIGINS=https://yourcrm.com,https://client.com
```

---

## ✅ Success Checklist

- [ ] Backend server running on port 3001
- [ ] Frontend dashboard accessible at localhost:5173
- [ ] Test website served on port 8080
- [ ] Lead Management section visible in dashboard
- [ ] Console shows tracking initialization logs
- [ ] Page view events tracked successfully
- [ ] Form submission creates lead
- [ ] Lead appears in dashboard with correct score
- [ ] Score breakdown shows (D/B/N)
- [ ] Classification badge displays correctly
- [ ] Multiple page views increase score
- [ ] Discovered pages populate correctly

---

## 📞 Support

**If you encounter issues not covered here:**

1. **Check backend logs:** Terminal running `npm run server`
2. **Check browser console:** F12 → Console tab
3. **Check network requests:** F12 → Network tab → Filter: `track`
4. **Verify database:** Supabase Dashboard → Table Editor
5. **Review code:** See `WORKFLOW_FIX_GUIDE.md` for detailed architecture

**Common Commands:**
```bash
# Restart backend
npm run server

# Restart frontend
npm run client

# Start test website server
cd test-websites && python -m http.server 8080

# Check API health
curl http://localhost:3001/api/health

# Test tracking endpoint
curl -X POST http://localhost:3001/api/v1/track \
  -H "Content-Type: application/json" \
  -H "X-API-Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7" \
  -H "X-Website-Id: e64d878d-d04f-438f-965f-6beba2d225a7" \
  -d '{"event_type":"page_view","visitor_id":"test123","data":{"page_url":"/test"}}'
```

---

**Last Updated:** 2026-01-17
**Version:** 1.0 (Post-Fix)
**Status:** ✅ All fixes applied and tested
