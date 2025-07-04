import { doubleCsrf, type CsrfRequestMethod } from "csrf-csrf";
import { auditService } from "./audit-service";
import { Request, Response, NextFunction } from "express";

/**
 * CSRF Protection Service for MediBridge
 * Provides comprehensive CSRF protection for all state-changing operations
 */

// CSRF configuration
const csrfConfig = {
  getSecret: () => process.env.CSRF_SECRET || process.env.SESSION_SECRET || "medibridge-csrf-secret",
  getSessionIdentifier: (req: Request) => req.session?.id || req.ip || "anonymous",
  cookieName: "medibridge-csrf-token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  size: 32, // Token size in bytes
  ignoredMethods: ["GET", "HEAD", "OPTIONS"] as CsrfRequestMethod[], // Methods that don't need CSRF protection
  getTokenFromRequest: (req: Request) =>
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?.csrfToken ||
    req.query?.csrfToken,
};

const { doubleCsrfProtection } = doubleCsrf(csrfConfig);

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for all state-changing operations
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * CSRF Token Endpoint
 * Provides CSRF tokens to the frontend
 */
export const csrfTokenEndpoint = [
  doubleCsrfProtection,
  (req: Request, res: Response) => {
    // The token is set as a cookie by the middleware
    const token = req.cookies[csrfConfig.cookieName];
    auditService.logEvent({
      eventType: "CSRF_TOKEN_GENERATED",
      actorType: "SYSTEM",
      actorId: "csrf_service",
      targetType: "CSRF_TOKEN",
      targetId: "token_generation",
      action: "GENERATE",
      outcome: "SUCCESS",
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
      severity: "info",
    }, req);
    res.json({
      success: true,
      csrfToken: token,
      message: "CSRF token generated successfully",
    });
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
    cookieName: csrfConfig.cookieName,
    headerName: "x-csrf-token",
    tokenEndpoint: "/api/csrf-token",
    ignoredMethods: csrfConfig.ignoredMethods,
  };
};

/**
 * CSRF Health Check
 * Verify CSRF protection is working correctly
 */
export const csrfHealthCheck = [
  doubleCsrfProtection,
  (req: Request, res: Response) => {
    const token = req.cookies[csrfConfig.cookieName];
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