import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage } from '@langchain/core/messages';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import { authenticateToken, authorizeRole, optionalAuth } from './middleware/auth.js';
import { authenticateTenant } from './middleware/tenantAuth.js';
import { apiLimiter, activityLimiter, researchLimiter, authLimiter } from './middleware/rateLimit.js';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import trackingRoutes from './routes/tracking.js';
import tenantLeadsRoutes from './routes/tenantLeads.js';
import tenantManagementRoutes from './routes/tenantManagement.js';
import logger, { requestLogger, logActivity, logSecurityEvent, logError } from './utils/logger.js';
import { initializeCache, closeCache, getCache, setCache, CACHE_KEYS } from './utils/cache.js';
import { CACHE_CONFIG } from './config/scoringConstants.js';
import { validateEnvOrExit } from './utils/validateEnv.js';
import { sanitizeAll } from './utils/sanitize.js';
import { csrfProtection, csrfTokenEndpoint } from './middleware/csrf.js';
import { startMomentumDecayScheduler, stopMomentumDecayScheduler } from './jobs/momentumDecay.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Validate environment variables on startup
validateEnvOrExit();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client with SERVICE ROLE KEY (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize LangChain with Groq (Free Llama 3 model)
const llm = new ChatGroq({
  model: 'llama-3.3-70b-versatile',
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.3,
});

// Initialize Tavily only if API key is provided (optional for cost savings)
const tvly = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

// Serper API helper function (Google Search)
async function searchWithSerper(query) {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num: 10 })
  });
  return response.json();
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin resource loading
}));

// CORS configuration with security (added multi-tenant headers)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Check against allowed origins from env
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow anyway in development mode
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Website-Id', 'X-Visitor-Id']
}));

app.use(express.json({ limit: '10mb' }));

// Cookie parser for httpOnly cookies
app.use(cookieParser());

// Response compression (reduces response size by 3-5x)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
}));

// Serve tracking plugin as static file
app.use('/tracking-plugin', express.static(path.join(__dirname, '..', 'tracking-plugin')));

// Request logging
app.use(requestLogger);

// Apply global rate limiting to all API routes
app.use('/api/', apiLimiter);

// Input sanitization (XSS protection)
app.use(sanitizeAll);

// CSRF protection for state-changing requests
app.use(csrfProtection);

// CSRF token endpoint
app.get('/api/csrf-token', csrfTokenEndpoint);

// Input validation schemas
const trackActivitySchema = z.object({
  leadId: z.number().int().positive(),
  activityType: z.string().min(1).max(100),
  activitySubtype: z.string().max(100).optional(),
  metadata: z.record(z.any()).optional()
});

const updateLeadSchema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(50).regex(/^[+\d\s\-()]*$/, 'Invalid phone format').optional(),
  company: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.string().max(50).optional(),
  location: z.string().max(255).optional()
});

