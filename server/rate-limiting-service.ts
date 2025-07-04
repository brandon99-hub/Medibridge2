import rateLimit from 'express-rate-limit';
import { auditService } from './audit-service';

/**
 * Rate Limiting Service for MediBridge
 * Provides different rate limits for different endpoint types based on security requirements
 */

// Rate limit configurations for different endpoint types
const RATE_LIMITS = {
  // Authentication endpoints - strict limits to prevent brute force
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // OTP endpoints - moderate limits to prevent spam
  OTP: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // 3 OTP requests per 10 minutes
    message: 'Too many OTP requests. Please wait before requesting another.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Patient endpoints - moderate limits
  PATIENT: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 requests per 5 minutes
    message: 'Too many patient requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Medical record endpoints - strict limits for sensitive data
  MEDICAL_RECORDS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 requests per 5 minutes
    message: 'Too many medical record requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Consent endpoints - strict limits for sensitive operations
  CONSENT: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 consent operations per 5 minutes
    message: 'Too many consent operations. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Emergency endpoints - very strict limits
  EMERGENCY: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 emergency requests per hour
    message: 'Too many emergency requests. Please contact support if this is urgent.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Admin endpoints - moderate limits
  ADMIN: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 requests per 5 minutes
    message: 'Too many admin requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // General API endpoints - standard limits
  GENERAL: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 requests per 5 minutes
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Filecoin/IPFS endpoints - moderate limits for storage operations
  STORAGE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 15, // 15 storage operations per 5 minutes
    message: 'Too many storage operations. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Create rate limiter with custom handler for audit logging
 */
function createRateLimiter(config: typeof RATE_LIMITS[keyof typeof RATE_LIMITS], endpointType: string) {
  return rateLimit({
    ...config,
    handler: async (req, res) => {
      // Log rate limit violation for security monitoring
      await auditService.logSecurityViolation({
        violationType: "RATE_LIMIT_EXCEEDED",
        severity: "medium",
        actorId: req.ip || "unknown",
        targetResource: `${endpointType}:${req.path}`,
        details: {
          endpointType,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          limit: config.max,
          windowMs: config.windowMs,
        },
      }, req);

      res.status(429).json({
        error: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000),
        endpointType,
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks and static assets
      return req.path === '/health' || 
             req.path.startsWith('/static/') || 
             req.path.startsWith('/assets/');
    },
  });
}

/**
 * Rate limiting middleware for different endpoint types
 */
export const rateLimiters = {
  // Authentication rate limiter
  auth: createRateLimiter(RATE_LIMITS.AUTH, 'AUTH'),

  // OTP rate limiter
  otp: createRateLimiter(RATE_LIMITS.OTP, 'OTP'),

  // Patient endpoints rate limiter
  patient: createRateLimiter(RATE_LIMITS.PATIENT, 'PATIENT'),

  // Medical records rate limiter
  medicalRecords: createRateLimiter(RATE_LIMITS.MEDICAL_RECORDS, 'MEDICAL_RECORDS'),

  // Consent rate limiter
  consent: createRateLimiter(RATE_LIMITS.CONSENT, 'CONSENT'),

  // Emergency rate limiter
  emergency: createRateLimiter(RATE_LIMITS.EMERGENCY, 'EMERGENCY'),

  // Admin rate limiter
  admin: createRateLimiter(RATE_LIMITS.ADMIN, 'ADMIN'),

  // General API rate limiter
  general: createRateLimiter(RATE_LIMITS.GENERAL, 'GENERAL'),

  // Storage rate limiter
  storage: createRateLimiter(RATE_LIMITS.STORAGE, 'STORAGE'),
};

/**
 * Apply rate limiting to specific route patterns
 */
export function applyRateLimiting(app: any) {
  // Authentication routes
  app.use('/api/auth/login', rateLimiters.auth);
  app.use('/api/auth/patient/login', rateLimiters.auth);
  app.use('/api/auth/patient/register', rateLimiters.auth);
  app.use('/api/register', rateLimiters.auth);

  // OTP routes
  app.use('/api/patient/request-otp', rateLimiters.otp);
  app.use('/api/patient/verify-otp', rateLimiters.otp);

  // Patient routes
  app.use('/api/patient', rateLimiters.patient);
  app.use('/api/patient-lookup', rateLimiters.patient);

  // Medical record routes
  app.use('/api/submit_record', rateLimiters.medicalRecords);
  app.use('/api/get_records', rateLimiters.medicalRecords);
  app.use('/api/web3/submit-record', rateLimiters.medicalRecords);
  app.use('/api/web3/get-records', rateLimiters.medicalRecords);

  // Consent routes
  app.use('/api/request-consent', rateLimiters.consent);
  app.use('/api/grant-consent', rateLimiters.consent);
  app.use('/api/revoke-consent', rateLimiters.consent);
  app.use('/api/web3/issue-consent', rateLimiters.consent);

  // Emergency routes
  app.use('/api/emergency', rateLimiters.emergency);

  // Admin routes
  app.use('/api/admin', rateLimiters.admin);
  app.use('/api/staff', rateLimiters.admin);

  // Storage routes
  app.use('/api/filecoin', rateLimiters.storage);
  app.use('/api/ipfs', rateLimiters.storage);

  // Web3 routes
  app.use('/api/web3', rateLimiters.general);

  // General API routes (catch-all for other endpoints)
  app.use('/api', rateLimiters.general);
}

/**
 * Get rate limit statistics for monitoring
 */
export function getRateLimitStats() {
  return {
    limits: RATE_LIMITS,
    description: {
      AUTH: 'Authentication endpoints - prevents brute force attacks',
      OTP: 'OTP endpoints - prevents SMS/email spam',
      PATIENT: 'Patient endpoints - moderate limits for patient operations',
      MEDICAL_RECORDS: 'Medical record endpoints - strict limits for sensitive data',
      CONSENT: 'Consent endpoints - strict limits for consent operations',
      EMERGENCY: 'Emergency endpoints - very strict limits for emergency access',
      ADMIN: 'Admin endpoints - moderate limits for administrative operations',
      GENERAL: 'General API endpoints - standard limits for regular operations',
      STORAGE: 'Storage endpoints - moderate limits for IPFS/Filecoin operations',
    },
  };
} 