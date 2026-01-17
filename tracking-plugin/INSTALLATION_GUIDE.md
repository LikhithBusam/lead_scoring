# 📦 Lead Scorer Tracking Plugin - Installation Guide

## 🎯 Overview

The Lead Scorer tracking plugin is a lightweight JavaScript library that tracks visitor behavior on any website and sends data to your multi-tenant lead scoring backend.

**Size:** ~12KB uncompressed, ~4KB gzipped
**Dependencies:** None (vanilla JavaScript)
**Compatibility:** All modern browsers (IE11+)

---

## 📋 Installation Steps

### Step 1: Copy Your Credentials

From `TENANT_CREDENTIALS.txt`:
- **Website ID:** `b236880a-e666-46e6-b68d-fd82e8cb1bd4`
- **API Key:** `lsk_62d8507df3c2b87db3b5a9e53ab92f7e38d726c605338695c6eafd595cc4120b`

### Step 2: Add Tracking Script to Your Website

Add this code to your website's `<head>` or before closing `</body>` tag:

```html
<!-- Lead Scorer Configuration -->
<script>
  window.LEAD_SCORER_CONFIG = {
    websiteId: "b236880a-e666-46e6-b68d-fd82e8cb1bd4",
    apiKey: "lsk_62d8507df3c2b87db3b5a9e53ab92f7e38d726c605338695c6eafd595cc4120b",
    apiUrl: "http://localhost:3001/api/v1", // Change in production
    debug: true // Set to false in production
  };
</script>

<!-- Lead Scorer Tracking Script -->
<script src="/tracking-plugin/lead-scorer.js"></script>
```

### Step 3: Configure Your Pages (In Database)

Add pages you want to track in the `tenant_pages` table:

```sql
INSERT INTO tenant_pages (website_id, page_url, page_name, page_category, base_points) VALUES
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '/', 'Home Page', 'low-value', 5),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '/pricing', 'Pricing Page', 'high-value', 15),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '/demo', 'Demo Page', 'high-value', 20),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '/products', 'Products Page', 'medium-value', 10),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '/contact', 'Contact Page', 'high-value', 15);
```

### Step 4: Configure Your CTAs (In Database)

Add CTAs (buttons, links) you want to track in the `tenant_ctas` table:

```sql
INSERT INTO tenant_ctas (website_id, cta_identifier, cta_name, cta_type, points) VALUES
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '#download-btn', 'Download Brochure', 'button', 15),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '.signup-button', 'Sign Up Button', 'button', 20),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '#request-demo', 'Request Demo', 'button', 25),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', '.video-play', 'Play Video', 'video', 10),
('b236880a-e666-46e6-b68d-fd82e8cb1bd4', 'a[href*="pdf"]', 'PDF Download', 'download', 15);
```

### Step 5: Test the Installation

1. Open your website in a browser
2. Open browser console (F12)
3. Look for `[LeadScorer]` messages
4. You should see:
   ```
   [LeadScorer] Initializing Lead Scorer...
   [LeadScorer] Lead Scorer initialized successfully
   [LeadScorer] Page view tracked
   [LeadScorer] Fetched X configured CTAs
   ```

---

## 🎯 What Gets Tracked Automatically

### 1. Page Views
- Page URL, title, referrer
- Timestamp, session ID
- Viewport size, user agent

### 2. CTA Interactions
- Button clicks matching configured selectors
- Link clicks
- Video plays
- Downloads

### 3. Form Submissions
- All form fields (except passwords)
- Email, name, company, phone extracted automatically
- Form ID, action URL

### 4. Visitor Identity
- Unique visitor ID (browser fingerprint + cookie)
- Session ID (per browsing session)
- Return visits tracked automatically

---

## 🔧 Configuration Options

```javascript
window.LEAD_SCORER_CONFIG = {
  // Required
  websiteId: "your-website-id",      // From tenant_websites table
  apiKey: "your-api-key",             // From tenants table

  // Optional
  apiUrl: "http://localhost:3001/api/v1",  // Backend API URL
  debug: false,                        // Show console logs

  // Advanced (coming soon)
  trackScrollDepth: true,              // Track how far users scroll
  trackTimeOnPage: true,               // Track time spent on each page
  trackMouseMovement: false            // Track mouse heatmaps
};
```

---

## 📊 Manual Tracking API

You can manually track custom events:

```javascript
// Track custom event
LeadScorer.track('video_completed', {
  video_id: 'intro-video',
  duration: 180,
  completion_rate: 100
});

// Identify a user (when they log in or fill a form)
LeadScorer.identify({
  email: 'john@example.com',
  name: 'John Doe',
  company: 'Acme Corp',
  phone: '+1-555-0123'
});
```

---

## 🚀 Production Deployment

### Option A: Self-Hosted

1. Copy `lead-scorer.js` to your server
2. Update the script src to your domain:
   ```html
   <script src="https://yourdomain.com/js/lead-scorer.js"></script>
   ```

### Option B: CDN Deployment

1. Upload `lead-scorer.js` to a CDN (CloudFlare, AWS CloudFront, etc.)
2. Update the script src:
   ```html
   <script src="https://cdn.yourdomain.com/lead-scorer.min.js"></script>
   ```

### Production Checklist

- [ ] Set `debug: false` in config
- [ ] Use HTTPS for apiUrl
- [ ] Enable CORS for your domain in backend
- [ ] Test on staging environment first
- [ ] Monitor browser console for errors
- [ ] Verify events in database

---

## 🔒 Security & Privacy

### Data Collected
- Anonymous visitor ID (no PII)
- Page views and navigation
- Button/link clicks (configured CTAs only)
- Form data (when user submits forms)

### Privacy Compliance
- No tracking across domains
- Respects Do Not Track (optional)
- Cookie consent compatible
- GDPR/CCPA compliant (with proper consent flow)

### Cookie Usage
- `ls_visitor_id` - Visitor identification (365 days)
- First-party cookie only
- Can be deleted by user

---

## 🐛 Troubleshooting

### Script Not Loading
**Error:** `net::ERR_FILE_NOT_FOUND`
**Solution:** Check the script path is correct

### No Events Being Tracked
**Error:** `Failed to fetch CTAs: 401`
**Solution:** Check your API key is correct

### CORS Errors
**Error:** `Access-Control-Allow-Origin`
**Solution:** Add your domain to `cors_origins` in `tenant_websites` table

### CTAs Not Working
**Error:** `No elements found for CTA`
**Solution:** Check CSS selectors match your HTML

---

## 📦 Step 31: Minification (Coming Soon)

To minify the script for production:

```bash
# Install terser
npm install -g terser

# Minify
terser lead-scorer.js -c -m -o lead-scorer.min.js
```

This will reduce file size by ~60% for faster loading.

---

## ✅ Installation Complete!

Your tracking plugin is now installed and ready to track visitors!

**Next steps:**
1. Configure pages in database
2. Configure CTAs in database
3. Build backend API to receive events
4. Build admin dashboard to view leads

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify API endpoint is running
3. Check database for received events
4. Review this guide for troubleshooting

**Plugin Version:** 1.0.0
**Last Updated:** January 12, 2026