// Strengthened validation for company research (prevents prompt injection)
const companyResearchSchema = z.object({
  companyName: z.string()
    .min(1, 'Company name required')
    .max(100, 'Company name too long')
    .regex(/^[a-zA-Z0-9\s\-\.&',\/()]+$/, 'Invalid characters in company name')
    .refine(val => val.toLowerCase() !== 'n/a' && val.toLowerCase() !== 'na' && val.toLowerCase() !== 'none', {
      message: 'Please provide a valid company name. Cannot use N/A, NA, or None.'
    }),
  companyWebsite: z.string()
    .max(200)
    .regex(/^(https?:\/\/)?[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}/, 'Invalid website format')
    .optional()
    .nullable()
    .or(z.literal('')), // Allow domain with or without protocol
  emailDomain: z.string()
    .max(100)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/, 'Invalid domain format')
    .optional()
    .nullable()
    .or(z.literal('')) // Allow empty string
});

// =====================================================
// DATABASE-DRIVEN SCORING ENGINE
// =====================================================

// In-memory fallback cache (used when Redis is unavailable)
let inMemoryRulesCache = {
  demographic: [],
  behavioral: [],
  negative: [],
  thresholds: [],
  lastFetched: null
};

const SCORING_RULES_CACHE_KEY = 'system:scoring_rules';
const CACHE_TTL_SECONDS = Math.floor(CACHE_CONFIG.RULES_CACHE_TTL / 1000); // Convert ms to seconds

/**
 * Fetch scoring rules with unified caching strategy
 * Priority: Redis cache -> In-memory cache -> Database
 */
async function fetchScoringRulesFromDB() {
  const now = Date.now();

  // 1. Try Redis cache first
  try {
    const redisCache = await getCache(SCORING_RULES_CACHE_KEY);
    if (redisCache) {
      // Update in-memory fallback
      inMemoryRulesCache = { ...redisCache, lastFetched: now };
      return redisCache;
    }
  } catch (err) {
    // Redis unavailable, continue to fallback
  }

  // 2. Check in-memory cache (fallback when Redis unavailable)
  if (inMemoryRulesCache.lastFetched && (now - inMemoryRulesCache.lastFetched) < CACHE_CONFIG.RULES_CACHE_TTL) {
    return inMemoryRulesCache;
  }

  // 3. Fetch from database
  try {
    const [demographicRes, behavioralRes, negativeRes, thresholdsRes] = await Promise.all([
      supabase.from('scoring_rules_demographic').select('*').eq('is_active', true).order('priority_order'),
      supabase.from('scoring_rules_behavioral').select('*').eq('is_active', true),
      supabase.from('scoring_rules_negative').select('*').eq('is_active', true),
      supabase.from('scoring_thresholds').select('*').eq('is_active', true).order('min_score', { ascending: false })
    ]);

    const rules = {
      demographic: demographicRes.data || [],
      behavioral: behavioralRes.data || [],
      negative: negativeRes.data || [],
      thresholds: thresholdsRes.data || []
    };

    // Update both caches
    inMemoryRulesCache = { ...rules, lastFetched: now };

    // Store in Redis (fire and forget)
    setCache(SCORING_RULES_CACHE_KEY, rules, CACHE_TTL_SECONDS).catch(() => {});

    console.log(`📊 Scoring rules loaded: ${rules.demographic.length} demographic, ${rules.behavioral.length} behavioral, ${rules.negative.length} negative`);

    return rules;
  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    return inMemoryRulesCache; // Return stale cache if fetch fails
  }
}

// Evaluate a condition against a value
function evaluateCondition(value, operator, conditionValue) {
  if (value === null || value === undefined) return false;
  
  const strValue = String(value).toLowerCase();
  const condStr = String(conditionValue).toLowerCase();
  
  switch (operator) {
    case 'equals':
      return strValue === condStr;
    case 'not_equals':
      return strValue !== condStr;
    case 'contains':
      return condStr.split(',').some(v => strValue.includes(v.trim()));
    case 'in':
      return condStr.split(',').map(v => v.trim().toLowerCase()).includes(strValue);
    case 'not_in':
      return !condStr.split(',').map(v => v.trim().toLowerCase()).includes(strValue);
    case 'greater_than':
      return parseFloat(value) > parseFloat(conditionValue);
    case 'less_than':
      return parseFloat(value) < parseFloat(conditionValue);
    case 'between':
      const [min, max] = conditionValue.split(',').map(v => parseFloat(v.trim()));
      const numValue = parseFloat(value);
      return numValue >= min && numValue <= max;
    case 'days_since':
      if (!value) return false;
      const lastDate = new Date(value);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= parseInt(conditionValue);
    default:
      return false;
  }
}

// Calculate lead score using database rules
async function calculateLeadScoreFromDB(lead, activities = []) {
  const rules = await fetchScoringRulesFromDB();
  
  let demographicScore = 0;
  let behavioralScore = 0;
  let negativeScore = 0;
  let matchedRules = [];
  
  // ===== DEMOGRAPHIC SCORING =====
  for (const rule of rules.demographic) {
    let fieldValue = null;
    
    // Map condition_field to lead properties
    switch (rule.condition_field) {
      case 'employee_count':
        fieldValue = lead.employeeCount || lead.companySize;
        // Convert companySize string to number
        if (typeof fieldValue === 'string') {
          const match = fieldValue.match(/\d+/);
          if (match) fieldValue = parseInt(match[0]);
          if (fieldValue === '1001+') fieldValue = 1500;
        }
        break;
      case 'revenue_inr_crore':
        fieldValue = lead.revenueAmount || lead.revenue;
        if (typeof fieldValue === 'string') {
          const match = fieldValue.match(/\d+/);
          if (match) fieldValue = parseFloat(match[0]);
        }
        break;
      case 'industry':
        fieldValue = lead.industry;
        break;
      case 'seniority_level':
      case 'job_title':
        fieldValue = lead.jobTitle || lead.seniority;
        break;
      case 'has_budget_authority':
        fieldValue = lead.authority === 'Final Decision Maker' ? 'true' : 'false';
        break;
      case 'has_technical_authority':
        fieldValue = lead.technicalAuthority ? 'true' : 'false';
        break;
      case 'location_city':
        fieldValue = lead.location;
        break;
      default:
        fieldValue = lead[rule.condition_field];
    }
    
    if (evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value)) {
      demographicScore += rule.points_awarded;
      matchedRules.push({ type: 'demographic', rule: rule.rule_name, points: rule.points_awarded });
    }
  }
  
  // Cap demographic at 50
  demographicScore = Math.min(demographicScore, 50);
  
  // ===== BEHAVIORAL SCORING =====
  const activityCounts = {};
  for (const activity of activities) {
    const key = `${activity.activity_type}:${activity.activity_subtype || ''}`;
    activityCounts[key] = (activityCounts[key] || 0) + 1;
  }
  
  for (const rule of rules.behavioral) {
    const key = `${rule.activity_type}:${rule.activity_subtype || ''}`;
    const count = activityCounts[key] || 0;
    
    if (count > 0) {
      const effectiveCount = rule.max_occurrences ? Math.min(count, rule.max_occurrences) : count;
      let points = rule.base_points * effectiveCount;
      
      // Apply repeat multiplier
      if (effectiveCount > 1 && rule.repeat_multiplier > 1) {
        points = rule.base_points + (rule.base_points * (effectiveCount - 1) * rule.repeat_multiplier);
      }
      
      behavioralScore += Math.floor(points);
      matchedRules.push({ type: 'behavioral', rule: rule.rule_name, points: Math.floor(points), count: effectiveCount });
    }
  }
  
  // Cap behavioral at 100
  behavioralScore = Math.min(behavioralScore, 100);
  
  // ===== NEGATIVE SCORING =====
  for (const rule of rules.negative) {
    let fieldValue = null;
    
    switch (rule.condition_field) {
      case 'last_activity_date':
        fieldValue = lead.lastActivity || lead.last_activity_date;
        break;
      case 'employee_count':
        fieldValue = lead.employeeCount;
        if (typeof fieldValue === 'string') {
          const match = fieldValue.match(/\d+/);
          if (match) fieldValue = parseInt(match[0]);
        }
        break;
      case 'email':
        fieldValue = lead.email;
        break;
      case 'email_status':
        fieldValue = lead.emailStatus || lead.email_status || 'valid';
        break;
      case 'has_budget_authority':
        fieldValue = lead.authority === 'Final Decision Maker' ? 'true' : 'false';
        break;
      default:
        fieldValue = lead[rule.condition_field];
    }
    
    if (evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value)) {
      negativeScore -= rule.points_deducted;
      matchedRules.push({ type: 'negative', rule: rule.rule_name, points: -rule.points_deducted });
    }
  }
  
  // ===== CALCULATE TOTAL =====
  const totalScore = Math.max(0, demographicScore + behavioralScore + negativeScore);
  
  // ===== CLASSIFY LEAD =====
  let classification = 'unqualified';
  for (const threshold of rules.thresholds) {
    if (totalScore >= threshold.min_score && totalScore <= threshold.max_score) {
      classification = threshold.classification_name;
      break;
    }
  }
  
  return {
    totalScore,
    classification,
    breakdown: {
      demographic: demographicScore,
      behavioral: behavioralScore,
      negative: negativeScore
    },
    matchedRules,
    calculatedAt: new Date().toISOString()
  };
}

