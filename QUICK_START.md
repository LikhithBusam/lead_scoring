# ⚡ Quick Start Guide - Lead Scoring System

## 🚀 One-Minute Setup

### **Start All Services:**
```bash
# Terminal 1 - Backend API
npm run server

# Terminal 2 - Frontend Dashboard
npm run client

# Terminal 3 - Test Websites
cd test-websites && python -m http.server 8080
```

### **Open Your Browser:**
1. **Dashboard:** http://localhost:5173
2. **Test Website:** http://localhost:8080/saas-company/
3. **Backend API:** http://localhost:3001/api/health

---

## 🎯 Test the Complete Workflow (2 Minutes)

### **1. Login (10 seconds)**
- Go to dashboard: http://localhost:5173
- Click **"Connect CloudFlow"** button
- Dashboard loads with Lead Management section

### **2. Track a Visitor (30 seconds)**
- Open new tab: http://localhost:8080/saas-company/index.html
- Press F12 → Console tab
- Should see: `[LeadScorer] Lead Scorer initialized successfully`
- Navigate to Pricing page (click in menu)
- Should see: `[LeadScorer] Page view tracked`

**⚠️ Important:** Always use `.html` extension in URLs!
- ✅ Correct: http://localhost:8080/saas-company/index.html
- ❌ Wrong: http://localhost:8080/saas-company/

### **3. Create a Lead (40 seconds)**
- Click "Contact" in navigation
- Fill form:
  - Name: Test User
  - Email: test@example.com
  - Company: Acme Corp
- Click "Send Message"
- Console shows: `[LeadScorer] Form submission tracked`

### **4. See Lead in Dashboard (20 seconds)**
- Switch to dashboard tab
- Click Refresh button in Lead Management
- **Your lead appears!** 🎉
  - Name: Test User
  - Score: 26+ points
  - Classification: qualified

---

## 📊 What Was Fixed

### **Before Fix:**
- ❌ No Lead Management view
- ❌ Leads not displayed in frontend
- ❌ Wrong API response property name

### **After Fix:**
- ✅ Complete Lead Management table
- ✅ Score breakdown (Demographic/Behavioral/Negative)
- ✅ Classification badges (Hot/Warm/Qualified/Cold)
- ✅ Activity tracking visible
- ✅ Real-time updates

---

## 🔑 Demo Accounts

**CloudFlow (SaaS):**
```
API Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7
Website: http://localhost:8080/saas-company/
```

**TechGear (E-commerce):**
```
API Key: lsk_7912d8b2be8246cca164d342dc2b2fa1d30b2b58f1cb75aeddb2d914433cec43
Website: http://localhost:8080/ecommerce-store/
```

---

## 📈 How Scoring Works

### **Points Breakdown:**
- **Page Views:**
  - Home: 1 point
  - About: 2 points
  - Pricing: 10 points
  - Contact: 5 points
  - Demo: 15 points

- **Form Submission:** 25 points
- **Deduplication:** Same page within 5 min = no extra points

### **Classification:**
- 80+ points = **Hot** 🔥
- 60-79 points = **Warm** 🌤️
- 40-59 points = **Qualified** ✅
- 0-39 points = **Cold** ❄️

---

## 🐛 Quick Troubleshooting

### **Lead not showing?**
```bash
# Check backend logs
# Should see: "✅ Score recalculated for lead XXX"

# Test API directly
curl -H "X-API-Key: lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7" \
  http://localhost:3001/api/v1/leads
```

### **Tracking not working?**
```bash
# Verify tracking plugin loads
curl http://localhost:3001/tracking-plugin/lead-scorer.js | head -5
```

### **Dashboard shows "No leads yet"?**
1. Clear browser cache (Ctrl+Shift+Del)
2. Hard refresh (Ctrl+Shift+R)
3. Submit a form on test website with email
4. Click Refresh button in dashboard

---

## 📁 Important Files

**Frontend:**
- `src/components/AdminDashboard.jsx` - Main dashboard (UPDATED ✅)
- `src/components/CompanySelector.jsx` - Login screen

**Backend:**
- `server/routes/tracking.js` - Tracking event handler
- `server/routes/tenantLeads.js` - Lead API endpoints
- `server/utils/multiTenantScoring.js` - Score calculation

**Tracking:**
- `tracking-plugin/lead-scorer.js` - Universal tracking script
- Test websites already have it installed!

---

## 🎓 Learn More

**Detailed Guides:**
- `WORKFLOW_FIX_GUIDE.md` - Complete workflow documentation
- `TESTING_INSTRUCTIONS.md` - Step-by-step testing guide
- `README.md` - Project overview

**API Documentation:**
- Health Check: http://localhost:3001/api/health
- Get Leads: `GET /api/v1/leads` (requires API key)
- Track Event: `POST /api/v1/track` (requires API key)

---

## ✅ Success Criteria

You know everything is working when:
- ✅ Dashboard loads without errors
- ✅ Lead Management table is visible
- ✅ Console shows tracking initialization
- ✅ Page views tracked in Network tab
- ✅ Form submission creates lead
- ✅ Lead appears in dashboard with score
- ✅ Score increases with more activity

---

## 🚀 Next Steps

1. **Test with demo websites** (covered above)
2. **Create your own website** with tracking script
3. **Configure custom pages** with different point values
4. **Review discovered pages** and approve them
5. **Monitor lead scores** as they accumulate

---

**Need Help?** Check `TESTING_INSTRUCTIONS.md` for detailed troubleshooting!

**Everything Working?** You're ready to use the system! 🎉
