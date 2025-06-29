import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  encryptionKey: text("encryption_key"), // For patient-controlled encryption
  recordType: text("record_type").default("traditional"), // "traditional" or "web3"
});

export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  accessedBy: integer("accessed_by").notNull().references(() => users.id),
  recordId: integer("record_id").notNull().references(() => patientRecords.id),
  consentGrantedBy: text("consent_granted_by").notNull(),
  accessedAt: timestamp("accessed_at").defaultNow(),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  hospitalName: true,
  hospitalType: true,
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
  encryptionKey: true,
  recordType: true,
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  accessedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPatientProfile = z.infer<typeof insertPatientProfileSchema>;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type InsertPatientRecord = z.infer<typeof insertPatientRecordSchema>;
export type PatientRecord = typeof patientRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;

// Emergency Consent Records
export const emergencyConsentRecords = pgTable("emergency_consent_records", {
  id: text("id").primaryKey(), // Using the service-generated ID: `emergency_${Date.now()}_${random}`
  patientId: text("patient_id").notNull(), // Can be National ID or Patient DID
  hospitalId: text("hospital_id").notNull(), // Identifier for the hospital where emergency occurred
  emergencyType: text("emergency_type").notNull(),
  medicalJustification: text("medical_justification").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  primaryPhysicianDetails: jsonb("primary_physician_details").notNull(), // Stores AuthorizedPersonnel object
  secondaryAuthorizerDetails: jsonb("secondary_authorizer_details").notNull(), // Stores AuthorizedPersonnel object
  nextOfKinConsentDetails: jsonb("next_of_kin_consent_details"), // Stores NextOfKinConsentResult object
  limitations: jsonb("limitations"), // Array of strings
  temporaryCredentialDetails: text("temporary_credential_details"), // Stores the base64 encoded credential string
  auditTrail: text("audit_trail"),
  revokedAt: timestamp("revoked_at"), // When/if explicitly revoked before expiry
});

export const insertEmergencyConsentRecordSchema = createInsertSchema(emergencyConsentRecords);

export type InsertEmergencyConsentRecord = z.infer<typeof insertEmergencyConsentRecordSchema>;
export type EmergencyConsentRecordSchema = typeof emergencyConsentRecords.$inferSelect;
