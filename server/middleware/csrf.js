/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

import crypto from 'crypto';

// Store for CSRF tokens (in production, use Redis)
const tokenStore = new Map();
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a CSRF token
 * @param {string} sessionId - User session identifier
 * @returns {string} CSRF token
 */
export function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  const secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

  // Create a hash of the token with the secret
  const hash = crypto.createHmac('sha256', secret)
    .update(`${sessionId}:${token}`)
    .digest('hex');

  // Store token with expiry
  tokenStore.set(`${sessionId}:${token}`, {
    hash,
    createdAt: Date.now()
  });

  // Cleanup old tokens periodically
  cleanupExpiredTokens();

  return token;
}

/**
 * Verify a CSRF token
 * @param {string} sessionId - User session identifier
 * @param {string} token - CSRF token to verify
 * @returns {boolean} True if valid
 */
export function verifyCSRFToken(sessionId, token) {
  if (!token || !sessionId) return false;

  const stored = tokenStore.get(`${sessionId}:${token}`);
  if (!stored) return false;

  // Check if token has expired
  if (Date.now() - stored.createdAt > TOKEN_EXPIRY_MS) {
    tokenStore.delete(`${sessionId}:${token}`);
    return false;
  }

  // Verify the hash
  const secret = process.env.CSRF_SECRET || '';
  const expectedHash = crypto.createHmac('sha256', secret)
    .update(`${sessionId}:${token}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(stored.hash),
    Buffer.from(expectedHash)
  );
}

/**
 * Cleanup expired tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (now - value.createdAt > TOKEN_EXPIRY_MS) {
      tokenStore.delete(key);
    }
  }
}

/**
 * CSRF Protection Middleware
 * Checks for valid CSRF token on state-changing requests
 */
export function csrfProtection(req, res, next) {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for API key authenticated requests (machine-to-machine)
  if (req.headers['x-api-key']) {
    return next();
  }

  // Skip CSRF for tracking endpoints (they use API key auth)
  if (req.path.startsWith('/api/v1/track') || req.path === '/api/track-activity') {
    return next();
  }

  // Get session ID from JWT or cookie
  const sessionId = req.user?.userId || req.cookies?.session_id || req.ip;

  // Get CSRF token from header or body
  const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;

  // In development, allow requests without CSRF token but warn
  if (process.env.NODE_ENV !== 'production') {
    if (!csrfToken) {
      console.log('⚠️ CSRF token missing (allowed in development)');
      return next();
    }
  }

  // Verify token
  if (!verifyCSRFToken(sessionId, csrfToken)) {
    return res.status(403).json({
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    });
  }

  // Invalidate used token (one-time use)
  tokenStore.delete(`${sessionId}:${csrfToken}`);

  next();
}

/**
 * Endpoint to get a new CSRF token
 */
export function csrfTokenEndpoint(req, res) {
  const sessionId = req.user?.userId || req.cookies?.session_id || req.ip;
  const token = generateCSRFToken(sessionId);

  res.json({
    csrfToken: token
  });
}

export default {
  csrfProtection,
  csrfTokenEndpoint,
  generateCSRFToken,
  verifyCSRFToken
};
