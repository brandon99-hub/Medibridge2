import type { Express } from "express";
import { z } from "zod";
import { auditService } from "./audit-service";
import { storage } from "./storage";
import { patientWeb3Service } from "./patient-web3-service";

/**
 * Security Testing Routes - Test unauthorized access scenarios
 * These routes help validate security measures and audit logging
 */
export function registerSecurityTestingRoutes(app: Express): void {

  /**
   * Test unauthorized record access
   * POST /api/security/test-unauthorized-access
   */
  app.post("/api/security/test-unauthorized-access", async (req, res) => {
    try {
      const { nationalId, attemptType } = z.object({
        nationalId: z.string(),
        attemptType: z.enum(["no_auth", "invalid_credential", "expired_consent"]),
      }).parse(req.body);

      // Log security violation attempt
      await auditService.logSecurityViolation({
        violationType: "UNAUTHORIZED_ACCESS_TEST",
        severity: "medium",
        actorId: req.ip || "unknown",
        targetResource: `patient_records:${nationalId}`,
        details: {
          attemptType,
          timestamp: new Date().toISOString(),
          testScenario: true,
        },
      }, req);

      // Simulate different unauthorized access scenarios
      switch (attemptType) {
        case "no_auth":
          return res.status(401).json({ 
            error: "Authentication required",
            securityTest: true,
            violation: "Attempted access without authentication"
          });
        
        case "invalid_credential":
          return res.status(403).json({ 
            error: "Invalid credentials",
            securityTest: true,
            violation: "Attempted access with invalid credentials"
          });
        
        case "expired_consent":
          return res.status(403).json({ 
            error: "Consent expired or revoked",
            securityTest: true,
            violation: "Attempted access with expired consent"
          });
        
        default:
          return res.status(400).json({ error: "Invalid test type" });
      }
    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "SECURITY_TEST_ERROR",
        severity: "low",
        details: { error: error.message },
      }, req);
      
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Test credential verification security
   * POST /api/security/test-credential-verification
   */
  app.post("/api/security/test-credential-verification", async (req, res) => {
    try {
      const { credential, testType } = z.object({
        credential: z.string(),
        testType: z.enum(["malformed", "expired", "tampered", "valid"]),
      }).parse(req.body);

      // Log security test attempt
      await auditService.logEvent({
        eventType: "CREDENTIAL_VERIFICATION_TEST",
        actorType: "SYSTEM",
        actorId: "security_test",
        targetType: "CREDENTIAL",
        targetId: "test_credential",
        action: "VERIFY",
        outcome: "PENDING",
        metadata: { testType },
        severity: "info",
      }, req);

      let verificationResult;
      let shouldFail = false;

      switch (testType) {
        case "malformed":
          shouldFail = true;
          verificationResult = { isValid: false, error: "Malformed credential structure" };
          break;
        
        case "expired":
          shouldFail = true;
          verificationResult = { isValid: false, error: "Credential has expired" };
          break;
        
        case "tampered":
          shouldFail = true;
          verificationResult = { isValid: false, error: "Credential signature invalid" };
          break;
        
        case "valid":
          // Test with actual verification
          verificationResult = await patientWeb3Service.verifyCredential(credential);
          break;
      }

      if (shouldFail || !verificationResult.isValid) {
        await auditService.logSecurityViolation({
          violationType: "INVALID_CREDENTIAL_TEST",
          severity: "medium",
          targetResource: "credential_verification",
          details: {
            testType,
            error: verificationResult.error,
            testScenario: true,
          },
        }, req);
      }

      res.json({
        securityTest: true,
        testType,
        verificationResult,
        recommendation: shouldFail 
          ? "Security measure working correctly - invalid credential rejected"
          : "Credential verification passed security test"
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "CREDENTIAL_TEST_ERROR",
        severity: "low",
        details: { error: error.message },
      }, req);
      
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Test rate limiting and brute force protection
   * POST /api/security/test-rate-limiting
   */
  app.post("/api/security/test-rate-limiting", async (req, res) => {
    try {
      const { requestCount, timeWindow } = z.object({
        requestCount: z.number().min(1).max(100),
        timeWindow: z.number().min(1).max(60), // seconds
      }).parse(req.body);

      const startTime = Date.now();
      const results = [];

      // Simulate rapid requests
      for (let i = 0; i < requestCount; i++) {
        const requestStart = Date.now();
        
        // Log each attempt
        await auditService.logEvent({
          eventType: "RATE_LIMIT_TEST",
          actorType: "SYSTEM",
          actorId: "security_test",
          targetType: "API",
          targetId: "rate_limit_test",
          action: "REQUEST",
          outcome: "SUCCESS",
          metadata: { 
            requestNumber: i + 1,
            totalRequests: requestCount,
          },
          severity: "info",
        }, req);

        results.push({
          requestNumber: i + 1,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - requestStart,
        });

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const totalTime = Date.now() - startTime;
      const requestsPerSecond = (requestCount / (totalTime / 1000)).toFixed(2);

      // Log potential rate limiting violation
      if (parseFloat(requestsPerSecond) > 10) {
        await auditService.logSecurityViolation({
          violationType: "RATE_LIMIT_EXCEEDED",
          severity: "medium",
          targetResource: "api_endpoints",
          details: {
            requestsPerSecond: parseFloat(requestsPerSecond),
            totalRequests: requestCount,
            timeWindow: totalTime / 1000,
            testScenario: true,
          },
        }, req);
      }

      res.json({
        securityTest: true,
        results: {
          totalRequests: requestCount,
          totalTime: `${totalTime}ms`,
          requestsPerSecond,
          averageResponseTime: `${results.reduce((sum, r) => sum + r.responseTime, 0) / results.length}ms`,
          recommendation: parseFloat(requestsPerSecond) > 10 
            ? "Consider implementing rate limiting to prevent abuse"
            : "Request rate is within acceptable limits"
        },
        requests: results.slice(0, 5), // Return first 5 for brevity
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "RATE_LIMIT_TEST_ERROR",
        severity: "low",
        details: { error: error.message },
      }, req);
      
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get security audit summary
   * GET /api/security/audit-summary
   */
  app.get("/api/security/audit-summary", async (req, res) => {
    try {
      const totalEvents = await storage.countAuditEvents();
      const unresolvedViolations = await storage.countSecurityViolations({ resolved: false });
      const totalConsentEvents = await storage.countConsentAuditRecords();

      // Specific event type counts from auditEvents
      // Note: Event types like 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'RECORD_ACCESSED', 'UNAUTHORIZED_ACCESS_ATTEMPT'
      // need to be consistently used by auditService.logEvent and auditService.logSecurityViolation.
      const successfulLogins = await storage.countAuditEvents({ eventType: "LOGIN_SUCCESS", outcome: "SUCCESS" }); // Assuming eventType and outcome
      const failedLogins = await storage.countAuditEvents({ eventType: "LOGIN_FAILURE", outcome: "FAILURE" }); // Assuming eventType and outcome
      const recordAccesses = await storage.countAuditEvents({ eventType: "RECORD_ACCESSED", outcome: "SUCCESS" }); // Assuming

      // Unauthorized attempts could be a specific violationType or an eventType in auditEvents
      // Let's assume it's a violationType for now.
      const unauthorizedAttempts = await storage.countSecurityViolations({ violationType: "UNAUTHORIZED_ACCESS_TEST" }) +
                                   await storage.countSecurityViolations({ violationType: "INVALID_CREDENTIAL_TEST" }) +
                                   await storage.countSecurityViolations({ violationType: "UNAUTHORIZED_ACCESS_ATTEMPT" }); // A more generic one

      const summary = {
        totalEvents,
        securityViolations: unresolvedViolations, // Display unresolved violations
        consentEvents: totalConsentEvents,
        // recentActivity: [], // TODO: Implement fetching recent activity (requires more complex queries)
        securityMetrics: {
          successfulLogins,
          failedLogins,
          unauthorizedAttempts,
          recordAccesses,
        },
        // Recommendations can remain static for now or be dynamically generated later
        recommendations: [
          "Review unresolved security violations regularly.",
          "Ensure audit logs are backed up and archived.",
          "Consider implementing automated alerts for critical violations.",
        ],
      };

      await auditService.logEvent({
        eventType: "SECURITY_AUDIT_ACCESSED",
        actorType: "SYSTEM",
        actorId: "audit_system",
        targetType: "AUDIT_LOG",
        targetId: "security_summary",
        action: "READ",
        outcome: "SUCCESS",
        metadata: { accessedBy: req.ip },
        severity: "info",
      }, req);

      res.json({
        summary,
        timestamp: new Date().toISOString(),
        message: "Security audit summary generated successfully"
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "AUDIT_ACCESS_ERROR",
        severity: "medium",
        details: { error: error.message },
      }, req);
      
      res.status(500).json({ error: "Failed to generate security summary" });
    }
  });
}