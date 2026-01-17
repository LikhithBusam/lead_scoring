/**
 * Step 131: Redis Caching Utility
 * Provides caching layer for frequently accessed data like tenant configuration,
 * scoring rules, and page configurations
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS) || 600; // Default 10 minutes

// Cache key prefixes
export const CACHE_KEYS = {
  TENANT_CONFIG: 'tenant:config',
  SCORING_RULES: 'tenant:scoring_rules',
  PAGE_CONFIG: 'tenant:page_config',
  CTA_CONFIG: 'tenant:cta_config',
  WEBSITE_CONFIG: 'tenant:website_config',
  TENANT_SETTINGS: 'tenant:settings'
};

// Cache statistics for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0
};

// Redis client instance
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export async function initializeCache() {
  if (!REDIS_ENABLED) {
    console.log('📦 Redis caching is disabled');
    return null;
  }

  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB) || 0
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      cacheStats.errors++;
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    console.log('📦 Continuing without cache...');
    return null;
  }
}

/**
 * Check if cache is available
 */
function isCacheAvailable() {
  return REDIS_ENABLED && redisClient && isConnected;
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
export async function getCache(key) {
  if (!isCacheAvailable()) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      cacheStats.hits++;
      return JSON.parse(value);
    }
    cacheStats.misses++;
    return null;
  } catch (error) {
    console.error(`❌ Cache GET error for key ${key}:`, error.message);
    cacheStats.errors++;
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional, defaults to CACHE_TTL_SECONDS)
 */
export async function setCache(key, value, ttl = CACHE_TTL_SECONDS) {
  if (!isCacheAvailable()) {
    return;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    cacheStats.sets++;
  } catch (error) {
    console.error(`❌ Cache SET error for key ${key}:`, error.message);
    cacheStats.errors++;
  }
}

/**
 * Delete specific key from cache
 * @param {string} key - Cache key
 */
export async function deleteCache(key) {
  if (!isCacheAvailable()) {
    return;
  }

  try {
    await redisClient.del(key);
    cacheStats.deletes++;
  } catch (error) {
    console.error(`❌ Cache DELETE error for key ${key}:`, error.message);
    cacheStats.errors++;
  }
}

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., "tenant:123:*")
 */
export async function deleteCachePattern(pattern) {
  if (!isCacheAvailable()) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      cacheStats.deletes += keys.length;
    }
  } catch (error) {
    console.error(`❌ Cache DELETE PATTERN error for ${pattern}:`, error.message);
    cacheStats.errors++;
  }
}

/**
 * Generate cache key for tenant scoring rules
 * @param {string} tenantId - Tenant ID
 */
export function getScoringRulesKey(tenantId) {
  return `${CACHE_KEYS.SCORING_RULES}:${tenantId}`;
}

/**
 * Generate cache key for page configuration
 * @param {string} tenantId - Tenant ID
 * @param {string} websiteId - Website ID
 */
export function getPageConfigKey(tenantId, websiteId) {
  return `${CACHE_KEYS.PAGE_CONFIG}:${tenantId}:${websiteId}`;
}

/**
 * Generate cache key for CTA configuration
 * @param {string} tenantId - Tenant ID
 * @param {string} websiteId - Website ID
 */
export function getCTAConfigKey(tenantId, websiteId) {
  return `${CACHE_KEYS.CTA_CONFIG}:${tenantId}:${websiteId}`;
}

/**
 * Generate cache key for website configuration
 * @param {string} tenantId - Tenant ID
 * @param {string} websiteId - Website ID
 */
export function getWebsiteConfigKey(tenantId, websiteId) {
  return `${CACHE_KEYS.WEBSITE_CONFIG}:${tenantId}:${websiteId}`;
}

/**
 * Generate cache key for tenant settings
 * @param {string} tenantId - Tenant ID
 */
export function getTenantSettingsKey(tenantId) {
  return `${CACHE_KEYS.TENANT_SETTINGS}:${tenantId}`;
}

/**
 * Invalidate all cache for a specific tenant
 * @param {string} tenantId - Tenant ID
 */
export async function invalidateTenantCache(tenantId) {
  await deleteCachePattern(`*:${tenantId}:*`);
  await deleteCachePattern(`*:${tenantId}`);
  console.log(`🗑️  Invalidated all cache for tenant ${tenantId}`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;

  return {
    ...cacheStats,
    hitRate: `${hitRate}%`,
    total,
    isEnabled: REDIS_ENABLED,
    isConnected
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats() {
  cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };
}

/**
 * Flush entire cache (use with caution)
 */
export async function flushCache() {
  if (!isCacheAvailable()) {
    return;
  }

  try {
    await redisClient.flushDb();
    console.log('🗑️  Flushed entire cache');
  } catch (error) {
    console.error('❌ Cache FLUSH error:', error.message);
    cacheStats.errors++;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeCache() {
  if (redisClient && isConnected) {
    await redisClient.quit();
    console.log('✅ Redis connection closed');
  }
}

export default {
  initializeCache,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  getScoringRulesKey,
  getPageConfigKey,
  getCTAConfigKey,
  getWebsiteConfigKey,
  getTenantSettingsKey,
  invalidateTenantCache,
  getCacheStats,
  resetCacheStats,
  flushCache,
  closeCache,
  CACHE_KEYS
};
