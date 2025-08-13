import { auditService } from "./audit-service";
import { Request, Response, NextFunction } from "express";
import crypto from 'crypto';

/**
 * CSRF Protection Service for MediBridge
 * Provides comprehensive CSRF protection for all state-changing operations
 */

const cookieName = "csrftoken";
const cookieOptions = {
  httpOnly: true,
  sameSite: (process.env.NODE_ENV === 'production' ? "strict" : "lax") as 'lax' | 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
};

/**
 * Selective CSRF Protection Middleware
 * Only applies CSRF protection to state-changing operations (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChanging.includes(req.method)) return next();

  try {
    const headerToken = (req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || req.body?.csrfToken || req.query?.csrfToken) as string | undefined;
    const sessionToken = (req.session as any)?.csrfToken as string | undefined;
    const cookieToken = req.cookies[cookieName] as string | undefined;

    if (!headerToken || !sessionToken) {
      return res.status(403).json({ error: 'CSRF token missing', code: 'CSRF_VIOLATION' });
    }
    if (headerToken.length < 32 || sessionToken.length < 32) {
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_VIOLATION' });
    }
    if (headerToken !== sessionToken) {
      auditService.logSecurityViolation({
        violationType: 'CSRF_MISMATCH',
        severity: 'medium',
        details: { path: req.path, method: req.method },
      }, req);
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_VIOLATION' });
    }
    // Keep cookie in sync with session token (helps when multiple tabs refresh token)
    if (!cookieToken || cookieToken !== sessionToken) {
      res.cookie(cookieName, sessionToken, cookieOptions);
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * CSRF Token Endpoint
 * Provides CSRF tokens to the frontend
 */
export const csrfTokenEndpoint = [
  (req: Request, res: Response, _next: NextFunction) => {
    const existing = (req.session as any)?.csrfToken as string | undefined;
    if (existing && existing.length >= 32) {
      // Ensure cookie matches existing session token
      if (req.cookies[cookieName] !== existing) {
        res.cookie(cookieName, existing, cookieOptions);
      }
      return res.json({ success: true, csrfToken: existing, message: 'CSRF token active' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    (req.session as any).csrfToken = token;
    res.cookie(cookieName, token, cookieOptions);
    res.json({ success: true, csrfToken: token, message: 'CSRF token generated' });
  }
];

/**
 * CSRF Protection for specific routes
 * Use this for routes that need custom CSRF handling
 */
export const csrfProtectionForRoute = (routePath: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add route-specific CSRF validation if needed
    return csrfProtection(req, res, next);
  };
};

/**
 * Get CSRF configuration for frontend
 */
export const getCsrfConfig = () => {
  return {
    cookieName,
    headerName: "x-csrf-token",
    tokenEndpoint: "/api/csrf-token",
  };
};

/**
 * CSRF Health Check
 * Verify CSRF protection is working correctly
 */
export const csrfHealthCheck = [
  (req: Request, res: Response) => {
    const token = req.cookies[cookieName];
    if (!token || token.length < 32) {
      return res.status(500).json({
        status: "unhealthy",
        csrfProtection: "error",
        error: "Generated token is invalid",
        timestamp: new Date().toISOString(),
      });
    }
    res.json({
      status: "healthy",
      csrfProtection: "active",
      tokenGeneration: "working",
      timestamp: new Date().toISOString(),
    });
  }
]; 