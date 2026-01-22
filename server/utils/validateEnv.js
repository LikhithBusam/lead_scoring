/**
 * Environment Variable Validation
 * Validates required environment variables on server startup
 */

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

const OPTIONAL_ENV_VARS = [
  'SUPABASE_ANON_KEY',
  'PORT',
  'NODE_ENV',
  'GROQ_API_KEY',
  'TAVILY_API_KEY',
  'SERPER_API_KEY',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_ENABLED',
  'ALLOWED_ORIGINS',
  'CSRF_SECRET'
];

const INSECURE_DEFAULTS = {
  JWT_SECRET: [
    'your-super-secret-jwt-key-change-in-production-min-32-characters',
    'lead-scoring-super-secret-jwt-key-change-in-production-min-32-characters-long',
    'generate-a-secure-random-string-at-least-64-characters-long',
    'secret',
    'jwt-secret',
    'your-jwt-secret'
  ]
};

/**
 * Validate environment variables
 * @returns {Object} Validation result with errors and warnings
 */
export function validateEnv() {
  const errors = [];
  const warnings = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Check for insecure defaults
  for (const [envVar, insecureValues] of Object.entries(INSECURE_DEFAULTS)) {
    const value = process.env[envVar];
    if (value && insecureValues.some(insecure => value.toLowerCase().includes(insecure.toLowerCase()))) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(`SECURITY ERROR: ${envVar} is using an insecure default value in production!`);
      } else {
        warnings.push(`WARNING: ${envVar} appears to be using a default value. Change this before deploying to production.`);
      }
    }
  }

  // Check JWT_SECRET length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('SECURITY ERROR: JWT_SECRET must be at least 32 characters in production');
    } else {
      warnings.push('WARNING: JWT_SECRET should be at least 32 characters');
    }
  }

  // Check CSRF_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
    warnings.push('WARNING: CSRF_SECRET not set. CSRF protection may be limited.');
  }

  // Check for development-only flags in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.BYPASS_AUTH === 'true') {
      errors.push('CRITICAL: BYPASS_AUTH is enabled in production! This is a severe security risk.');
    }
  }

  // Check optional but recommended variables
  if (!process.env.GROQ_API_KEY) {
    warnings.push('GROQ_API_KEY not set. Company research feature will be disabled.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate and exit if critical errors found
 */
export function validateEnvOrExit() {
  const result = validateEnv();

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
    console.log('');
  }

  // Print errors and exit if invalid
  if (!result.isValid) {
    console.error('\n🚨 Environment Validation Failed:');
    result.errors.forEach(error => console.error(`   ❌ ${error}`));
    console.error('\nPlease fix the above errors and restart the server.\n');
    process.exit(1);
  }

  return true;
}

export default {
  validateEnv,
  validateEnvOrExit,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};
