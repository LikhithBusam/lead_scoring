import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage } from '@langchain/core/messages';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import { authenticateToken, authorizeRole, optionalAuth } from './middleware/auth.js';
import { apiLimiter, activityLimiter, researchLimiter, authLimiter } from './middleware/rateLimit.js';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import trackingRoutes from './routes/tracking.js';
import tenantLeadsRoutes from './routes/tenantLeads.js';
import tenantManagementRoutes from './routes/tenantManagement.js';
import logger, { requestLogger, logActivity, logSecurityEvent, logError } from './utils/logger.js';
import { initializeCache, closeCache } from './utils/cache.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

// Initialize Tavily for real-time web search
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

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

// Serve tracking plugin as static file
app.use('/tracking-plugin', express.static(path.join(__dirname, '..', 'tracking-plugin')));

// Request logging
app.use(requestLogger);

// Apply global rate limiting to all API routes
app.use('/api/', apiLimiter);

// Input validation schemas
const trackActivitySchema = z.object({
  leadId: z.number().int().positive(),
  activityType: z.string().min(1).max(100),
  activitySubtype: z.string().max(100).optional(),
  metadata: z.record(z.any()).optional()
});

const updateLeadSchema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  companySize: z.string().max(50).optional(),
  location: z.string().max(255).optional()
});

const companyResearchSchema = z.object({
  companyName: z.string().min(1).max(500),
  companyWebsite: z.string().optional().nullable(),
  emailDomain: z.string().max(255).optional().nullable()
});

// =====================================================
// DATABASE-DRIVEN SCORING ENGINE
// =====================================================

// Cache for scoring rules (refreshed every 5 minutes)
let scoringRulesCache = {
  demographic: [],
  behavioral: [],
  negative: [],
  thresholds: [],
  lastFetched: null
};

// Fetch scoring rules from database
async function fetchScoringRulesFromDB() {
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Return cached if still valid
  if (scoringRulesCache.lastFetched && (now - scoringRulesCache.lastFetched) < CACHE_TTL) {
    return scoringRulesCache;
  }
  
  try {
    // Fetch all rules in parallel
    const [demographicRes, behavioralRes, negativeRes, thresholdsRes] = await Promise.all([
      supabase.from('scoring_rules_demographic').select('*').eq('is_active', true).order('priority_order'),
      supabase.from('scoring_rules_behavioral').select('*').eq('is_active', true),
      supabase.from('scoring_rules_negative').select('*').eq('is_active', true),
      supabase.from('scoring_thresholds').select('*').eq('is_active', true).order('min_score', { ascending: false })
    ]);
    
    scoringRulesCache = {
      demographic: demographicRes.data || [],
      behavioral: behavioralRes.data || [],
      negative: negativeRes.data || [],
      thresholds: thresholdsRes.data || [],
      lastFetched: now
    };
    
    console.log(`📊 Scoring rules loaded: ${scoringRulesCache.demographic.length} demographic, ${scoringRulesCache.behavioral.length} behavioral, ${scoringRulesCache.negative.length} negative`);
    
    return scoringRulesCache;
  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    return scoringRulesCache; // Return stale cache if fetch fails
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
app.get('/api/leads', authenticateToken, authorizeRole('admin', 'sales', 'user'), async (req, res) => {
  try {
    // Fetch leads with related data
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        activities:lead_activities(*)
      `);

    if (error) throw error;

    // Transform and calculate scores for each lead
    const leadsWithScores = await Promise.all(leads.map(async (lead) => {
      const fullName = lead.contact
        ? `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim()
        : 'N/A';

      const transformedLead = {
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
        activities: lead.activities || []
      };

      // Use database-driven scoring
      const scoring = await calculateLeadScoreFromDB(transformedLead, lead.activities || []);
      
      return {
        ...transformedLead,
        score: scoring.totalScore,
        classification: scoring.classification,
        scoreBreakdown: scoring.breakdown,
        lastScoreUpdate: scoring.calculatedAt
      };
    }));

    // Sort by score (highest first)
    const sortedLeads = leadsWithScores.sort((a, b) => b.score - a.score);
    res.json(sortedLeads);
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
      cachedAt: scoringRulesCache.lastFetch
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
    
    // Insert activity into database
    const { data: activity, error: activityError } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        activity_type: activityType,
        activity_subtype: activitySubtype || null,
        activity_details: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (activityError) throw activityError;

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
      newScore: scoring.totalScore,
      classification: scoring.classification,
      breakdown: scoring.breakdown,
      lastScoreUpdate: scoring.calculatedAt
    });
  } catch (error) {
    logError(error, { endpoint: '/api/track-activity', leadId: req.body.leadId });
    res.status(500).json({ error: 'Failed to track activity' });
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
    scoringRulesCache.rules = null;
    scoringRulesCache.lastFetch = null;
    
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
      cachedAt: scoringRulesCache.lastFetch
    });
  } catch (error) {
    console.error('Error refreshing rules:', error);
    res.status(500).json({ error: 'Failed to refresh scoring rules' });
  }
});