// Save score to database
async function saveScoreToDB(leadId, scoreData) {
  try {
    // Upsert lead_scores
    const { error: scoreError } = await supabase
      .from('lead_scores')
      .upsert({
        lead_id: leadId,
        demographic_score: scoreData.breakdown.demographic,
        behavioral_score: scoreData.breakdown.behavioral,
        negative_score: scoreData.breakdown.negative,
        total_score: scoreData.totalScore,
        score_classification: scoreData.classification,
        last_calculated_at: scoreData.calculatedAt,
        updated_at: scoreData.calculatedAt
      }, { onConflict: 'lead_id' });
    
    if (scoreError) throw scoreError;
    
    // Insert into score_history
    await supabase
      .from('score_history')
      .insert({
        lead_id: leadId,
        demographic_score: scoreData.breakdown.demographic,
        behavioral_score: scoreData.breakdown.behavioral,
        negative_score: scoreData.breakdown.negative,
        total_score: scoreData.totalScore,
        score_classification: scoreData.classification,
        change_reason: 'Score recalculation'
      });
    
    return true;
  } catch (error) {
    console.error('Error saving score to DB:', error);
    return false;
  }
}

// =====================================================
// API ROUTES
// =====================================================

// Authentication routes (with rate limiting)
app.use('/api/auth', authLimiter, authRoutes);

// Multi-tenant tracking routes (Steps 37-48)
app.use('/api/v1', trackingRoutes);

// Multi-tenant lead management routes (Steps 58-60)
app.use('/api/v1', tenantLeadsRoutes);

// Multi-tenant management routes (Steps 61-83)
app.use('/api/v1', tenantManagementRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Lead Scoring API',
    version: '1.0.0',
    features: {
      authentication: 'enabled',
      rateLimit: 'enabled',
      inputValidation: 'enabled',
      errorHandling: 'enabled'
    }
  });
});

