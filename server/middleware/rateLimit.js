import rateLimit from 'express-rate-limit';

// General API rate limiter - 1000 requests per 15 minutes (increased for dev)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints - 10 requests per 15 minutes
// Count ALL requests (both failed and successful) to prevent credential stuffing
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: false, // Count ALL requests for security
  standardHeaders: true,
  legacyHeaders: false
});

// Activity tracking limiter - 50 requests per minute (high volume expected)
export const activityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50,
  message: {
    error: 'Too many activity tracking requests, please slow down.',
    code: 'ACTIVITY_RATE_LIMIT_EXCEEDED'
  },
});

// Company research limiter - 10 requests per hour (expensive AI operation)
export const researchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Too many research requests, please try again later. Limit: 10 per hour.',
    code: 'RESEARCH_RATE_LIMIT_EXCEEDED'
  },
});

export default {
  apiLimiter,
  authLimiter,
  activityLimiter,
  researchLimiter
};
