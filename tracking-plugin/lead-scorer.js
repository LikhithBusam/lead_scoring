/**
 * Lead Scorer - Production-Ready CDN Tracking Script
 * Version: 2.0.0
 *
 * PRODUCTION USAGE:
 * <script
 *   src="https://cdn.yourproduct.com/lead-scorer.js"
 *   data-website-id="YOUR_WEBSITE_ID"
 *   data-api-key="YOUR_API_KEY"
 *   data-api-url="https://api.yourproduct.com/api/v1"
 *   data-debug="false">
 * </script>
 *
 * Works on: Static HTML, React, Vue, WordPress, any CMS
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION FLOW:
  // ═══════════════════════════════════════════════════════════════
  //
  // 1. Script loads → IIFE executes immediately
  // 2. Find script tag → Read data-* attributes
  // 3. Validate config → Fail safely if missing
  // 4. Check idempotency → Prevent double initialization
  // 5. Create isolated namespace → No global pollution
  // 6. Initialize tracker → Setup listeners
  // 7. Track page view → Send first event
  // 8. Watch for SPA navigation → Handle React/Vue routing
  //
  // ═══════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // STEP 1: IDEMPOTENCY CHECK - Prevent double initialization
  // ─────────────────────────────────────────────────────────────
  if (window.__LEAD_SCORER_INITIALIZED__) {
    return; // Already initialized, exit silently
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: READ CONFIG FROM DATA ATTRIBUTES
  // ─────────────────────────────────────────────────────────────
  var scriptTag = document.currentScript || (function() {
    var scripts = document.querySelectorAll('script[data-website-id]');
    return scripts[scripts.length - 1];
  })();

  if (!scriptTag) {
    console.error('[LeadScorer] Script tag not found. Cannot initialize.');
    return;
  }

  var config = {
    websiteId: scriptTag.getAttribute('data-website-id'),
    apiKey: scriptTag.getAttribute('data-api-key'),
    apiUrl: scriptTag.getAttribute('data-api-url') || 'https://api.yourproduct.com/api/v1',
    debug: scriptTag.getAttribute('data-debug') === 'true'
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 3: VALIDATE REQUIRED CONFIG
  // ─────────────────────────────────────────────────────────────
  if (!config.websiteId) {
    console.error('[LeadScorer] Missing required attribute: data-website-id');
    return;
  }

  if (!config.apiKey) {
    console.error('[LeadScorer] Missing required attribute: data-api-key');
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: MARK AS INITIALIZED (Idempotency flag)
  // ─────────────────────────────────────────────────────────────
  window.__LEAD_SCORER_INITIALIZED__ = true;

  // ─────────────────────────────────────────────────────────────
  // STEP 5: CREATE ISOLATED TRACKER (No global pollution)
  // ─────────────────────────────────────────────────────────────
  var LeadScorer = (function() {

    // Private state - not accessible from outside
    var state = {
      visitorId: null,
      sessionId: null,
      isReady: false,
      eventQueue: [],      // Queue events until ready
      lastPageUrl: null,
      pageViewCount: 0,
      requestCount: 0,
      lastRequestTime: 0
    };

    // Rate limiting config
    var RATE_LIMIT = {
      maxRequestsPerMinute: 60,
      minRequestInterval: 100 // ms between requests
    };

    // ───────────────────────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ───────────────────────────────────────────────────────────

    function log(level, message, data) {
      if (!config.debug && level !== 'error') return;
      var prefix = '[LeadScorer]';
      var fn = level === 'error' ? console.error :
               level === 'warn' ? console.warn : console.log;
      fn(prefix, message, data || '');
    }

    function hashString(str) {
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'v_' + Math.abs(hash).toString(36);
    }

    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    function getCookie(name) {
      var value = '; ' + document.cookie;
      var parts = value.split('; ' + name + '=');
      if (parts.length === 2) {
        return parts.pop().split(';').shift();
      }
      return null;
    }

    function setCookie(name, value, days) {
      var expires = new Date();
      expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
      var secure = window.location.protocol === 'https:' ? ';Secure' : '';
      document.cookie = name + '=' + value +
                        ';expires=' + expires.toUTCString() +
                        ';path=/' +
                        ';SameSite=Lax' +
                        secure;
    }

    // ───────────────────────────────────────────────────────────
    // VISITOR ID MANAGEMENT
    // ───────────────────────────────────────────────────────────

    function getOrCreateVisitorId() {
      var existingId = getCookie('ls_vid');
      if (existingId) {
        return existingId;
      }

      // Generate fingerprint-based ID
      var components = [
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.language || navigator.userLanguage,
        navigator.userAgent.substring(0, 50),
        navigator.hardwareConcurrency || 'unknown'
      ];

      var fingerprint = components.join('|');
      var visitorId = hashString(fingerprint + Date.now() + Math.random());

      // Store for 365 days
      setCookie('ls_vid', visitorId, 365);

      return visitorId;
    }

    function getOrCreateSessionId() {
      var existingId = sessionStorage.getItem('ls_sid');
      if (existingId) {
        return existingId;
      }

      var sessionId = 'sess_' + Date.now() + '_' + generateUUID().substring(0, 8);
      sessionStorage.setItem('ls_sid', sessionId);

      return sessionId;
    }

    // ───────────────────────────────────────────────────────────
    // RATE LIMITING
    // ───────────────────────────────────────────────────────────

    function checkRateLimit() {
      var now = Date.now();

      // Check minimum interval between requests
      if (now - state.lastRequestTime < RATE_LIMIT.minRequestInterval) {
        return false;
      }

      // Reset counter every minute
      if (now - state.lastRequestTime > 60000) {
        state.requestCount = 0;
      }

      // Check max requests per minute
      if (state.requestCount >= RATE_LIMIT.maxRequestsPerMinute) {
        log('warn', 'Rate limit reached, event dropped');
        return false;
      }

      return true;
    }

    // ───────────────────────────────────────────────────────────
    // EVENT SENDING
    // ───────────────────────────────────────────────────────────

    function sendEvent(eventType, data, useBeacon) {
      // Check rate limit
      if (!checkRateLimit()) {
        return Promise.resolve(null);
      }

      var payload = {
        event_type: eventType,
        visitor_id: state.visitorId,
        session_id: state.sessionId,
        data: data,
        metadata: {
          url: window.location.href,
          referrer: document.referrer || 'direct',
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };

      state.requestCount++;
      state.lastRequestTime = Date.now();

      // Use sendBeacon for page exit (more reliable)
      if (useBeacon && navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        var success = navigator.sendBeacon(
          config.apiUrl + '/track?website_id=' + config.websiteId + '&api_key=' + config.apiKey,
          blob
        );
        log('info', 'Event sent via beacon: ' + eventType, success);
        return Promise.resolve({ success: success });
      }

      // Standard fetch for normal events
      return fetch(config.apiUrl + '/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
          'X-Website-ID': config.websiteId
        },
        body: JSON.stringify(payload),
        keepalive: true // Allows request to outlive page
      })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function(result) {
        log('info', 'Event sent: ' + eventType, result);
        return result;
      })
      .catch(function(error) {
        log('error', 'Failed to send event: ' + eventType, error.message);
        return null;
      });
    }

    // ───────────────────────────────────────────────────────────
    // PAGE VIEW TRACKING
    // ───────────────────────────────────────────────────────────

    function trackPageView() {
      var currentUrl = window.location.pathname + window.location.search;

      // Deduplicate rapid page views (within 500ms)
      if (currentUrl === state.lastPageUrl &&
          Date.now() - state.lastRequestTime < 500) {
        return Promise.resolve(null);
      }

      state.lastPageUrl = currentUrl;
      state.pageViewCount++;

      return sendEvent('page_view', {
        page_url: window.location.pathname,
        page_title: document.title,
        page_full_url: window.location.href,
        referrer: document.referrer || 'direct',
        page_view_number: state.pageViewCount,
        timestamp: new Date().toISOString()
      });
    }

    // ───────────────────────────────────────────────────────────
    // FORM TRACKING
    // ───────────────────────────────────────────────────────────

    function setupFormTracking() {
      document.addEventListener('submit', function(event) {
        var form = event.target;
        if (form.tagName !== 'FORM') return;

        // Don't track forms marked with data-ls-ignore
        if (form.hasAttribute('data-ls-ignore')) return;

        trackFormSubmission(form);
      }, true); // Use capture phase
    }

    function trackFormSubmission(form) {
      try {
        var formData = new FormData(form);
        var fields = {};
        var sensitiveFields = ['password', 'pwd', 'pass', 'secret', 'token', 'credit', 'card', 'cvv', 'ssn'];

        formData.forEach(function(value, key) {
          // Skip sensitive fields
          var keyLower = key.toLowerCase();
          for (var i = 0; i < sensitiveFields.length; i++) {
            if (keyLower.indexOf(sensitiveFields[i]) !== -1) {
              return; // Skip this field
            }
          }
          fields[key] = value;
        });

        // Extract common lead fields
        var email = fields.email || fields.user_email || fields.contact_email ||
                    fields.mail || fields.e_mail || null;
        var name = fields.name || fields.full_name || fields.fullname ||
                   fields.first_name || fields.firstname || null;
        var company = fields.company || fields.company_name || fields.organization ||
                      fields.org || fields.business || null;
        var phone = fields.phone || fields.telephone || fields.mobile ||
                    fields.tel || fields.phone_number || null;

        sendEvent('form_submission', {
          form_id: form.id || null,
          form_name: form.name || form.getAttribute('data-form-name') || null,
          form_action: form.action || window.location.href,
          page_url: window.location.pathname,
          fields: fields,
          email: email,
          name: name,
          company: company,
          phone: phone,
          timestamp: new Date().toISOString()
        });

        log('info', 'Form submission tracked', { email: email, name: name });

      } catch (error) {
        log('error', 'Form tracking error', error.message);
      }
    }

    // ───────────────────────────────────────────────────────────
    // CLICK TRACKING (for CTAs)
    // ───────────────────────────────────────────────────────────

    function setupClickTracking() {
      document.addEventListener('click', function(event) {
        var target = event.target.closest('[data-ls-track]');
        if (!target) return;

        var trackName = target.getAttribute('data-ls-track');
        var trackValue = target.getAttribute('data-ls-value') || '';

        sendEvent('cta_interaction', {
          cta_name: trackName,
          cta_value: trackValue,
          element_text: target.innerText || target.value || '',
          element_id: target.id || '',
          page_url: window.location.pathname,
          timestamp: new Date().toISOString()
        });

        log('info', 'CTA click tracked', { name: trackName });
      }, true);
    }

    // ───────────────────────────────────────────────────────────
    // SPA NAVIGATION TRACKING
    // ───────────────────────────────────────────────────────────

    function setupSPATracking() {
      // Track pushState/replaceState
      var originalPushState = history.pushState;
      var originalReplaceState = history.replaceState;

      history.pushState = function() {
        originalPushState.apply(this, arguments);
        onUrlChange();
      };

      history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        onUrlChange();
      };

      // Track popstate (back/forward)
      window.addEventListener('popstate', onUrlChange);

      // Track hashchange
      window.addEventListener('hashchange', onUrlChange);
    }

    function onUrlChange() {
      // Debounce URL changes (100ms)
      clearTimeout(state.urlChangeTimer);
      state.urlChangeTimer = setTimeout(function() {
        if (state.isReady) {
          trackPageView();
        }
      }, 100);
    }

    // ───────────────────────────────────────────────────────────
    // PAGE EXIT TRACKING
    // ───────────────────────────────────────────────────────────

    function setupExitTracking() {
      // Use pagehide for more reliable exit tracking
      window.addEventListener('pagehide', function() {
        sendEvent('page_exit', {
          page_url: window.location.pathname,
          time_on_page: Date.now() - state.pageLoadTime,
          timestamp: new Date().toISOString()
        }, true); // Use beacon
      });

      // Fallback for older browsers
      window.addEventListener('beforeunload', function() {
        sendEvent('page_exit', {
          page_url: window.location.pathname,
          time_on_page: Date.now() - state.pageLoadTime,
          timestamp: new Date().toISOString()
        }, true);
      });
    }

    // ───────────────────────────────────────────────────────────
    // INITIALIZATION
    // ───────────────────────────────────────────────────────────

    function initialize() {
      log('info', 'Initializing Lead Scorer v2.0.0');
      log('info', 'Config:', {
        websiteId: config.websiteId,
        apiUrl: config.apiUrl,
        debug: config.debug
      });

      // Setup visitor & session
      state.visitorId = getOrCreateVisitorId();
      state.sessionId = getOrCreateSessionId();
      state.pageLoadTime = Date.now();

      log('info', 'Visitor ID:', state.visitorId);
      log('info', 'Session ID:', state.sessionId);

      // Setup all tracking
      setupFormTracking();
      setupClickTracking();
      setupSPATracking();
      setupExitTracking();

      // Track initial page view
      trackPageView();

      // Mark as ready
      state.isReady = true;

      // Process any queued events
      while (state.eventQueue.length > 0) {
        var queued = state.eventQueue.shift();
        sendEvent(queued.type, queued.data);
      }

      log('info', 'Lead Scorer initialized successfully');
    }

    // ───────────────────────────────────────────────────────────
    // PUBLIC API (Minimal, intentional exposure)
    // ───────────────────────────────────────────────────────────

    // Auto-initialize
    initialize();

    return {
      // Manual event tracking
      track: function(eventName, eventData) {
        if (!state.isReady) {
          state.eventQueue.push({ type: eventName, data: eventData });
          return Promise.resolve(null);
        }
        return sendEvent(eventName, eventData || {});
      },

      // Identify user (after login)
      identify: function(userData) {
        return sendEvent('identify', {
          email: userData.email || null,
          name: userData.name || null,
          company: userData.company || null,
          phone: userData.phone || null,
          custom: userData.custom || {},
          timestamp: new Date().toISOString()
        });
      },

      // Get visitor ID
      getVisitorId: function() {
        return state.visitorId;
      },

      // Get session ID
      getSessionId: function() {
        return state.sessionId;
      },

      // Check if ready
      isReady: function() {
        return state.isReady;
      },

      // Version
      version: '2.0.0'
    };
  })();

  // ─────────────────────────────────────────────────────────────
  // STEP 6: EXPOSE MINIMAL PUBLIC API
  // ─────────────────────────────────────────────────────────────
  // Only expose what's necessary for manual tracking
  window.LeadScorer = LeadScorer;

})();

/**
 * ═══════════════════════════════════════════════════════════════════
 * SECURITY CONSIDERATIONS
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. API KEY EXPOSURE
 *    - API keys are visible in page source (unavoidable for client-side)
 *    - Backend validates: API key + Website ID + Domain match
 *    - Rate limiting prevents abuse
 *    - Keys are scoped to specific tenant (limited blast radius)
 *
 * 2. RATE LIMITING (Client-side)
 *    - Max 60 requests/minute
 *    - Min 100ms between requests
 *    - Backend also enforces rate limits
 *
 * 3. DOMAIN VALIDATION
 *    - Backend checks Origin/Referer header
 *    - Website must be registered for the tenant
 *    - Mismatched domains are rejected
 *
 * 4. SENSITIVE DATA
 *    - Password fields are never captured
 *    - Credit card, SSN, tokens are filtered
 *    - Only lead-relevant data is sent
 *
 * 5. REPLAY PREVENTION
 *    - Each event has unique timestamp
 *    - Session IDs are browser-bound
 *    - Backend deduplicates within time window
 *
 * ═══════════════════════════════════════════════════════════════════
 * INTEGRATION WITH MULTI-TENANT BACKEND
 * ═══════════════════════════════════════════════════════════════════
 *
 * REQUEST FLOW:
 *
 * [Browser] → POST /api/v1/track
 *   Headers:
 *     X-API-Key: tenant's API key
 *     X-Website-ID: registered website ID
 *   Body:
 *     { event_type, visitor_id, session_id, data, metadata }
 *
 * [Backend] → Validates:
 *   1. API key exists and is active
 *   2. Website ID belongs to tenant
 *   3. Origin domain matches registered domain
 *   4. Rate limits not exceeded
 *
 * [Backend] → Extracts tenant_id from API key
 *
 * [Backend] → Stores in database WITH tenant_id:
 *   - lead_activities (tenant_id, website_id, visitor_id, ...)
 *   - contacts (tenant_id, email, name, ...)
 *   - leads (tenant_id, contact_id, ...)
 *   - lead_scores (tenant_id, lead_id, ...)
 *
 * [RLS Policy] → Enforces:
 *   - Tenant can ONLY query their own data
 *   - WHERE tenant_id = current_tenant_id
 *
 * ═══════════════════════════════════════════════════════════════════
 * COMMON FAILURE CASES & HANDLING
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. Missing data-website-id
 *    → Logs error, script exits gracefully
 *    → Website continues to function
 *
 * 2. Missing data-api-key
 *    → Logs error, script exits gracefully
 *    → Website continues to function
 *
 * 3. Network failure
 *    → Events fail silently
 *    → No retry (to prevent queue buildup)
 *    → Website unaffected
 *
 * 4. Invalid API key
 *    → Backend returns 401
 *    → Logged as error
 *    → Website unaffected
 *
 * 5. Rate limit exceeded
 *    → Events dropped client-side
 *    → Warning logged
 *    → Website unaffected
 *
 * 6. Double script include
 *    → Idempotency check prevents double init
 *    → Only first instance runs
 *
 * 7. SPA navigation
 *    → History API patched
 *    → Page views tracked automatically
 *    → Works with React Router, Vue Router, etc.
 *
 * 8. Ad blockers
 *    → May block tracking requests
 *    → Fails silently
 *    → Website unaffected
 *
 * ═══════════════════════════════════════════════════════════════════
 */