// Get all leads from Supabase (Protected - requires authentication)
// Supports pagination with ?page=1&limit=50 (max 100)
app.get('/api/leads', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Fetch leads with related data and pre-joined scores (fixes N+1 query)
    const { data: leads, error, count } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(first_name, last_name, email, phone, job_title, has_budget_authority),
        company:companies(company_name, industry, company_size, employee_count, annual_revenue, revenue_inr_crore, location_city, location),
        score:lead_scores(total_score, demographic_score, behavioral_score, negative_score, score_classification, last_calculated_at)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Transform leads using pre-joined scores (no N+1 queries)
    const transformedLeads = leads.map((lead) => {
      const fullName = lead.contact
        ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim()
        : 'N/A';

      // Get pre-calculated score from lead_scores table
      const scoreData = lead.score?.[0] || {};

      return {
        id: lead.lead_id,
        name: fullName || 'N/A',
        email: lead.contact?.email || 'N/A',
        phone: lead.contact?.phone || '',
        company: lead.company?.company_name || 'N/A',
        jobTitle: lead.contact?.job_title || '',
        industry: lead.company?.industry || '',
        companySize: lead.company?.company_size || '',
        employeeCount: lead.company?.employee_count || 0,
        revenue: lead.company?.annual_revenue || '',
        revenueAmount: lead.company?.revenue_inr_crore || 0,
        location: lead.company?.location_city || lead.company?.location || '',
        authority: lead.contact?.has_budget_authority ? 'Final Decision Maker' : '',
        source: lead.lead_source || '',
        campaign: lead.campaign_id || '',
        createdAt: lead.created_at,
        lastActivity: lead.last_activity_date || lead.created_at,
        score: scoreData.total_score || 0,
        classification: scoreData.score_classification || 'unqualified',
        scoreBreakdown: {
          demographic: scoreData.demographic_score || 0,
          behavioral: scoreData.behavioral_score || 0,
          negative: scoreData.negative_score || 0
        },
        lastScoreUpdate: scoreData.last_calculated_at || null
      };
    });

    // Sort by score (highest first)
    const sortedLeads = transformedLeads.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      leads: sortedLeads,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + leads.length < (count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead by ID (Protected)
app.get('/api/leads/:id', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `)
      .eq('lead_id', req.params.id)
      .single();

    if (error) throw error;
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const transformedLead = {
      id: lead.lead_id,
      name: (lead.contact ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim() : '') || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      companySize: lead.company?.company_size || '',
      employeeCount: lead.company?.employee_count || 0,
      revenue: lead.company?.annual_revenue || '',
      revenueAmount: lead.company?.revenue_inr_crore || 0,
      location: lead.company?.location_city || lead.company?.location || '',
      authority: lead.contact?.has_budget_authority ? 'Final Decision Maker' : '',
      source: lead.lead_source || '',
      campaign: lead.campaign_id || '',
      createdAt: lead.created_at,
      lastActivity: lead.last_activity_date || lead.created_at,
      activities: lead.activities || []
    };

    // Use database-driven scoring
    const scoring = await calculateLeadScoreFromDB(transformedLead, lead.activities || []);
    
    res.json({
      ...transformedLead,
      score: scoring.totalScore,
      classification: scoring.classification,
      scoreBreakdown: scoring.breakdown,
      matchedRules: scoring.matchedRules,
      lastScoreUpdate: scoring.calculatedAt
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Update lead (Protected - Admin/Sales only)
app.put('/api/leads/:id', authenticateToken, authorizeRole('admin', 'sales'), async (req, res) => {
  try {
    // Validate input
    const validationResult = updateLeadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validationResult.error.errors
      });
    }

    const leadId = parseInt(req.params.id);
    
    // Fetch the current lead data
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `)
      .eq('lead_id', leadId)
      .single();
    
    if (fetchError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const transformedLead = {
      id: lead.lead_id,
      name: (lead.contact ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim() : '') || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      companySize: lead.company?.company_size || '',
      employeeCount: lead.company?.employee_count || 0,
      revenue: lead.company?.annual_revenue || '',
      revenueAmount: lead.company?.revenue_inr_crore || 0,
      location: lead.company?.location_city || lead.company?.location || '',
      authority: lead.contact?.has_budget_authority ? 'Final Decision Maker' : '',
      source: lead.lead_source || '',
      campaign: lead.campaign_id || '',
      createdAt: lead.created_at,
      lastActivity: new Date().toISOString(),
      activities: lead.activities || [],
      ...req.body
    };

    // Use database-driven scoring
    const scoring = await calculateLeadScoreFromDB(transformedLead, lead.activities || []);
    
    // Save score to DB
    await saveScoreToDB(leadId, scoring);
    
    res.json({
      ...transformedLead,
      score: scoring.totalScore,
      classification: scoring.classification,
      scoreBreakdown: scoring.breakdown,
      lastScoreUpdate: scoring.calculatedAt
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get scoring rules from database (Protected)
app.get('/api/scoring-rules', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    const rules = await fetchScoringRulesFromDB();
    res.json({
      demographic: rules.demographic,
      behavioral: rules.behavioral,
      negative: rules.negative,
      thresholds: rules.thresholds,
      cachedAt: inMemoryRulesCache.lastFetched
    });
  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    res.status(500).json({ error: 'Failed to fetch scoring rules' });
  }
});

// Track lead activity and recalculate score (Public - allows anonymous tracking)
app.post('/api/track-activity', activityLimiter, optionalAuth, async (req, res) => {
  try {
    // Validate input
    const validationResult = trackActivitySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validationResult.error.errors
      });
    }

    const { leadId, activityType, activitySubtype, metadata } = validationResult.data;

    // First, get the lead to find the tenant_id
    const { data: leadData, error: leadFetchError } = await supabase
      .from('leads')
      .select('lead_id, tenant_id, contact_id')
      .eq('lead_id', leadId)
      .single();

    if (leadFetchError || !leadData) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get points for this activity type from behavioral rules
    let ruleQuery = supabase
      .from('scoring_rules_behavioral')
      .select('base_points, rule_name')
      .eq('activity_type', activityType)
      .eq('is_active', true);

    // Only filter by subtype if provided
    if (activitySubtype) {
      ruleQuery = ruleQuery.eq('activity_subtype', activitySubtype);
    }

    const { data: rule, error: ruleError } = await ruleQuery.single();

    console.log(`📊 Rule lookup for ${activityType}/${activitySubtype}:`, rule, ruleError?.message);

    const pointsEarned = rule?.base_points || 0;

    // Insert activity into database with correct column names
    const { data: activity, error: activityError } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        tenant_id: leadData.tenant_id,
        contact_id: leadData.contact_id,
        activity_type: activityType,
        activity_subtype: activitySubtype || null,
        activity_title: metadata?.title || rule?.rule_name || `${activityType} - ${activitySubtype || 'general'}`,
        activity_details: metadata || {},
        activity_source: metadata?.source || 'simulator',
        points_earned: pointsEarned,
        activity_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (activityError) {
      console.error('❌ Activity insert error:', activityError);
      throw activityError;
    }

    console.log('✅ Activity inserted:', activity);

    // Log activity
    logActivity(leadId, activityType, { activitySubtype, metadata });

    // Update lead's last_activity_date
    await supabase
      .from('leads')
      .update({ last_activity_date: new Date().toISOString() })
      .eq('lead_id', leadId);
    
    // Fetch lead with all activities for rescoring
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `)
      .eq('lead_id', leadId)
      .single();
    
    if (leadError) throw leadError;
    
    const transformedLead = {
      id: lead.lead_id,
      name: (lead.contact ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim() : '') || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      companySize: lead.company?.company_size || '',
      employeeCount: lead.company?.employee_count || 0,
      revenue: lead.company?.annual_revenue || '',
      revenueAmount: lead.company?.revenue_inr_crore || 0,
      location: lead.company?.location_city || lead.company?.location || '',
      authority: lead.contact?.has_budget_authority ? 'Final Decision Maker' : '',
      source: lead.lead_source || '',
      campaign: lead.campaign_id || '',
      createdAt: lead.created_at,
      lastActivity: new Date().toISOString(),
      activities: lead.activities || []
    };
    
    // Recalculate score
    const scoring = await calculateLeadScoreFromDB(transformedLead, lead.activities || []);
    
    // Save updated score to DB
    await saveScoreToDB(leadId, scoring);
    
    res.json({
      success: true,
      activity: activity,
      pointsEarned: activity.points_earned || 0,
      newScore: scoring.totalScore,
      classification: scoring.classification,
      breakdown: scoring.breakdown,
      lastScoreUpdate: scoring.calculatedAt
    });
  } catch (error) {
    logError(error, { endpoint: '/api/track-activity', leadId: req.body.leadId });
    console.error('Track activity error:', error);
    res.status(500).json({ error: 'Failed to track activity', details: error.message });
  }
});

// Force recalculate score for a lead (Protected - Admin/Sales only)
app.post('/api/recalculate-score/:leadId', authenticateToken, authorizeRole('admin', 'sales'), async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId);
    
    // Fetch lead with all data
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `)
      .eq('lead_id', leadId)
      .single();
    
    if (error || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const transformedLead = {
      id: lead.lead_id,
      name: (lead.contact ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim() : '') || 'N/A',
      email: lead.contact?.email || 'N/A',
      phone: lead.contact?.phone || '',
      company: lead.company?.company_name || 'N/A',
      jobTitle: lead.contact?.job_title || '',
      industry: lead.company?.industry || '',
      companySize: lead.company?.company_size || '',
      employeeCount: lead.company?.employee_count || 0,
      revenue: lead.company?.annual_revenue || '',
      revenueAmount: lead.company?.revenue_inr_crore || 0,
      location: lead.company?.location_city || lead.company?.location || '',
      authority: lead.contact?.has_budget_authority ? 'Final Decision Maker' : '',
      source: lead.lead_source || '',
      campaign: lead.campaign_id || '',
      createdAt: lead.created_at,
      lastActivity: lead.last_activity_date || lead.created_at,
      activities: lead.activities || []
    };
    
    // Recalculate score
    const scoring = await calculateLeadScoreFromDB(transformedLead, lead.activities || []);
    
    // Save to DB
    await saveScoreToDB(leadId, scoring);
    
    res.json({
      success: true,
      leadId: leadId,
      score: scoring.totalScore,
      classification: scoring.classification,
      breakdown: scoring.breakdown,
      matchedRules: scoring.matchedRules,
      lastScoreUpdate: scoring.calculatedAt
    });
  } catch (error) {
    console.error('Error recalculating score:', error);
    res.status(500).json({ error: 'Failed to recalculate score' });
  }
});

