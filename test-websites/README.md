# Test Websites for Lead Scoring CRM

Two complete static websites for manually testing your multi-tenant Lead Scoring CRM system.

---

## 📁 Folder Structure

```
test-websites/
├── saas-company/              # Website 1: B2B SaaS Company
│   ├── index.html            # Home page
│   ├── features.html         # Features page
│   ├── pricing.html          # Pricing page
│   ├── contact.html          # Contact page
│   ├── styles.css            # Stylesheet
│   └── script.js             # JavaScript with click tracking
│
├── ecommerce-store/          # Website 2: E-commerce Store
│   ├── index.html            # Home page
│   ├── products.html         # Product listing
│   ├── product1.html         # Product detail page
│   ├── cart.html             # Shopping cart
│   ├── styles.css            # Stylesheet
│   └── script.js             # JavaScript with click tracking
│
└── README.md                 # This file
```

---

## 🚀 How to Use

### Step 1: Register Two Companies in Your CRM

Open a terminal and create two test companies:

**Company 1: CloudFlow SaaS**
```bash
curl -X POST http://localhost:3001/api/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d '{"company_name":"CloudFlow SaaS","domain":"cloudflow.com","plan_type":"pro"}'
```

**Company 2: TechGear Store**
```bash
curl -X POST http://localhost:3001/api/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d '{"company_name":"TechGear Store","domain":"techgear.com","plan_type":"pro"}'
```

**Save the API keys from both responses!**

---

### Step 2: Add Websites for Each Company

**Add CloudFlow SaaS Website:**
```bash
curl -X POST http://localhost:3001/api/v1/websites \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_CLOUDFLOW_API_KEY" \
  -d '{"website_url":"http://localhost/cloudflow","website_name":"CloudFlow Website"}'
```

**Add TechGear Store Website:**
```bash
curl -X POST http://localhost:3001/api/v1/websites \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_TECHGEAR_API_KEY" \
  -d '{"website_url":"http://localhost/techgear","website_name":"TechGear Website"}'
```

**Save the website IDs from both responses!**

---

### Step 3: Install Tracking Script

#### For Website 1 (CloudFlow SaaS):

1. Open `test-websites/saas-company/index.html` in a text editor
2. Find the comment `<!-- PASTE YOUR LEAD SCORING TRACKING SCRIPT HERE -->`
3. Replace it with:

```html
<script>
  window.LEAD_SCORER_CONFIG = {
    websiteId: "YOUR_CLOUDFLOW_WEBSITE_ID",
    apiKey: "YOUR_CLOUDFLOW_API_KEY",
    apiUrl: "http://localhost:3001/api/v1"
  };
</script>
<script src="http://localhost:3001/tracking-plugin/lead-scorer.js"></script>
```

4. Copy the same tracking script to:
   - `features.html`
   - `pricing.html`
   - `contact.html`

#### For Website 2 (TechGear Store):

1. Open `test-websites/ecommerce-store/index.html` in a text editor
2. Find the comment `<!-- PASTE YOUR LEAD SCORING TRACKING SCRIPT HERE -->`
3. Replace it with:

```html
<script>
  window.LEAD_SCORER_CONFIG = {
    websiteId: "YOUR_TECHGEAR_WEBSITE_ID",
    apiKey: "YOUR_TECHGEAR_API_KEY",
    apiUrl: "http://localhost:3001/api/v1"
  };
</script>
<script src="http://localhost:3001/tracking-plugin/lead-scorer.js"></script>
```

4. Copy the same tracking script to:
   - `products.html`
   - `product1.html`
   - `cart.html`

---

### Step 4: Open Websites in Browser

**Website 1 - CloudFlow SaaS:**
- Double-click: `test-websites/saas-company/index.html`
- Or use: `file:///C:/Users/Likith/OneDrive/Desktop/lead_scoring/test-websites/saas-company/index.html`

