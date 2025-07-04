import { storage } from "./storage";
import type { Request } from "express";
import type { InsertAuditEvent, InsertSecurityViolation, InsertConsentAudit } from "@shared/audit-schema";

/**
 * Comprehensive Audit Service for Healthcare Compliance
 */
export class AuditService {
  private static instance: AuditService;

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log general audit event
   */
  async logEvent(event: InsertAuditEvent, req?: Request): Promise<void> {
    try {
      const enrichedEvent = {
        ...event,
        ipAddress: req?.ip || event.ipAddress,
        userAgent: req?.get('User-Agent') || event.userAgent,
      };

      // For now, log to console - in production, store in database
      console.log(`[AUDIT] ${JSON.stringify(enrichedEvent)}`);
      
      // Store in audit_events table
      await storage.createAuditEvent(enrichedEvent);
    } catch (error) {
      console.error(`[AUDIT_ERROR] Failed to log event: ${error}`);
    }
  }

  /**
   * Log consent-related events
   */
  async logConsentEvent(consentAudit: InsertConsentAudit, req?: Request): Promise<void> {
    try {
      const enrichedAudit = {
        ...consentAudit,
        ipAddress: req?.ip || consentAudit.ipAddress,
        userAgent: req?.get('User-Agent') || consentAudit.userAgent,
      };

      console.log(`[CONSENT_AUDIT] ${JSON.stringify(enrichedAudit)}`);
      
      // Log as general audit event too
      await this.logEvent({
        eventType: `CONSENT_${consentAudit.consentAction}`,
        actorType: "PATIENT",
        actorId: consentAudit.patientDID,
        targetType: "HOSPITAL",
        targetId: consentAudit.hospitalDID,
        action: consentAudit.consentAction,
        outcome: "SUCCESS",
        metadata: {
          recordId: consentAudit.recordId,
          verificationMethod: consentAudit.verificationMethod,
          grantedBy: consentAudit.grantedBy,
          expiresAt: consentAudit.expiresAt,
        },
        severity: "info",
      }, req);

      // Store in consent audit table
      await storage.createConsentAudit(enrichedAudit);
    } catch (error) {
      console.error(`[CONSENT_AUDIT_ERROR] Failed to log consent event: ${error}`);
    }
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(violation: InsertSecurityViolation, req?: Request): Promise<void> {
    try {
      const enrichedViolation = {
        ...violation,
        ipAddress: req?.ip || violation.ipAddress,
        userAgent: req?.get('User-Agent') || violation.userAgent,
      };

      console.log(`[SECURITY_VIOLATION] ${JSON.stringify(enrichedViolation)}`);
      
      // Log as high-severity audit event
      await this.logEvent({
        eventType: "SECURITY_VIOLATION",
        actorType: "UNKNOWN",
        actorId: violation.actorId || "anonymous",
        targetType: "SYSTEM",
        targetId: violation.targetResource || "unknown",
        action: "VIOLATION",
        outcome: "FAILURE",
        metadata: violation.details,
        severity: violation.severity === "critical" ? "error" : "warning",
      }, req);

      // Store in security violations table
      await storage.createSecurityViolation(enrichedViolation);
    } catch (error) {
      console.error(`[SECURITY_AUDIT_ERROR] Failed to log security violation: ${error}`);
    }
  }

  /**
   * Log patient authentication events
   */
  async logAuthEvent(
    eventType: "LOGIN_ATTEMPT" | "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "OTP_REQUEST" | "OTP_VERIFY",
    contact: string,
    verificationMethod: string,
    outcome: "SUCCESS" | "FAILURE",
    req?: Request,
    metadata?: any
  ): Promise<void> {
    await this.logEvent({
      eventType,
      actorType: "PATIENT",
      actorId: contact,
      targetType: "AUTH_SYSTEM",
      targetId: "patient_auth",
      action: eventType.includes("LOGIN") ? "AUTHENTICATE" : "VERIFY",
      outcome,
      metadata: {
        verificationMethod,
        ...metadata,
      },
      severity: outcome === "FAILURE" ? "warning" : "info",
    }, req);
  }

  /**
   * Log record access events
   */
  async logRecordAccess(
    patientDID: string,
    hospitalDID: string,
    recordCID: string,
    outcome: "SUCCESS" | "FAILURE",
    req?: Request,
    metadata?: any
  ): Promise<void> {
    await this.logEvent({
      eventType: "RECORD_ACCESS",
      actorType: "HOSPITAL",
      actorId: hospitalDID,
      targetType: "RECORD",
      targetId: recordCID,
      action: "READ",
      outcome,
      metadata: {
        patientDID,
        ...metadata,
      },
      severity: outcome === "FAILURE" ? "warning" : "info",
    }, req);
  }

  /**
   * Log record encryption events
   */
  async logEncryptionEvent(
    patientDID: string,
    recordId: string,
    action: "ENCRYPT" | "DECRYPT",
    outcome: "SUCCESS" | "FAILURE",
    metadata?: any
  ): Promise<void> {
    await this.logEvent({
      eventType: "RECORD_ENCRYPTION",
      actorType: "SYSTEM",
      actorId: "encryption_service",
      targetType: "RECORD",
      targetId: recordId,
      action,
      outcome,
      metadata: {
        patientDID,
        ...metadata,
      },
      severity: outcome === "FAILURE" ? "error" : "info",
    });
  }

  /**
   * Log HSTS security events
   */
  async logHstsEvent(
    action: "ENABLED" | "VIOLATION" | "HEALTH_CHECK",
    outcome: "SUCCESS" | "FAILURE",
    req?: Request,
    metadata?: any
  ): Promise<void> {
    await this.logEvent({
      eventType: "HSTS_SECURITY",
      actorType: "SYSTEM",
      actorId: "hsts_middleware",
      targetType: "SECURITY_HEADER",
      targetId: "strict_transport_security",
      action,
      outcome,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        maxAge: '31536000',
        includeSubDomains: true,
        preload: true,
        ...metadata,
      },
      severity: action === "VIOLATION" ? "warning" : "info",
    }, req);
  }
}

export const auditService = AuditService.getInstance();