// Get lead activities (Protected)
app.get('/api/leads/:id/activities', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    const { data: activities, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(activities || []);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get score history for a lead (Protected)
app.get('/api/leads/:id/score-history', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    const { data: history, error } = await supabase
      .from('score_history')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('calculated_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    res.json(history || []);
  } catch (error) {
    console.error('Error fetching score history:', error);
    res.status(500).json({ error: 'Failed to fetch score history' });
  }
});

// Refresh scoring rules cache (Protected - Admin only)
app.post('/api/scoring-rules/refresh', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Clear cache
    inMemoryRulesCache.demographic = [];
    inMemoryRulesCache.behavioral = [];
    inMemoryRulesCache.negative = [];
    inMemoryRulesCache.thresholds = [];
    inMemoryRulesCache.lastFetched = null;
    
    // Fetch fresh rules
    const rules = await fetchScoringRulesFromDB();
    
    res.json({
      success: true,
      message: 'Scoring rules cache refreshed',
      rulesCount: {
        demographic: rules.demographic.length,
        behavioral: rules.behavioral.length,
        negative: rules.negative.length,
        thresholds: rules.thresholds.length
      },
      cachedAt: inMemoryRulesCache.lastFetched
    });
  } catch (error) {
    console.error('Error refreshing rules:', error);
    res.status(500).json({ error: 'Failed to refresh scoring rules' });
  }
});