**Website 2 - TechGear Store:**
- Double-click: `test-websites/ecommerce-store/index.html`
- Or use: `file:///C:/Users/Likith/OneDrive/Desktop/lead_scoring/test-websites/ecommerce-store/index.html`

---

## 🧪 Testing Scenarios

### Test 1: Default Pages Auto-Creation

**Expected:**
- After adding websites, check your CRM
- Both websites should have 5 default pages:
  - `/` (Home)
  - `/about`
  - `/pricing`
  - `/contact`
  - `/demo`

**Verify:** Login to http://localhost:5173 and check the pages list for each company.

---

### Test 2: Smart Page Discovery

**CloudFlow SaaS:**
1. Open the website in browser
2. Navigate to **Features** page (not in default template)
3. Wait 5 seconds
4. Check your CRM for discovered pages
5. You should see `/features.html` as "pending review"

**TechGear Store:**
1. Open the website
2. Navigate to **Products** page (not in default)
3. Click on any product (goes to `/product1.html`)
4. Check CRM for discovered pages
5. You should see `/products.html` and `/product1.html` as "pending review"

**Expected Behavior:**
- Pages auto-discovered when visitors access them
- Saved with status: `pending_review`
- Visit count tracked

---

### Test 3: CTA Button Tracking

**CloudFlow SaaS:**
1. Click **"Request Demo"** button on home page
2. Open browser console (F12)
3. You should see: `🎯 CTA CLICKED: Request Demo`
4. Check your lead scoring system - this should create a lead

**TechGear Store:**
1. Click **"Add to Cart"** on any product
2. Open browser console (F12)
3. You should see: `🛒 ADD TO CART: [Product Name]`
4. Click **"Buy Now"**
5. You should see: `💳 BUY NOW CLICKED: [Product Name]`

**Expected Behavior:**
- All clicks logged to console
- Tracking system captures button clicks
- Lead score increases based on CTA value

---

### Test 4: Form Submission Tracking

**CloudFlow SaaS:**
1. Go to **Contact** page
2. Fill out the contact form
3. Click **"Send Message"**
4. Open console - you should see: `📧 FORM SUBMITTED: Contact Form`

**Expected Behavior:**
- Form data logged
- Lead identified by email
- Contact form submission = high-value action

---

### Test 5: Page View Tracking

**Both Websites:**
1. Open any page
2. Check console immediately
3. You should see: `📄 PAGE VIEW: [page path]`
4. Navigate between pages
5. Each page view logged

**Expected Behavior:**
- Every page view tracked
- Time on page calculated
- Referrer information captured

---

### Test 6: Multi-Tenant Isolation

**Test Scenario:**
1. Browse CloudFlow SaaS website (Company 1)
2. Click buttons, visit pages
3. Login to CRM with Company 1 API key
4. Verify leads/activity visible

5. Switch to Company 2 API key in CRM
6. **Critical:** Company 2 should NOT see Company 1 data
7. Browse TechGear Store (Company 2)
8. Company 2 should only see TechGear data

**Expected Behavior:**
- Complete data isolation
- No cross-tenant data leakage
- Each company sees only their leads

---

### Test 7: Pricing Page Value (High Points)

**CloudFlow SaaS:**
1. Visit **Pricing** page
2. Spend 30+ seconds on the page
3. Click on a pricing plan
4. Check CRM - lead score should increase significantly

**Expected Behavior:**
- Pricing page = 10 points (default)
- Extended time on page = additional points
- Pricing plan click = high-value signal

---

### Test 8: Cart Abandonment Tracking

**TechGear Store:**
1. Add 2-3 products to cart
2. Go to **Cart** page
3. Spend time viewing cart
4. Close browser WITHOUT checking out

**Expected Behavior:**
- Cart items tracked
- Cart page visit = medium-value signal
- No checkout = potential follow-up opportunity

---

### Test 9: Admin Approval Workflow

