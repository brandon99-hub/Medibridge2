import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Audit Event Schema - Comprehensive logging for security and compliance
 */
export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // CONSENT_GRANTED, RECORD_ACCESS, LOGIN_ATTEMPT, etc.
  actorType: text("actor_type").notNull(), // PATIENT, HOSPITAL, SYSTEM
  actorId: text("actor_id").notNull(), // Patient DID, Hospital ID, etc.
  targetType: text("target_type"), // RECORD, PATIENT, HOSPITAL
  targetId: text("target_id"), // Record ID, Patient DID, etc.
  action: text("action").notNull(), // CREATE, READ, UPDATE, DELETE, GRANT, REVOKE
  outcome: text("outcome").notNull(), // SUCCESS, FAILURE, PENDING
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional context data
  severity: text("severity").notNull().default("info"), // info, warning, error, critical
  createdAt: timestamp("created_at").defaultNow(),
  hospital_id: integer("hospital_id"), // NEW: for multi-tenancy
});

/**
 * Security Violations Schema - Track potential security issues
 */
export const securityViolations = pgTable("security_violations", {
  id: serial("id").primaryKey(),
  violationType: text("violation_type").notNull(), // UNAUTHORIZED_ACCESS, INVALID_CREDENTIAL, etc.
  severity: text("severity").notNull(), // low, medium, high, critical
  actorId: text("actor_id"),
  targetResource: text("target_resource"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  hospital_id: integer("hospital_id"), // NEW: for multi-tenancy
});

/**
 * Consent Audit Trail - Detailed consent event tracking
 */
export const consentAuditTrail = pgTable("consent_audit_trail", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull(),
  hospitalDID: text("hospital_did").notNull(),
  recordId: integer("record_id"),
  consentAction: text("consent_action").notNull(), // GRANTED, REVOKED, EXPIRED
  verificationMethod: text("verification_method").notNull(), // phone, email, wallet
  grantedBy: text("granted_by").notNull(), // Patient contact or name
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata"), // Additional consent details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const auditEventsRelations = relations(auditEvents, ({ many }) => ({
  relatedViolations: many(securityViolations),
}));

// Insert schemas
export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSecurityViolationSchema = createInsertSchema(securityViolations).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertConsentAuditSchema = createInsertSchema(consentAuditTrail).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertSecurityViolation = z.infer<typeof insertSecurityViolationSchema>;
export type SecurityViolation = typeof securityViolations.$inferSelect;
export type InsertConsentAudit = z.infer<typeof insertConsentAuditSchema>;
export type ConsentAudit = typeof consentAuditTrail.$inferSelect;