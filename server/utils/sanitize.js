/**
 * Input Sanitization Utilities
 * Protects against XSS and injection attacks
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char]);
}

/**
 * Strip HTML tags from string
 * @param {string} str - String to strip
 * @returns {string} String without HTML tags
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for safe database storage and display
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Escape HTML entities
  sanitized = escapeHtml(sanitized);

  return sanitized;
}

/**
 * Sanitize email address
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return email;

  // Remove whitespace and convert to lowercase
  let sanitized = email.trim().toLowerCase();

  // Remove any HTML tags
  sanitized = stripHtml(sanitized);

  // Basic email character whitelist
  sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');

  return sanitized;
}

/**
 * Sanitize URL
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;

  // Trim whitespace
  let sanitized = url.trim();

  // Check for javascript: protocol (XSS vector)
  if (/^javascript:/i.test(sanitized)) {
    return null;
  }

  // Check for data: protocol (potential XSS)
  if (/^data:/i.test(sanitized)) {
    return null;
  }

  // Ensure it starts with http:// or https://
  if (!/^https?:\/\//i.test(sanitized)) {
    // Add https:// if missing
    if (sanitized.includes('.') && !sanitized.includes('://')) {
      sanitized = 'https://' + sanitized;
    } else {
      return null;
    }
  }

  try {
    // Validate URL structure
    new URL(sanitized);
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Options for sanitization
 * @returns {Object} Sanitized object
 */
export function sanitizeObject(obj, options = {}) {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize the key as well
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value, options);
  }

  return sanitized;
}

/**
 * Express middleware to sanitize request body
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Don't sanitize password fields
    const passwordFields = ['password', 'password_hash', 'currentPassword', 'newPassword'];
    const sanitized = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (passwordFields.includes(key)) {
        sanitized[key] = value; // Keep passwords as-is
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }

    req.body = sanitized;
  }

  next();
}

/**
 * Express middleware to sanitize request query params
 */
export function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Express middleware to sanitize request params
 */
export function sanitizeParams(req, res, next) {
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Combined sanitization middleware
 */
export function sanitizeAll(req, res, next) {
  sanitizeBody(req, res, () => {
    sanitizeQuery(req, res, () => {
      sanitizeParams(req, res, next);
    });
  });
}

export default {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeObject,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeAll
};