**After Discovery:**
1. Login to CRM
2. Go to "Discovered Pages" section
3. Find `/features.html` (CloudFlow) or `/products.html` (TechGear)
4. **Approve** the page and assign points (e.g., 12 points)
5. Have a visitor access that page again
6. **Now** it should score points!

**Expected Behavior:**
- Before approval: Page discovered but no scoring
- After approval: Page scores the assigned points
- Admin has full control

---

## 📊 Console Tracking

Open browser console (F12) to see real-time tracking:

### SaaS Website Logs:
```
📄 PAGE VIEW: /index.html
🎯 CTA CLICKED: Request Demo
📧 FORM SUBMITTED: Contact Form
⏱️ TIME ON PAGE: 45 seconds
```

### E-commerce Website Logs:
```
📄 PAGE VIEW: /products.html
👁️ PRODUCT VIEWED: Pro X Smartphone
🛒 ADD TO CART: Pro X Smartphone ($999)
💳 BUY NOW CLICKED: Ultra Laptop Pro
⏱️ TIME ON PAGE: 120 seconds
```

---

## 🎯 Expected Default Pages

After adding websites, these should auto-appear in your CRM:

| Page | Name | Points | Category |
|------|------|--------|----------|
| `/` | Home | 1 | low-value |
| `/about` | About Us | 2 | low-value |
| `/pricing` | Pricing | 10 | high-value |
| `/contact` | Contact | 5 | medium-value |
| `/demo` | Request Demo | 15 | high-value |

---

## 🔍 What to Verify

### ✅ Default Template Feature
- [ ] 5 pages created automatically when website added
- [ ] All pages have correct point values
- [ ] Pages appear in CRM immediately

### ✅ Smart Discovery Feature
- [ ] `/features.html` discovered when visited (CloudFlow)
- [ ] `/products.html` discovered when visited (TechGear)
- [ ] Visit count increments on repeat visits
- [ ] Pages appear with status "pending_review"

### ✅ Admin Control
- [ ] Can edit page points
- [ ] Can delete pages
- [ ] Can approve discovered pages
- [ ] Can reject discovered pages
- [ ] Can manually add custom pages

### ✅ Lead Tracking
- [ ] Page views tracked
- [ ] CTA clicks tracked
- [ ] Form submissions tracked
- [ ] Time on page calculated
- [ ] Lead scores updated

### ✅ Multi-Tenant Isolation
- [ ] Company 1 cannot see Company 2 data
- [ ] Company 2 cannot see Company 1 data
- [ ] API keys work only for respective tenants
- [ ] Website IDs isolated per tenant

---

## 🐛 Troubleshooting

**Tracking not working:**
1. Check browser console for errors
2. Verify tracking script URLs are correct
3. Ensure backend server running on port 3001
4. Check API key and website ID are correct

**Pages not discovered:**
1. Wait 5-10 seconds after page visit
2. Check network tab (F12) for API calls
3. Verify `/track` endpoint responding
4. Check server logs for errors

**Cross-tenant data visible:**
1. **CRITICAL BUG** - check RLS policies
2. Verify API keys are different for each company
3. Test with incognito/private windows
4. Clear browser cache

---

## 📝 Notes

- Both websites are **completely static** (HTML/CSS/JS only)
- No backend required for websites themselves
- All navigation works with real file links
- Button clicks logged to console for verification
- Realistic UI for proper user testing
- Different designs to differentiate companies

---

## 🎉 Success Criteria

Your Lead Scoring CRM is working correctly if:

1. ✅ Both companies registered successfully
2. ✅ Both websites added with 5 default pages each
3. ✅ Tracking script installed and working
4. ✅ Page views tracked in real-time
5. ✅ Smart discovery finds new pages
6. ✅ Admin can approve/reject discovered pages
7. ✅ CTA clicks increase lead scores
8. ✅ Complete multi-tenant data isolation
9. ✅ No cross-tenant data leakage
10. ✅ All 10 workflow steps functional

---

**Ready to test!** Open the websites and start tracking leads. 🚀
