import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  hospitalName: text("hospital_name").notNull(),
  hospitalType: text("hospital_type").notNull(), // "A" or "B"
  walletAddress: text("wallet_address"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  email: text("email"),
  invitedBy: integer("invited_by"),
  invitationExpiresAt: timestamp("invitation_expires_at"),
  passwordChangedAt: timestamp("password_changed_at"),
  isInvitationActive: boolean("is_invitation_active").default(false),
  hospital_id: integer("hospital_id").notNull(),
  adminLicense: text("admin_license"),
  createdAt: timestamp("created_at").defaultNow(),
});

// New patient profiles table to link DID with National ID
export const patientProfiles = pgTable("patient_profiles", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull().unique(), // Decentralized Identifier
  nationalId: text("national_id").notNull().unique(), // National ID for traditional records
  phoneNumber: text("phone_number").notNull().unique(), // Phone number for login
  email: text("email"), // Optional email
  fullName: text("full_name").notNull(), // Patient's full name
  isProfileComplete: boolean("is_profile_complete").default(false), // Whether National ID has been provided
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  hospital_id: integer("hospital_id"),
});

export const patientRecords = pgTable("patient_records", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did"), // Made optional for traditional records
  nationalId: text("national_id").notNull(), // Always required for traditional records
  patientName: text("patient_name").notNull(),
  visitDate: text("visit_date").notNull(),
  visitType: text("visit_type"),
  diagnosis: text("diagnosis").notNull(),
  prescription: text("prescription"),
  physician: text("physician"),
  department: text("department"),
  submittedBy: integer("submitted_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at").defaultNow(),
  consentGiven: boolean("consent_given").default(false),
  ipfsHash: text("ipfs_hash"), // IPFS content hash
  filecoinCid: text("filecoin_cid"), // Filecoin content identifier
  encryptionKey: text("encryption_key"), // For patient-controlled encryption
  recordType: text("record_type").default("traditional"), // "traditional" or "web3"
  storageCost: decimal("storage_cost", { precision: 20, scale: 8 }).default("0"), // Storage cost in FIL
  storageMetadata: jsonb("storage_metadata"), // Additional storage metadata
  hospital_id: integer("hospital_id").notNull(),
  entities: jsonb("entities"), // NLP-extracted entities
  icd_codes: jsonb("icd_codes"), // ICD-11 codes
});

export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  accessedBy: integer("accessed_by").notNull().references(() => users.id),
  recordId: integer("record_id").notNull().references(() => patientRecords.id),
  consentGrantedBy: text("consent_granted_by").notNull(),
  accessedAt: timestamp("accessed_at").defaultNow(),
  consent_type: text("consent_type").notNull().default('traditional'),
  hospital_id: integer("hospital_id").notNull(),
});

// Filecoin deals table
export const filecoinDeals = pgTable("filecoin_deals", {
  id: serial("id").primaryKey(),
  dealId: text("deal_id").notNull().unique(),
  contentHash: text("content_hash").notNull(),
  patientDID: text("patient_did").notNull(),
  storageProvider: text("storage_provider").notNull(),
  dealSize: integer("deal_size").notNull(),
  dealCost: decimal("deal_cost", { precision: 20, scale: 8 }).notNull(),
  dealDuration: integer("deal_duration").notNull(), // in epochs
  dealStatus: text("deal_status").notNull(), // 'active', 'expired', 'terminated'
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Storage locations table
export const storageLocations = pgTable("storage_locations", {
  id: serial("id").primaryKey(),
  contentHash: text("content_hash").notNull(),
  storageType: text("storage_type").notNull(), // 'ipfs', 'filecoin', 'local'
  locationId: text("location_id").notNull(), // CID, Deal ID, or local path
  status: text("status").notNull(), // 'active', 'archived', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  lastVerified: timestamp("last_verified"),
});

// Storage costs table
export const storageCosts = pgTable("storage_costs", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull(),
  storageType: text("storage_type").notNull(),
  costAmount: decimal("cost_amount", { precision: 20, scale: 8 }).notNull(),
  costCurrency: text("cost_currency").notNull().default('FIL'),
  billingPeriod: text("billing_period").notNull(), // 'monthly', 'yearly', 'one_time'
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
});

// Storage health metrics table
export const storageHealthMetrics = pgTable("storage_health_metrics", {
  id: serial("id").primaryKey(),
  storageType: text("storage_type").notNull(),
  healthStatus: text("health_status").notNull(), // 'healthy', 'degraded', 'critical'
  responseTimeMs: integer("response_time_ms"),
  availabilityPercentage: decimal("availability_percentage", { precision: 5, scale: 2 }),
  lastCheckAt: timestamp("last_check_at").defaultNow(),
  details: jsonb("details"),
});

// Hospital staff table for emergency consent verification
export const hospitalStaff = pgTable("hospital_staff", {
  id: serial("id").primaryKey(),
  staffId: text("staff_id").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'ADMIN', 'PHYSICIAN', 'SURGEON', 'EMERGENCY_DOCTOR', 'CHIEF_RESIDENT'
  licenseNumber: text("license_number").notNull(),
  department: text("department").notNull(),
  email: text("email"), // Staff email for invitations and communication
  hospitalId: text("hospital_id").notNull(), // Link to hospital for multi-tenancy
  isActive: boolean("is_active").default(true).notNull(),
  isOnDuty: boolean("is_on_duty").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure only one admin per hospital
  unique("one_admin_per_hospital").on(table.hospitalId, table.role),
]);

export const hospitalStaffInvitations = pgTable("hospital_staff_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  hospitalId: integer("hospital_id").notNull(),
  invitedBy: integer("invited_by").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  invitationToken: text("invitation_token").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired', 'cancelled'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  acceptedUserId: integer("accepted_user_id"),
});

