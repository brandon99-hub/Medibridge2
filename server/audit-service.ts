import { storage } from "./storage";
import type { Request } from "express";
import type { InsertAuditEvent, InsertSecurityViolation, InsertConsentAudit } from "@shared/audit-schema";
import { Client, TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { createHash } from "crypto";

/**
 * Comprehensive Audit Service for Healthcare Compliance
 */
export class AuditService {
  private static instance: AuditService;
  private hederaClient?: Client;
  private auditTopicId?: TopicId;
  private consentTopicId?: TopicId;
  private securityTopicId?: TopicId;
  private hederaEnabled: boolean = false;

  private constructor() {
    this.initializeHedera();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Initialize Hedera client and topics
   */
  private initializeHedera(): void {
    try {
      if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
        this.hederaClient = Client.forTestnet();
        this.hederaClient.setOperator(
          process.env.HEDERA_OPERATOR_ID,
          process.env.HEDERA_OPERATOR_KEY
        );

        // Load topic IDs
        if (process.env.HEDERA_AUDIT_TOPIC_ID) {
          this.auditTopicId = TopicId.fromString(process.env.HEDERA_AUDIT_TOPIC_ID);
        }
        if (process.env.HEDERA_CONSENT_TOPIC_ID) {
          this.consentTopicId = TopicId.fromString(process.env.HEDERA_CONSENT_TOPIC_ID);
        }
        if (process.env.HEDERA_SECURITY_TOPIC_ID) {
          this.securityTopicId = TopicId.fromString(process.env.HEDERA_SECURITY_TOPIC_ID);
        }

        this.hederaEnabled = true;
        console.log('[HEDERA] Audit service initialized with HCS topics');
      }
    } catch (error) {
      console.warn('[HEDERA] Failed to initialize Hedera client:', error);
      this.hederaEnabled = false;
    }
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

      console.log(`[AUDIT] ${JSON.stringify(enrichedEvent)}`);
      
      // Store in PostgreSQL (source of truth for data)
      const savedEvent = await storage.createAuditEvent(enrichedEvent);
      
      // Submit hash to Hedera HCS (source of truth for integrity)
      if (this.hederaEnabled && savedEvent) {
        this.submitHashToHCS(this.auditTopicId, {
          eventId: savedEvent.id,
          eventType: savedEvent.eventType,
          timestamp: new Date().toISOString()
        }, savedEvent).catch(err => 
          console.error('[HCS_ERROR] Failed to submit audit hash:', err)
        );
      }
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
      
      // Store in consent audit table
      const savedAudit = await storage.createConsentAudit(enrichedAudit);
      
      // Submit hash to Hedera consent topic
      if (this.hederaEnabled && savedAudit) {
        this.submitHashToHCS(this.consentTopicId, {
          auditId: savedAudit.id,
          patientDID: consentAudit.patientDID,
          hospitalDID: consentAudit.hospitalDID,
          action: consentAudit.consentAction,
          timestamp: new Date().toISOString()
        }, savedAudit).catch(err =>
          console.error('[HCS_ERROR] Failed to submit consent hash:', err)
        );
      }

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
    } catch (error) {
      console.error(`[CONSENT_AUDIT_ERROR] Failed to log consent event: ${error}`);
    }
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(violation: InsertSecurityViolation, req?: Request): Promise<void> {
    try {
      // Extract hospital_id from authenticated user if available
      let hospital_id: number | undefined;
      if (req?.user && typeof req.user === 'object' && 'hospital_id' in req.user) {
        hospital_id = (req.user as any).hospital_id;
      } else if (req?.user && typeof req.user === 'object' && 'id' in req.user) {
        // Fallback: use user ID as hospital_id for hospital users
        hospital_id = (req.user as any).id;
      }

      const enrichedViolation = {
        ...violation,
        ipAddress: req?.ip || violation.ipAddress,
        userAgent: req?.get('User-Agent') || violation.userAgent,
        hospital_id, // Add hospital context
      };

      console.log(`[SECURITY_VIOLATION] ${JSON.stringify(enrichedViolation)}`);
      
      // Store in security violations table with hospital context
      const savedViolation = await storage.createSecurityViolation(enrichedViolation, hospital_id);
      
      // Submit hash to Hedera security topic (high priority)
      if (this.hederaEnabled && savedViolation) {
        this.submitHashToHCS(this.securityTopicId, {
          violationId: savedViolation.id,
          type: violation.violationType,
          severity: violation.severity,
          timestamp: new Date().toISOString()
        }, savedViolation).catch(err =>
          console.error('[HCS_ERROR] Failed to submit security violation hash:', err)
        );
      }

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

  /**
   * Submit hash to Hedera HCS topic (non-blocking)
   * Uses hash anchoring: PostgreSQL stores data, Hedera stores proof
   */
  private async submitHashToHCS(
    topicId: TopicId | undefined,
    metadata: any,
    fullData: any
  ): Promise<void> {
    if (!this.hederaClient || !topicId) {
      return; // Hedera not configured, skip silently
    }

    try {
      // Create cryptographic hash of the full data
      const dataHash = createHash('sha256')
        .update(JSON.stringify(fullData))
        .digest('hex');

      // Submit only hash + minimal metadata to Hedera
      const message = JSON.stringify({
        ...metadata,
        dataHash,
        version: '1.0'
      });

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(message);

      const response = await transaction.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);
      
      console.log(`[HCS_SUCCESS] Hash anchored to topic ${topicId.toString()}, seq: ${receipt.topicSequenceNumber?.toString()}`);
    } catch (error) {
      console.error(`[HCS_ERROR] Failed to submit to topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Verify audit event integrity against Hedera HCS
   */
  async verifyAuditIntegrity(eventId: number): Promise<boolean> {
    try {
      // Get event from PostgreSQL
      const event = await storage.getAuditEventById(eventId);
      if (!event) return false;

      // Calculate current hash
      const currentHash = createHash('sha256')
        .update(JSON.stringify(event))
        .digest('hex');

      // Query Hedera Mirror Node for original hash
      const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';
      const topicId = this.auditTopicId?.toString();
      
      if (!topicId) return false;

      const response = await fetch(
        `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages?limit=100`
      );
      const data = await response.json();

      // Find matching event
      const hcsMessage = data.messages?.find((msg: any) => {
        try {
          const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString());
          return decoded.eventId === eventId;
        } catch {
          return false;
        }
      });

      if (!hcsMessage) {
        console.warn(`[HCS_VERIFY] No HCS record found for event ${eventId}`);
        return false;
      }

      const hcsData = JSON.parse(Buffer.from(hcsMessage.message, 'base64').toString());
      const originalHash = hcsData.dataHash;

      // Compare hashes
      const isValid = currentHash === originalHash;
      console.log(`[HCS_VERIFY] Event ${eventId} integrity: ${isValid ? 'VALID' : 'TAMPERED'}`);
      
      return isValid;
    } catch (error) {
      console.error(`[HCS_VERIFY] Failed to verify event ${eventId}:`, error);
      return false;
    }
  }
}

export const auditService = AuditService.getInstance();