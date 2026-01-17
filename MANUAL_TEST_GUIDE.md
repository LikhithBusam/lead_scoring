# Manual Testing Guide - Two Demo Companies

## 🚀 Quick Setup

Your server should be running on `http://localhost:3001` (check your terminal with `npm run dev`).

Open a **NEW terminal** and run these commands to create 2 demo companies:

---

## 📋 STEP 1: Create Company 1 - TechCorp Solutions

```bash
curl -X POST http://localhost:3001/api/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d "{\"company_name\":\"TechCorp Solutions\",\"domain\":\"techcorp.com\",\"plan_type\":\"pro\"}"
```

**Copy the `api_key` from the response!**

Then add a website:

```bash
curl -X POST http://localhost:3001/api/v1/websites \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d "{\"website_url\":\"https://www.techcorp-solutions.com\",\"website_name\":\"TechCorp Main Website\"}"
```

---

## 📋 STEP 2: Create Company 2 - Digital Marketing Pro

```bash
curl -X POST http://localhost:3001/api/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d "{\"company_name\":\"Digital Marketing Pro\",\"domain\":\"digitalmarketingpro.com\",\"plan_type\":\"pro\"}"
```

**Copy the `api_key` from the response!**

Then add a website:

```bash
curl -X POST http://localhost:3001/api/v1/websites \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d "{\"website_url\":\"https://www.digitalmarketingpro.io\",\"website_name\":\"Digital Marketing Pro Website\"}"
```

---

## 🌐 MANUAL TESTING IN BROWSER

### Test Scenario 1: Login as Company 1

1. Open: **http://localhost:5173**
2. You should see a company selector or login screen
3. Enter the **API Key for Company 1** (TechCorp Solutions)
4. You should see:
   - Company name: TechCorp Solutions
   - Website: https://www.techcorp-solutions.com
   - **5 default pages**: /, /about, /pricing, /contact, /demo

### Test Scenario 2: View and Edit Default Pages

1. Go to the Pages/Configuration section
2. You should see 5 default pages with points:
   - `/` - Home (1 point)
   - `/about` - About Us (2 points)
   - `/pricing` - Pricing (10 points)
   - `/contact` - Contact (5 points)
   - `/demo` - Request Demo (15 points)
3. **Test editing**: Change `/pricing` points from 10 to 20
4. **Test deleting**: Delete the `/about` page
5. **Test adding**: Add a new page `/features` with 12 points

### Test Scenario 3: Switch to Company 2

1. Logout or switch company
2. Enter the **API Key for Company 2** (Digital Marketing Pro)
3. You should see:
   - Company name: Digital Marketing Pro
   - Website: https://www.digitalmarketingpro.io
   - **DIFFERENT 5 default pages** (fresh set)
4. **Critical Test**: Verify you CANNOT see Company 1's data!

### Test Scenario 4: Multi-Tenant Isolation

1. Add a custom page to Company 1: `/custom-page-company1`
2. Switch to Company 2
3. Verify `/custom-page-company1` is NOT visible
4. Add a custom page to Company 2: `/custom-page-company2`
5. Switch back to Company 1
6. Verify `/custom-page-company2` is NOT visible
7. **This proves data isolation is working!**

---

## 🎯 What to Look For

### ✅ Working Features

- [ ] Company 1 and Company 2 have separate dashboards
- [ ] Each company has 5 default pages auto-created
- [ ] Can edit page points
- [ ] Can delete default pages
- [ ] Can add custom pages manually
- [ ] Company 1 cannot see Company 2's data
- [ ] Company 2 cannot see Company 1's data

### ❌ If Something Doesn't Work

1. Check server is running (`npm run dev` in terminal)
2. Check frontend is on http://localhost:5173
3. Check browser console for errors (F12)
4. Verify API keys are correct

---

## 📊 Expected Workflow

```
Step 1: Company Signup → ✅ Done (using API)
Step 2: Admin Login → ✅ Test in browser (use API key)
Step 3: Add Website → ✅ Done (using API)
Step 4: Default Pages Created → ✅ Should see 5 pages automatically
Step 5: Admin Edits Defaults → ✅ Test editing/deleting pages
Step 6: Tracking Script → ✅ View in website settings
Step 7: Smart Discovery → ✅ Will work when visitor accesses new pages
Step 8: Manual Add → ✅ Test adding custom pages
Step 9: Lead Tracking → ✅ Will show when tracking script is used
Step 10: Long-term Support → ✅ Add more websites, discover new pages
```

---

## 🔑 Quick Reference

**Company 1:**
- Name: TechCorp Solutions
- Domain: techcorp.com
- Website: https://www.techcorp-solutions.com
- API Key: (copy from Step 1 response)

**Company 2:**
- Name: Digital Marketing Pro
- Domain: digitalmarketingpro.com
- Website: https://www.digitalmarketingpro.io
- API Key: (copy from Step 2 response)

---

## 💡 Pro Tips

1. **Keep API keys safe**: Save them in a text file for easy access
2. **Use browser tabs**: Open Company 1 in one tab, Company 2 in another
3. **Test isolation**: This is the most important feature - make sure data doesn't leak!
4. **Screenshot results**: Take screenshots for your manager presentation

---

Good luck with your manual testing! 🚀
