import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// JWT Secret - In production, use a strong random secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
export function generateToken(userId, email, role = 'user') {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export async function authenticateToken(req, res, next) {
  try {
    // DEVELOPMENT ONLY: Allow bypass if BYPASS_AUTH is enabled
    if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'development') {
      console.warn('⚠️  WARNING: Authentication bypass is ENABLED! This should NEVER happen in production!');
      req.user = {
        userId: 1,
        email: 'dev@bypass.com',
        role: 'admin'
      };
      return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid or expired token.',
        code: 'INVALID_TOKEN'
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
}

// Authorization middleware - check user role
export function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated.',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

// Optional auth - allows both authenticated and anonymous access
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

// Verify user exists in database
export async function verifyUserExists(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        error: 'User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user exists in database
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, role, is_active')
      .eq('user_id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'User not found in database.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'User account is disabled.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    console.error('User verification error:', error);
    res.status(500).json({
      error: 'User verification failed.',
      code: 'VERIFICATION_ERROR'
    });
  }
}

export default {
  generateToken,
  verifyToken,
  authenticateToken,
  authorizeRole,
  optionalAuth,
  verifyUserExists
};