// Patient emergency contacts table
export const patientEmergencyContacts = pgTable("patient_emergency_contacts", {
  id: serial("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  isVerified: boolean("is_verified").default(false).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Emergency consent records table
export const emergencyConsentRecords = pgTable("emergency_consent_records", {
  id: text("id").primaryKey().notNull(),
  patientId: text("patient_id").notNull(),
  hospitalId: text("hospital_id").notNull(),
  emergencyType: text("emergency_type").notNull(),
  medicalJustification: text("medical_justification").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  primaryPhysicianDetails: jsonb("primary_physician_details").notNull(),
  secondaryAuthorizerDetails: jsonb("secondary_authorizer_details").notNull(),
  nextOfKinConsentDetails: jsonb("next_of_kin_consent_details"),
  limitations: jsonb(),
  temporaryCredentialDetails: text("temporary_credential_details"),
  auditTrail: text("audit_trail"),
  revokedAt: timestamp("revoked_at"),
});

// ZKP Proofs table for privacy-preserving medical verification
export const zkpProofs = pgTable("zkp_proofs", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull(),
  proofType: text("proof_type").notNull(), // 'condition', 'age', 'allergy', 'medication'
  publicStatement: text("public_statement").notNull(), // What we're proving
  secretData: text("secret_data").notNull(), // Encrypted original data
  proofData: jsonb("proof_data").notNull(), // The actual ZKP
  challenge: text("challenge").notNull(), // Random challenge used
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  verificationCount: integer("verification_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ZKP Verifications table for audit trail
export const zkpVerifications = pgTable("zkp_verifications", {
  id: serial("id").primaryKey(),
  proofId: integer("proof_id").notNull().references(() => zkpProofs.id),
  verifiedBy: integer("verified_by").notNull().references(() => users.id),
  verificationResult: boolean("verification_result").notNull(),
  verificationContext: text("verification_context"), // Why verification was needed
  verifiedAt: timestamp("verified_at").defaultNow(),
  hospitalId: text("hospital_id").notNull(),
  emergencyAccess: boolean("emergency_access").default(false).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  submittedRecords: many(patientRecords),
  consentRecords: many(consentRecords),
}));

export const patientProfilesRelations = relations(patientProfiles, ({ many }) => ({
  records: many(patientRecords),
}));

export const patientRecordsRelations = relations(patientRecords, ({ one, many }) => ({
  submittedBy: one(users, {
    fields: [patientRecords.submittedBy],
    references: [users.id],
  }),
  patientProfile: one(patientProfiles, {
    fields: [patientRecords.patientDID],
    references: [patientProfiles.patientDID],
  }),
  consentRecords: many(consentRecords),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  accessedBy: one(users, {
    fields: [consentRecords.accessedBy],
    references: [users.id],
  }),
  record: one(patientRecords, {
    fields: [consentRecords.recordId],
    references: [patientRecords.id],
  }),
}));

export const zkpProofsRelations = relations(zkpProofs, ({ one, many }) => ({
  patient: one(patientProfiles, {
    fields: [zkpProofs.patientDID],
    references: [patientProfiles.patientDID],
  }),
  verifications: many(zkpVerifications),
}));

export const zkpVerificationsRelations = relations(zkpVerifications, ({ one }) => ({
  proof: one(zkpProofs, {
    fields: [zkpVerifications.proofId],
    references: [zkpProofs.id],
  }),
  verifiedByUser: one(users, {
    fields: [zkpVerifications.verifiedBy],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPatientProfileSchema = createInsertSchema(patientProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientRecordSchema = createInsertSchema(patientRecords).omit({
  id: true,
  submittedBy: true,
  submittedAt: true,
  ipfsHash: true,
  filecoinCid: true,
  encryptionKey: true,
  recordType: true,
  storageCost: true,
  storageMetadata: true,
  hospital_id: true,
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  accessedAt: true,
});

export const insertFilecoinDealSchema = createInsertSchema(filecoinDeals).omit({
  id: true,
  createdAt: true,
});

export const insertStorageLocationSchema = createInsertSchema(storageLocations).omit({
  id: true,
  createdAt: true,
});

export const insertStorageCostSchema = createInsertSchema(storageCosts).omit({
  id: true,
  createdAt: true,
});

export const insertStorageHealthMetricSchema = createInsertSchema(storageHealthMetrics).omit({
  id: true,
  lastCheckAt: true,
});

export const insertHospitalStaffSchema = createInsertSchema(hospitalStaff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientEmergencyContactSchema = createInsertSchema(patientEmergencyContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmergencyConsentRecordSchema = createInsertSchema(emergencyConsentRecords).omit({
  grantedAt: true,
});

export const insertZKPProofSchema = createInsertSchema(zkpProofs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
  verificationCount: true,
});

export const insertZKPVerificationSchema = createInsertSchema(zkpVerifications).omit({
  id: true,
  verifiedAt: true,
});

// Feedback table for MediBridge airtime rewards
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  airtimeSent: boolean("airtime_sent").default(false).notNull(),
  airtimeAmount: integer("airtime_amount").default(0).notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  submittedAt: true,
  airtimeSent: true,
  airtimeAmount: true,
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPatientProfile = z.infer<typeof insertPatientProfileSchema>;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type InsertPatientRecord = z.infer<typeof insertPatientRecordSchema>;
export type PatientRecord = typeof patientRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertFilecoinDeal = z.infer<typeof insertFilecoinDealSchema>;
export type FilecoinDeal = typeof filecoinDeals.$inferSelect;
export type InsertStorageLocation = z.infer<typeof insertStorageLocationSchema>;
export type StorageLocation = typeof storageLocations.$inferSelect;
export type InsertStorageCost = z.infer<typeof insertStorageCostSchema>;
export type StorageCost = typeof storageCosts.$inferSelect;
export type InsertStorageHealthMetric = z.infer<typeof insertStorageHealthMetricSchema>;
export type StorageHealthMetric = typeof storageHealthMetrics.$inferSelect;
export type InsertHospitalStaff = z.infer<typeof insertHospitalStaffSchema>;
export type HospitalStaff = typeof hospitalStaff.$inferSelect;
export type InsertPatientEmergencyContact = z.infer<typeof insertPatientEmergencyContactSchema>;
export type PatientEmergencyContact = typeof patientEmergencyContacts.$inferSelect;
export type InsertEmergencyConsentRecord = z.infer<typeof insertEmergencyConsentRecordSchema>;
export type EmergencyConsentRecordSchema = typeof emergencyConsentRecords.$inferSelect;
export type InsertZKPProof = z.infer<typeof insertZKPProofSchema>;
export type ZKPProof = typeof zkpProofs.$inferSelect;
export type InsertZKPVerification = z.infer<typeof insertZKPVerificationSchema>;
export type ZKPVerification = typeof zkpVerifications.$inferSelect;
export type InsertHospitalStaffInvitation = typeof hospitalStaffInvitations.$inferInsert;
export type HospitalStaffInvitation = typeof hospitalStaffInvitations.$inferSelect;

// USSD Sessions table for tracking user sessions
export const ussdSessions = pgTable("ussd_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  phoneNumber: text("phone_number").notNull(),
  language: text("language").notNull().default('en'), // 'en' or 'sw'
  currentStep: text("current_step"), // Current menu step
  sessionData: jsonb("session_data"), // Store user selections
  startedAt: timestamp("started_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Session expiry
});

// Clinic codes table for proof renewal validation
export const clinicCodes = pgTable("clinic_codes", {
  id: serial("id").primaryKey(),
  clinicCode: text("clinic_code").notNull().unique(),
  clinicName: text("clinic_name").notNull(),
  location: text("location"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// USSD Analytics table for tracking usage
export const ussdAnalytics = pgTable("ussd_analytics", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  eventType: text("event_type").notNull(), // 'PROOF_SHARED', 'EMERGENCY_PROOF', 'PROOF_RENEWED', 'FEEDBACK_SUBMITTED'
  eventData: jsonb("event_data"), // Additional event data
  language: text("language").notNull().default('en'),
  timestamp: timestamp("timestamp").defaultNow(),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
});

export const proofCodes = pgTable("proof_codes", {
  id: serial("id").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  proofId: integer("proof_id").notNull().references(() => zkpProofs.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  used: boolean("used").default(false),
  attempts: integer("attempts").default(0),
});