// Flexible authentication middleware - accepts either JWT or API Key
const authenticateFlexible = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  
  // Try JWT authentication first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  }
  
  // Fall back to API Key authentication
  if (apiKey) {
    return authenticateTenant(req, res, next);
  }
  
  return res.status(401).json({
    error: 'Authentication required. Provide either JWT token or API key.',
    code: 'UNAUTHORIZED'
  });
};

// Company Research using Groq AI with Tavily Real-Time Search (Protected - Admin/Sales or API Key)
app.post('/api/company-research', researchLimiter, authenticateFlexible, async (req, res) => {
  try {
    // Log the incoming request for debugging
    console.log('📥 Company research request body:', JSON.stringify(req.body, null, 2));

    // Validate input
    const validationResult = companyResearchSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('❌ Validation failed:', JSON.stringify(validationResult.error.errors, null, 2));
      return res.status(400).json({
        error: 'Invalid input data',
        message: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        details: validationResult.error.errors
      });
    }

    const { companyName, companyWebsite, emailDomain } = validationResult.data;

    // Check if Groq API key is configured
    if (!process.env.GROQ_API_KEY) {
      return res.status(400).json({
        error: 'Groq API key not configured. Please add GROQ_API_KEY to your .env file'
      });
    }

    // Step 1: Enhanced multi-query search for complete company data
    console.log(`🔍 Searching comprehensive data for: ${companyName}`);
    let searchContext = '';
    let hasSearchAPI = false;
    
    try {
      const searchPromises = [];
      
      // Serper (Google Search) - Multiple targeted queries for complete data
      if (process.env.SERPER_API_KEY) {
        hasSearchAPI = true;
        
        // Query 1: Company basics
        searchPromises.push(
          searchWithSerper(`${companyName} company founded headquarters location about`)
            .then(result => ({
              source: 'Google - Basics',
              snippets: result.organic?.slice(0, 8).map(r => `${r.title}: ${r.snippet}`).join('\n') || '',
              knowledgeGraph: result.knowledgeGraph ? 
                `Company: ${result.knowledgeGraph.title || ''}, Description: ${result.knowledgeGraph.description || ''}, Type: ${result.knowledgeGraph.type || ''}` : ''
            }))
            .catch(() => ({ source: 'Google - Basics', snippets: '', knowledgeGraph: '' }))
        );
        
        // Query 2: Leadership & team
        searchPromises.push(
          searchWithSerper(`${companyName} CEO founder leadership team executives`)
            .then(result => ({
              source: 'Google - Leadership',
              snippets: result.organic?.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n') || ''
            }))
            .catch(() => ({ source: 'Google - Leadership', snippets: '' }))
        );
        
        // Query 3: Funding & financials
        searchPromises.push(
          searchWithSerper(`${companyName} funding raised investors valuation revenue`)
            .then(result => ({
              source: 'Google - Financials',
              snippets: result.organic?.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n') || ''
            }))
            .catch(() => ({ source: 'Google - Financials', snippets: '' }))
        );
        
        // Query 4: Products & technology
        searchPromises.push(
          searchWithSerper(`${companyName} products services technology stack features`)
            .then(result => ({
              source: 'Google - Products',
              snippets: result.organic?.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n') || ''
            }))
            .catch(() => ({ source: 'Google - Products', snippets: '' }))
        );
        
        // Query 5: News & press
        searchPromises.push(
          searchWithSerper(`${companyName} news press releases recent updates announcements`)
            .then(result => ({
              source: 'Google - News',
              snippets: result.organic?.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n') || ''
            }))
            .catch(() => ({ source: 'Google - News', snippets: '' }))
        );
        
        // Query 6: Hiring & jobs
        searchPromises.push(
          searchWithSerper(`${companyName} careers jobs hiring open positions`)
            .then(result => ({
              source: 'Google - Hiring',
              snippets: result.organic?.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n') || ''
            }))
            .catch(() => ({ source: 'Google - Hiring', snippets: '' }))
        );
      }
      
      // Tavily Search - OPTIONAL for enhanced data
      if (process.env.TAVILY_API_KEY) {
        hasSearchAPI = true;
        const tavilyQuery = `${companyName} company profile latest information`;
        searchPromises.push(
          tvly.search(tavilyQuery, { maxResults: 3, searchDepth: 'basic', includeAnswer: true })
            .then(result => ({
              source: 'Tavily',
              answer: result.answer || '',
              snippets: result.results?.slice(0, 3).map(r => r.content).join('\n') || ''
            }))
            .catch(() => ({ source: 'Tavily', answer: '', snippets: '' }))
        );
      }
      
      if (hasSearchAPI) {
        const searchResults = await Promise.all(searchPromises);
        
        // Compile all search results with clear categorization
        searchContext = searchResults.map((result) => {
          let section = `\n=== ${result.source} ===\n`;
          if (result.knowledgeGraph) {
            section += `KNOWLEDGE GRAPH:\n${result.knowledgeGraph}\n\n`;
          }
          if (result.answer) {
            section += `AI SUMMARY:\n${result.answer}\n\n`;
          }
          if (result.snippets) {
            section += `WEB RESULTS:\n${result.snippets}`;
          }
          return section;
        }).filter(r => r.length > 50).join('\n\n');
        
        console.log(`✅ Enhanced search completed with ${searchResults.length} queries`);
      } else {
        console.log('💡 Running in AI-only mode (no search APIs configured - costs reduced)');
        searchContext = `Limited data available. Use general business knowledge about: ${companyName}\n${companyWebsite ? `Website: ${companyWebsite}` : ''}\n${emailDomain ? `Email domain: ${emailDomain}` : ''}`;
      }
    } catch (searchError) {
      console.warn('⚠️ Search failed, using AI knowledge only:', searchError.message);
      searchContext = `No real-time data available. Research ${companyName} using general knowledge.\n${companyWebsite ? `Website: ${companyWebsite}` : ''}\n${emailDomain ? `Email domain: ${emailDomain}` : ''}`;
    }

    // Step 2: Build the AI prompt with enhanced search context
    const prompt = `You are a Professional Company Research AI Agent with access to real-time web search data.

Your task is to generate a COMPLETE, FACTUAL, and DATA-RICH Company Research Report using the comprehensive search results provided below.

=== REAL-TIME SEARCH RESULTS (PRIMARY DATA SOURCE) ===
${searchContext}
=== END OF SEARCH RESULTS ===

CRITICAL INSTRUCTIONS (MUST FOLLOW):

DATA EXTRACTION & INFERENCE RULES:
✅ EXTRACT ALL data from search results first - this is your primary source
✅ Use knowledge graph data when available (most reliable)
✅ Cross-reference multiple snippets to verify facts
✅ INFER intelligently from context:
   • "celebrating 10 years in 2023" = founded 2013
   • "raised Series A" = Startup stage
   • "based in NYC" or email domain location = Headquarters
   • News about "hiring engineers" = Engineering department hiring
   • "launched new product" = key milestone in timeline
   • Company domain age can be estimated from earliest web mentions
   • Competitors can be inferred from industry + target market
✅ Extract names: CEO, founders, executives from any mention in search results
✅ Technology stack: Infer from job postings, blog posts, or product descriptions
✅ Web traffic: If startup with funding, estimate "Growing" trend; if no recent news, "Stable"
✅ For SWOT: Always complete based on available data + industry knowledge
✅ Timeline: Build from funding rounds, product launches, and news mentions

SMART DEFAULTS (Use when partial data exists):
✅ Founded Year: If funding round known (e.g., "Seed 2023"), estimate founded 2022-2023
✅ Key People: Check search results for ANY name mentions (co-founder, CEO, team)
✅ Competitors: Research similar companies in same industry/geography
✅ Remote vs On-site: For tech startups, typically "Hybrid (60% remote)" unless stated
✅ Domain Age: Estimate from company founded year (same or 1 year earlier)
✅ Traffic Trend: Funded startup = "Growing", established company = "Stable"

ABSOLUTE RULES:
❌ NEVER write "Not publicly available" without thoroughly checking search results first
❌ Do NOT hallucinate specific numbers (revenue, exact metrics) if not in search results
❌ Do NOT include URLs, citations, or "according to..." phrases
❌ Do NOT mention your research process
✅ Only use "Not publicly available" for: exact revenue, exact traffic numbers, specific internal data
✅ For public companies, funding = "Not applicable (public company)"
✅ Keep language professional, analytical, and concise (2-4 points per section)

INPUT CONTEXT:
- Company Name: ${companyName}
${companyWebsite ? `- Company Website: ${companyWebsite}` : ''}
${emailDomain ? `- Email Domain: ${emailDomain}` : ''}

⚠️ CRITICAL: Generate EXACTLY these 9 sections in this EXACT order. DO NOT add, remove, or rename sections. DO NOT generate duplicate sections.

REQUIRED OUTPUT FORMAT (EXACTLY 9 SECTIONS - NO MORE, NO LESS):

[SECTION:Company Overview]
- Company Name:
- Founded Year:
- Headquarters:
- Industry / Domain:
- Company Type (Startup / SME / Enterprise / Public):
- Website:
- Brief Description (2–3 lines):

[SECTION:Product Summary]
- Core Products/Services:
- Product Categories:
- Unique Selling Points:
- Target Users:

[SECTION:Financial Information]
- Funding Status:
- Total Funding Raised:
- Latest Funding Round:
- Key Investors:
- Revenue Estimate:
- Profitability Status:

[SECTION:Key People]
- Founders:
- CEO/MD:
- Key Executives:
- Board Members:
- Notable Team Members:

[SECTION:Competitors]
- Direct Competitors:
- Indirect Competitors:
- Competitive Advantages:
- Market Differentiation:

[SECTION:Technology & Digital Presence]
- Website Quality:
- Mobile App Availability:
- Digital Channels:
- Online Reputation:

[SECTION:Recent News & Press]
- Latest News Headlines:
- Press Releases:
- Media Mentions:
- Industry Recognition:

[SECTION:SWOT Analysis]
- Strengths:
- Weaknesses:
- Opportunities:
[SECTION:SWOT Analysis]
- Strengths:
- Weaknesses:
- Opportunities:
- Threats:

[SECTION:Final Summary]
(2-3 paragraph executive summary of the company, its market position, growth trajectory, and key insights for sales teams)

⚠️ END OF REQUIRED SECTIONS - DO NOT ADD ANY MORE SECTIONS AFTER THIS

Generate the report now following the exact format above:`;


    // Call Groq via LangChain
    const response = await llm.invoke([
      new HumanMessage(prompt)
    ]);
    const report = response.content;

    res.json({
      companyName,
      report,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Company Research Error:', error);
    res.status(500).json({
      error: 'Failed to generate company research',
      details: error.message
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logError(err, { url: req.url, method: req.method });

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

app.listen(PORT, async () => {
  logger.info(`🚀 Lead Scoring API Server running on http://localhost:${PORT}`);
  logger.info(`🗄️  Connected to Supabase Database`);
  logger.info(`🔒 Authentication: JWT-based with role authorization`);
  logger.info(`✅ Scoring engine: RULE-BASED (Database-driven)`);
  logger.info(`🛡️  Security: Input validation, CORS, rate limiting ready`);
  logger.info(`📝 Logging: Winston logger with file rotation enabled`);

  // Step 136: Initialize Redis cache
  try {
    await initializeCache();
    logger.info(`📦 Redis cache initialized successfully`);
  } catch (error) {
    logger.warn(`⚠️  Redis cache initialization failed: ${error.message}`);
    logger.info(`📦 Continuing without cache...`);
  }

  if (process.env.BYPASS_AUTH === 'true') {
    logger.warn(`⚠️  WARNING: Authentication bypass is ENABLED! (BYPASS_AUTH=true)`);
    logger.warn(`⚠️  This should ONLY be used in development. NEVER in production!`);
  }

  // Start momentum decay background job (runs every hour)
  if (process.env.MOMENTUM_DECAY_ENABLED !== 'false') {
    const decayIntervalMs = parseInt(process.env.MOMENTUM_DECAY_INTERVAL_MS) || 60 * 60 * 1000;
    startMomentumDecayScheduler(decayIntervalMs);
    logger.info(`⏰ Momentum decay job scheduled (interval: ${decayIntervalMs / 1000 / 60} minutes)`);
  }

  // Get lead count from database
  try {
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    logger.info(`📊 Total leads in database: ${count || 0}`);
  } catch (error) {
    logger.error(`⚠️  Could not fetch lead count: ${error.message}`);
  }
});

// Graceful shutdown - close Redis connection
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');
  await closeCache();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down gracefully...');
  await closeCache();
  process.exit(0);
});
