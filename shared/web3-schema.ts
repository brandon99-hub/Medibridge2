import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Patient DIDs and Web3 Identities
export const patientIdentities = pgTable("patient_identities", {
  id: serial("id").primaryKey(),
  did: text("did").notNull().unique(), // Decentralized Identifier
  walletAddress: text("wallet_address"),
  publicKey: text("public_key").notNull(),
  didDocument: jsonb("did_document"), // Full DID Document
  phoneNumber: text("phone_number"), // <-- Added for phone lookups
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verifiable Credentials for patient consent
export const verifiableCredentials = pgTable("verifiable_credentials", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull().references(() => patientIdentities.did),
  issuerDID: text("issuer_did").notNull(), // Hospital DID
  credentialType: text("credential_type").notNull(), // "HealthcareConsent", "MedicalRecord", etc.
  credentialSubject: jsonb("credential_subject"), // Can be extracted from JWT or stored if needed for querying
  issuanceDate: timestamp("issuance_date"), // Can be extracted from JWT
  expirationDate: timestamp("expiration_date"), // Can be extracted from JWT
  jwtVc: text("jwt_vc").notNull(), // Stores the full JWT string
  revoked: boolean("revoked").default(false),
  revokedAt: timestamp("revoked_at"),
});

// IPFS Content References
export const ipfsContent = pgTable("ipfs_content", {
  id: serial("id").primaryKey(),
  contentHash: text("content_hash").notNull().unique(), // IPFS hash
  patientDID: text("patient_did").notNull().references(() => patientIdentities.did),
  contentType: text("content_type").notNull(), // "medical_record", "lab_result", etc.
  encryptionMethod: text("encryption_method"), // "AES-256-GCM", etc.
  accessControlList: jsonb("access_control_list"), // Who can access
  createdAt: timestamp("created_at").defaultNow(),
  size: integer("size"), // Content size in bytes
});

// Consent Management with Verifiable Credentials
export const consentManagement = pgTable("consent_management", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull().references(() => patientIdentities.did),
  requesterId: text("requester_id").notNull(), // Hospital DID requesting access
  contentHash: text("content_hash").references(() => ipfsContent.contentHash),
  consentType: text("consent_type").notNull(), // "read", "write", "share"
  consentGiven: boolean("consent_given").default(false),
  consentCredentialId: integer("consent_credential_id").references(() => verifiableCredentials.id),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const patientIdentitiesRelations = relations(patientIdentities, ({ many }) => ({
  credentials: many(verifiableCredentials),
  content: many(ipfsContent),
  consents: many(consentManagement),
}));

export const verifiableCredentialsRelations = relations(verifiableCredentials, ({ one }) => ({
  patient: one(patientIdentities, {
    fields: [verifiableCredentials.patientDID],
    references: [patientIdentities.did],
  }),
}));

export const ipfsContentRelations = relations(ipfsContent, ({ one, many }) => ({
  patient: one(patientIdentities, {
    fields: [ipfsContent.patientDID],
    references: [patientIdentities.did],
  }),
  consents: many(consentManagement),
}));

export const consentManagementRelations = relations(consentManagement, ({ one }) => ({
  patient: one(patientIdentities, {
    fields: [consentManagement.patientDID],
    references: [patientIdentities.did],
  }),
  content: one(ipfsContent, {
    fields: [consentManagement.contentHash],
    references: [ipfsContent.contentHash],
  }),
  credential: one(verifiableCredentials, {
    fields: [consentManagement.consentCredentialId],
    references: [verifiableCredentials.id],
  }),
}));

// Insert schemas
export const insertPatientIdentitySchema = createInsertSchema(patientIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerifiableCredentialSchema = createInsertSchema(verifiableCredentials).omit({
  id: true,
  issuanceDate: true,
  revoked: true,
  revokedAt: true,
});

export const insertIpfsContentSchema = createInsertSchema(ipfsContent).omit({
  id: true,
  createdAt: true,
});

export const insertConsentManagementSchema = createInsertSchema(consentManagement).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertPatientIdentity = z.infer<typeof insertPatientIdentitySchema>;
export type PatientIdentity = typeof patientIdentities.$inferSelect;
export type InsertVerifiableCredential = z.infer<typeof insertVerifiableCredentialSchema>;
export type VerifiableCredential = typeof verifiableCredentials.$inferSelect;
export type InsertIpfsContent = z.infer<typeof insertIpfsContentSchema>;
export type IpfsContent = typeof ipfsContent.$inferSelect;
export type InsertConsentManagement = z.infer<typeof insertConsentManagementSchema>;
export type ConsentManagement = typeof consentManagement.$inferSelect;