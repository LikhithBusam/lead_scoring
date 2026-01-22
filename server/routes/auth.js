import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateToken } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['admin', 'sales', 'user']).default('user'),
  tenantId: z.string().uuid().optional() // Optional: link to existing tenant
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Register new user (Company View)
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { email, password, firstName, lastName, role, tenantId } = validationResult.data;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // If tenantId provided, verify it exists
    let tenant = null;
    if (tenantId) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('tenant_id, company_name, api_key, plan_type')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (tenantError || !tenantData) {
        return res.status(404).json({
          error: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        });
      }
      tenant = tenantData;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in database (with tenant_id if provided)
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role,
        tenant_id: tenantId || null,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select('user_id, email, first_name, last_name, role, tenant_id')
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      return res.status(500).json({
        error: 'Failed to create user',
        code: 'USER_CREATION_FAILED'
      });
    }

    // Generate JWT token
    const token = generateToken(newUser.user_id, newUser.email, newUser.role);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.user_id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        tenantId: newUser.tenant_id
      },
      // Include tenant info if user was linked to a company
      tenant: tenant ? {
        tenantId: tenant.tenant_id,
        companyName: tenant.company_name,
        apiKey: tenant.api_key,
        planType: tenant.plan_type
      } : null,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login user (Company View)
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { email, password } = validationResult.data;

    // Find user by email (including tenant_id for company context)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, email, password_hash, first_name, last_name, role, is_active, tenant_id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account is disabled. Please contact administrator.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Fetch tenant information if user is linked to a tenant
    let tenant = null;
    if (user.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('tenant_id, company_name, domain, plan_type, api_key, is_active')
        .eq('tenant_id', user.tenant_id)
        .eq('is_active', true)
        .single();
      
      tenant = tenantData;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', user.user_id);

    // Generate JWT token (include tenant_id for company context)
    const token = generateToken(user.user_id, user.email, user.role, user.tenant_id);

    // Set JWT in httpOnly cookie for security
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set tenant API key in httpOnly cookie if available
    if (tenant?.api_key) {
      res.cookie('tenant_api_key', tenant.api_key, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenantId: user.tenant_id
      },
      // Include tenant info if user belongs to a company
      // Note: API key is now set in httpOnly cookie, not exposed in response
      tenant: tenant ? {
        tenantId: tenant.tenant_id,
        companyName: tenant.company_name,
        domain: tenant.domain,
        planType: tenant.plan_type
      } : null,
      token // Still return token for clients that need it in headers
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Logout - Clear cookies
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.clearCookie('tenant_api_key', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const { verifyToken } = await import('../middleware/auth.js');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, role, is_active, created_at, last_login_at')
      .eq('user_id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      code: 'PROFILE_ERROR'
    });
  }
});

export default router;
