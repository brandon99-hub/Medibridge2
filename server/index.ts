import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { applyRateLimiting, getRateLimitStats } from "./rate-limiting-service";
import { csrfProtection, csrfTokenEndpoint, csrfHealthCheck } from "./csrf-protection-service";
import { auditService } from "./audit-service";
import { setupAuth } from "./auth";

const app = express();

// Add cookie-parser middleware before anything that reads cookies
app.use(cookieParser());

// Security middleware - apply before other middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: process.env.NODE_ENV === 'production'
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"],
      styleSrc: process.env.NODE_ENV === 'production'
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Apply rate limiting to all API routes
applyRateLimiting(app);

// Custom HSTS middleware for enhanced security monitoring
app.use((req, res, next) => {
  // Only apply HSTS in production
  if (process.env.NODE_ENV === 'production') {
    // Set HSTS header with healthcare-appropriate settings
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    
    // Log HSTS header application for security monitoring
    if (req.path.startsWith('/api')) {
      auditService.logHstsEvent("ENABLED", "SUCCESS", req, {
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
    }
  }
  next();
});

  app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

    res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        // Avoid logging response bodies in production to prevent PII leakage
        if (capturedJsonResponse && app.get("env") !== "production") {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup authentication and session middleware BEFORE CSRF and routes
  await setupAuth(app);

  // Now apply CSRF protection to all API routes
  app.use('/api', csrfProtection);

  // Register all routes (which may also apply CSRF as needed)
  const server = await registerRoutes(app);

  // Health check endpoint (excluded from rate limiting)
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Rate limit statistics endpoint (for monitoring)
  app.get('/api/rate-limits/stats', (req, res) => {
    res.json({
      success: true,
      stats: getRateLimitStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // CSRF token endpoint
  app.get('/api/csrf-token', csrfTokenEndpoint);

  // CSRF health check endpoint
  app.get('/api/csrf-health', csrfHealthCheck);

  // HSTS health check endpoint
  app.get('/api/security/hsts-health', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const hstsHeader = req.headers['strict-transport-security'];
    
    res.json({
      status: isProduction ? 'enabled' : 'development',
      hstsHeader: hstsHeader || 'not-set',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      maxAge: isProduction ? '31536000 (1 year)' : 'disabled',
      includeSubDomains: isProduction,
      preload: isProduction,
      securityLevel: isProduction ? 'maximum' : 'development',
    });
  });

  // Security headers test endpoint
  app.get('/api/security/headers-test', (req, res) => {
    const securityHeaders = {
      hsts: res.getHeader('Strict-Transport-Security'),
      csp: res.getHeader('Content-Security-Policy'),
      xFrameOptions: res.getHeader('X-Frame-Options'),
      xContentTypeOptions: res.getHeader('X-Content-Type-Options'),
      referrerPolicy: res.getHeader('Referrer-Policy'),
    };
    
    res.json({
      success: true,
      securityHeaders,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use Render's assigned port if available, otherwise default to 5000
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