// Company Research using Groq AI with Tavily Real-Time Search (Protected - Admin/Sales only)
app.post('/api/company-research', researchLimiter, authenticateToken, authorizeRole('admin', 'sales'), async (req, res) => {
  try {
    // Log the incoming request for debugging
    console.log('📥 Company research request body:', JSON.stringify(req.body, null, 2));

    // Validate input
    const validationResult = companyResearchSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('❌ Validation failed:', JSON.stringify(validationResult.error.errors, null, 2));
      return res.status(400).json({
        error: 'Invalid input data',
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

    // Step 1: Use both Serper (Google) and Tavily for comprehensive real-time data
    console.log(`🔍 Searching real-time data for: ${companyName}`);
    let searchContext = '';
    
    try {
      const searchPromises = [];
      
      // Serper (Google Search) - More accurate for company data
      if (process.env.SERPER_API_KEY) {
        const serperQueries = [
          `${companyName} company overview headquarters founded`,
          `${companyName} funding raised investors valuation`,
          `${companyName} CEO founder leadership team`,
          `${companyName} revenue employees business model`,
          `${companyName} competitors industry market share`
        ];
        
        serperQueries.forEach(query => {
          searchPromises.push(
            searchWithSerper(query)
              .then(result => ({
                source: 'Google',
                query,
                snippets: result.organic?.map(r => `${r.title}: ${r.snippet}`).join('\n') || '',
                knowledgeGraph: result.knowledgeGraph ? 
                  `Company: ${result.knowledgeGraph.title || ''}, Description: ${result.knowledgeGraph.description || ''}, Type: ${result.knowledgeGraph.type || ''}` : ''
              }))
              .catch(() => ({ source: 'Google', query, snippets: '', knowledgeGraph: '' }))
          );
        });
      }
      
      // Tavily Search - Good for detailed content
      if (process.env.TAVILY_API_KEY) {
        const tavilyQueries = [
          `${companyName} company profile funding revenue`,
          `${companyName} latest news updates 2024 2025`
        ];
        
        tavilyQueries.forEach(query => {
          searchPromises.push(
            tvly.search(query, { maxResults: 5, searchDepth: 'advanced', includeAnswer: true })
              .then(result => ({
                source: 'Tavily',
                query,
                answer: result.answer || '',
                snippets: result.results?.map(r => r.content).join('\n') || ''
              }))
              .catch(() => ({ source: 'Tavily', query, answer: '', snippets: '' }))
          );
        });
      }
      
      const searchResults = await Promise.all(searchPromises);
      
      // Compile all search results
      searchContext = searchResults.map((result, idx) => {
        if (result.source === 'Google') {
          return `--- Google Search ${idx + 1} ---\n${result.knowledgeGraph}\n${result.snippets}`;
        } else {
          return `--- Tavily Search ---\nAnswer: ${result.answer}\n${result.snippets}`;
        }
      }).join('\n\n');
      
      console.log(`✅ Real-time search completed for: ${companyName}`);
    } catch (searchError) {
      console.warn('⚠️ Search failed, using LLM knowledge:', searchError.message);
      searchContext = 'Real-time search unavailable. Use general knowledge only.';
    }

    // Step 2: Build the prompt with real-time context
    const prompt = `You are a Professional Company Research AI Agent.

Your task is to generate a structured, factual, and concise Company Research Report using the REAL-TIME SEARCH RESULTS provided below, combined with your general business knowledge.

=== REAL-TIME SEARCH RESULTS (USE THIS DATA) ===
${searchContext}
=== END OF SEARCH RESULTS ===

STRICT RULES (MANDATORY):
❌ Do NOT hallucinate facts, numbers, funding, revenue, or clients
❌ Do NOT invent financial figures or internal data
❌ Do NOT include investment advice
❌ Do NOT mention how you found information (no reasoning leaks)
❌ Do NOT include URLs, sources, or citations
✅ Use the real-time search data above to fill in accurate information
✅ If data is still unknown after search, write exactly: "Not publicly available"
✅ If company is public, funding rounds must be written as "Not applicable (public company)"
✅ If company is private, funding info may be "Not publicly available" unless found in search
✅ Use cautious, professional language
✅ Keep tone neutral, analytical, executive-ready
❌ Do NOT add or remove sections from the format

INPUT:
- Company Name: ${companyName}
${companyWebsite ? `- Company Website: ${companyWebsite}` : ''}
${emailDomain ? `- Email Domain: ${emailDomain}` : ''}

OUTPUT FORMAT (MUST MATCH EXACTLY - USE THESE SECTION HEADERS):

[SECTION:Company Overview]
- Company Name:
- Founded Year:
- Headquarters:
- Industry / Domain:
- Company Type (Startup / SME / Enterprise / Public):
- Website:
- Brief Description (2–3 lines):

[SECTION:Visual Timeline]
- Key Milestones:
- Major Events by Year:
- Growth Timeline:

[SECTION:Product Summary]
- Core Products/Services:
- Product Categories:
- Unique Selling Points:
- Target Users:

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

[SECTION:Technology Used]
- Frontend Technologies:
- Backend Technologies:
- Cloud/Infrastructure:
- AI/ML Tools:
- Analytics Tools:

[SECTION:Search Keyword Analysis]
- Top Branded Keywords:
- Industry Keywords:
- SEO Performance:
- Search Visibility:

[SECTION:Hiring & Openings]
- Current Job Openings:
- Departments Hiring:
- Hiring Locations:
- Growth Signals from Hiring:

[SECTION:Financial Information]
- Funding Status:
- Total Funding Raised:
- Latest Funding Round:
- Key Investors:
- Revenue Estimate:
- Profitability Status:

[SECTION:Job Opening Trends]
- Historical Hiring Trends:
- Peak Hiring Periods:
- Role Categories in Demand:
- Remote vs On-site Ratio:

[SECTION:Web Traffic]
- Monthly Visitors Estimate:
- Traffic Trend (Growing/Stable/Declining):
- Top Traffic Sources:
- Geographic Distribution:

[SECTION:Key People]
- Founders:
- CEO/MD:
- Key Executives:
- Board Members:
- Notable Team Members:

[SECTION:Recent News & Press]
- Latest News Headlines:
- Press Releases:
- Media Mentions:
- Industry Recognition:

[SECTION:Website Changes]
- Recent Website Updates:
- New Features Added:
- Design Changes:
- Content Updates:

[SECTION:Acquisitions]
- Companies Acquired:
- Acquisition Timeline:
- Strategic Rationale:
- Integration Status:

[SECTION:Domains]
- Primary Domain:
- Secondary Domains:
- Domain Age:
- Related Properties:

[SECTION:SWOT Analysis]
- Strengths:
- Weaknesses:
- Opportunities:
- Threats:

[SECTION:Final Summary]
Provide a short executive-style conclusion summarizing company maturity, growth trajectory, and partnership readiness.

Generate the report now:`;

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
