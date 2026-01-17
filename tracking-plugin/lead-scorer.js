/**
 * Lead Scorer - Universal Multi-Tenant Tracking Plugin
 * Version: 1.0.0
 *
 * This script tracks visitor behavior on any website and sends
 * data to the multi-tenant lead scoring backend.
 *
 * Usage:
 * <script>
 *   window.LEAD_SCORER_CONFIG = {
 *     websiteId: "your-website-id",
 *     apiKey: "your-api-key",
 *     apiUrl: "http://localhost:3001/api/v1" // optional
 *   };
 * </script>
 * <script src="https://cdn.yourcrm.com/lead-scorer.js"></script>
 */

(function() {
  'use strict';

  // ============================================
  // STEP 21: Global LeadScorer Object
  // ============================================
  window.LeadScorer = {
    // Configuration
    config: {
      websiteId: null,
      apiKey: null,
      apiUrl: 'http://localhost:3001/api/v1',
      debug: false
    },

    // State
    state: {
      visitorId: null,
      sessionId: null,
      configuredCTAs: [],
      isInitialized: false,
      lastPageView: null,
      pageViewCount: 0
    },

    // ============================================
    // STEP 22: Initialization Function
    // ============================================
    init: async function() {
      try {
        // Load config from global variable
        if (window.LEAD_SCORER_CONFIG) {
          this.config = { ...this.config, ...window.LEAD_SCORER_CONFIG };
        }

        // Validate required config
        if (!this.config.websiteId || !this.config.apiKey) {
          this.log('error', 'Missing required config: websiteId and apiKey');
          return;
        }

        this.log('info', 'Initializing Lead Scorer...', this.config);

        // Generate visitor ID
        this.state.visitorId = await this.getOrCreateVisitorId();
        this.state.sessionId = this.generateSessionId();

        // Track initial page view
        await this.trackPageView();

        // Fetch and setup CTAs
        await this.fetchAndSetupCTAs();

        // Setup form tracking
        this.setupFormTracking();

        // Setup visibility tracking
        this.setupVisibilityTracking();

        // Mark as initialized
        this.state.isInitialized = true;

        this.log('info', 'Lead Scorer initialized successfully', {
          visitorId: this.state.visitorId,
          sessionId: this.state.sessionId
        });

      } catch (error) {
        this.log('error', 'Initialization failed', error);
      }
    },

    // ============================================
    // STEP 23: Visitor ID Generation (Fingerprinting)
    // ============================================
    getOrCreateVisitorId: async function() {
      // Check if visitor ID exists in cookie
      const existingId = this.getCookie('ls_visitor_id');
      if (existingId) {
        return existingId;
      }

      // Generate fingerprint
      const fingerprint = await this.generateFingerprint();

      // Create visitor ID (hash of fingerprint + timestamp)
      const visitorId = this.hashCode(fingerprint + Date.now());

      // Store in cookie (365 days)
      this.setCookie('ls_visitor_id', visitorId, 365);

      return visitorId;
    },

    generateFingerprint: async function() {
      const components = [];

      // Screen resolution
      components.push(screen.width + 'x' + screen.height);
      components.push(screen.colorDepth);

      // Timezone
      components.push(new Date().getTimezoneOffset());

      // Language
      components.push(navigator.language || navigator.userLanguage);

      // User agent
      components.push(navigator.userAgent);

      // Platform
      components.push(navigator.platform);

      // Hardware concurrency
      if (navigator.hardwareConcurrency) {
        components.push(navigator.hardwareConcurrency);
      }

      // Device memory
      if (navigator.deviceMemory) {
        components.push(navigator.deviceMemory);
      }

      // Canvas fingerprint (optional, more advanced)
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('LeadScorer', 2, 2);
        components.push(canvas.toDataURL());
      } catch (e) {
        // Canvas fingerprinting blocked, skip
      }

      return components.join('|');
    },

    generateSessionId: function() {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // ============================================
    // STEP 24: Track Page Views
    // ============================================
    trackPageView: async function() {
      const pageData = {
        page_url: window.location.pathname,
        page_title: document.title,
        page_full_url: window.location.href,
        referrer: document.referrer || 'direct',
        timestamp: new Date().toISOString(),
        session_id: this.state.sessionId,
        page_view_count: ++this.state.pageViewCount
      };

      this.state.lastPageView = pageData.page_url;

      await this.sendEvent('page_view', pageData);

      this.log('info', 'Page view tracked', pageData);
    },

    // ============================================
    // STEP 25: Fetch Configured CTAs from Backend
    // ============================================
    fetchAndSetupCTAs: async function() {
      try {
        const response = await fetch(`${this.config.apiUrl}/websites/${this.config.websiteId}/ctas`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Website-Id': this.config.websiteId
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch CTAs: ${response.status}`);
        }

        const data = await response.json();
        this.state.configuredCTAs = data.ctas || [];

        this.log('info', `Fetched ${this.state.configuredCTAs.length} configured CTAs`);

        // Setup click listeners for CTAs
        this.setupCTAListeners();

      } catch (error) {
        this.log('error', 'Failed to fetch CTAs', error);
        // Fail silently - don't break the website
      }
    },

    // ============================================
    // STEP 26: Attach CTA Event Listeners
    // ============================================
    setupCTAListeners: function() {
      this.state.configuredCTAs.forEach(cta => {
        try {
          // Find all elements matching the CTA identifier (CSS selector)
          const elements = document.querySelectorAll(cta.cta_identifier);

          if (elements.length === 0) {
            this.log('warn', `No elements found for CTA: ${cta.cta_identifier}`);
            return;
          }

          // Attach click listener to each matching element
          elements.forEach(element => {
            // Check if listener already attached
            if (element.dataset.lsTracked) {
              return;
            }

            element.addEventListener('click', (event) => {
              this.trackCTAInteraction(cta, event);
            });

            // Mark as tracked
            element.dataset.lsTracked = 'true';

            this.log('info', `Attached listener to CTA: ${cta.cta_name}`, element);
          });

        } catch (error) {
          this.log('error', `Failed to setup CTA: ${cta.cta_name}`, error);
        }
      });
    },

    // ============================================
    // STEP 27: Track CTA Interactions
    // ============================================
    trackCTAInteraction: async function(cta, event) {
      const ctaData = {
        cta_id: cta.cta_id,
        cta_name: cta.cta_name,
        cta_type: cta.cta_type,
        cta_identifier: cta.cta_identifier,
        points: cta.points,
        page_url: window.location.pathname,
        timestamp: new Date().toISOString(),
        element_text: event.target.innerText || event.target.value || '',
        element_id: event.target.id || '',
        element_class: event.target.className || ''
      };

      await this.sendEvent('cta_interaction', ctaData);

      this.log('info', 'CTA interaction tracked', ctaData);
    },

    // ============================================
    // STEP 28: Track Form Submissions
    // ============================================
    setupFormTracking: function() {
      // Find all forms on the page
      const forms = document.querySelectorAll('form');

      forms.forEach(form => {
        // Check if already tracked
        if (form.dataset.lsTracked) {
          return;
        }

        form.addEventListener('submit', async (event) => {
          await this.trackFormSubmission(form, event);
        });

        // Mark as tracked
        form.dataset.lsTracked = 'true';

        this.log('info', 'Attached listener to form', form);
      });
    },

    trackFormSubmission: async function(form, event) {
      try {
        // Extract form data
        const formData = new FormData(form);
        const formFields = {};

        for (let [key, value] of formData.entries()) {
          // Don't send password fields
          if (key.toLowerCase().includes('password')) {
            continue;
          }
          formFields[key] = value;
        }

        const submissionData = {
          form_id: form.id || 'unknown',
          form_name: form.name || 'unknown',
          form_action: form.action || window.location.href,
          page_url: window.location.pathname,
          fields: formFields,
          timestamp: new Date().toISOString(),
          // Extract common fields
          email: formFields.email || formFields.user_email || formFields.contact_email || null,
          name: formFields.name || formFields.full_name || formFields.first_name || null,
          company: formFields.company || formFields.company_name || formFields.organization || null,
          phone: formFields.phone || formFields.telephone || formFields.mobile || null
        };

        await this.sendEvent('form_submission', submissionData);

        this.log('info', 'Form submission tracked', submissionData);

      } catch (error) {
        this.log('error', 'Failed to track form submission', error);
      }
    },

    // ============================================
    // STEP 29: Send Events to Backend
    // ============================================
    sendEvent: async function(eventType, data) {
      try {
        const payload = {
          event_type: eventType,
          visitor_id: this.state.visitorId,
          session_id: this.state.sessionId,
          data: data,
          metadata: {
            user_agent: navigator.userAgent,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            },
            timestamp: new Date().toISOString()
          }
        };

        const response = await fetch(`${this.config.apiUrl}/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Website-Id': this.config.websiteId,
            'X-Visitor-Id': this.state.visitorId
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const result = await response.json();
        this.log('info', 'Event sent successfully', result);

        return result;

      } catch (error) {
        this.log('error', 'Failed to send event', error);
        // Fail silently - don't break the website
        return null;
      }
    },

    // ============================================
    // STEP 30: Error Handling (Fail Silently)
    // ============================================
    setupVisibilityTracking: function() {
      // Track when user leaves/returns to page
      let pageHideTime = null;

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          pageHideTime = Date.now();
        } else {
          if (pageHideTime) {
            const timeAway = Date.now() - pageHideTime;
            this.log('info', `User returned after ${timeAway}ms`);
            pageHideTime = null;
          }
        }
      });

      // Track page unload
      window.addEventListener('beforeunload', () => {
        this.log('info', 'User leaving page');
        // Could send final event via sendBeacon for reliability
        if (navigator.sendBeacon) {
          const data = JSON.stringify({
            event_type: 'page_exit',
            visitor_id: this.state.visitorId,
            session_id: this.state.sessionId,
            data: {
              page_url: window.location.pathname,
              timestamp: new Date().toISOString()
            }
          });
          navigator.sendBeacon(`${this.config.apiUrl}/track`, data);
        }
      });
    },

    // ============================================
    // Utility Functions
    // ============================================
    log: function(level, message, data) {
      if (!this.config.debug && level !== 'error') {
        return;
      }

      const prefix = '[LeadScorer]';
      if (level === 'error') {
        console.error(prefix, message, data || '');
      } else if (level === 'warn') {
        console.warn(prefix, message, data || '');
      } else {
        console.log(prefix, message, data || '');
      }
    },

    hashCode: function(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return 'v_' + Math.abs(hash).toString(36);
    },

    getCookie: function(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop().split(';').shift();
      }
      return null;
    },

    setCookie: function(name, value, days) {
      const expires = new Date();
      expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    },

    // Public API for manual tracking
    track: function(eventName, data) {
      return this.sendEvent(eventName, data);
    },

    identify: function(userData) {
      return this.sendEvent('identify', userData);
    }
  };

  // ============================================
  // Auto-Initialize on Page Load
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.LeadScorer.init();
    });
  } else {
    // DOM already loaded
    window.LeadScorer.init();
  }

  // Also track SPA navigation (for React, Vue, etc.)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (window.LeadScorer.state.isInitialized) {
        window.LeadScorer.trackPageView();
      }
    }
  }).observe(document, { subtree: true, childList: true });

})();
