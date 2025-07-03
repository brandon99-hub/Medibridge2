import { pgTable, foreignKey, serial, text, integer, timestamp, unique, boolean, jsonb, index, varchar, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const consentRecords = pgTable("consent_records", {
	id: serial().primaryKey().notNull(),
	patientId: text("patient_id").notNull(),
	accessedBy: integer("accessed_by").notNull(),
	recordId: integer("record_id").notNull(),
	consentGrantedBy: text("consent_granted_by").notNull(),
	accessedAt: timestamp("accessed_at", { mode: 'string' }).defaultNow(),
	consent_type: text("consent_type").notNull().default('traditional'),
	hospital_id: integer("hospital_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accessedBy],
			foreignColumns: [users.id],
			name: "consent_records_accessed_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.recordId],
			foreignColumns: [patientRecords.id],
			name: "consent_records_record_id_patient_records_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	hospitalName: text("hospital_name").notNull(),
	hospitalType: text("hospital_type").notNull(),
	walletAddress: text("wallet_address"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	email: text(),
	invitedBy: integer("invited_by"),
	invitationExpiresAt: timestamp("invitation_expires_at", { mode: 'string' }),
	passwordChangedAt: timestamp("password_changed_at", { mode: 'string' }),
	isInvitationActive: boolean("is_invitation_active").default(false),
	hospital_id: integer("hospital_id"),
	adminLicense: text("admin_license"),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const patientRecords = pgTable("patient_records", {
	id: serial().primaryKey().notNull(),
	patientDid: text("patient_did"),
	patientName: text("patient_name").notNull(),
	nationalId: text("national_id").notNull(),
	visitDate: text("visit_date").notNull(),
	visitType: text("visit_type"),
	diagnosis: text().notNull(),
	prescription: text(),
	physician: text(),
	department: text(),
	submittedBy: integer("submitted_by").notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow(),
	consentGiven: boolean("consent_given").default(false),
	ipfsHash: text("ipfs_hash"),
	encryptionKey: text("encryption_key"),
	recordType: text("record_type").default('traditional'),
	hospital_id: integer("hospital_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [users.id],
			name: "patient_records_submitted_by_users_id_fk"
		}),
]);

export const patientProfiles = pgTable("patient_profiles", {
	id: serial().primaryKey().notNull(),
	patientDid: text("patient_did").notNull(),
	nationalId: text("national_id").notNull(),
	phoneNumber: text("phone_number").notNull(),
	email: text(),
	fullName: text("full_name").notNull(),
	isProfileComplete: boolean("is_profile_complete").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	hospital_id: integer("hospital_id"),
}, (table) => [
	unique("patient_profiles_patient_did_unique").on(table.patientDid),
	unique("patient_profiles_national_id_unique").on(table.nationalId),
	unique("patient_profiles_phone_number_unique").on(table.phoneNumber),
]);

export const emergencyConsentRecords = pgTable("emergency_consent_records", {
	id: text().primaryKey().notNull(),
	patientId: text("patient_id").notNull(),
	hospitalId: text("hospital_id").notNull(),
	emergencyType: text("emergency_type").notNull(),
	medicalJustification: text("medical_justification").notNull(),
	grantedAt: timestamp("granted_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	primaryPhysicianDetails: jsonb("primary_physician_details").notNull(),
	secondaryAuthorizerDetails: jsonb("secondary_authorizer_details").notNull(),
	nextOfKinConsentDetails: jsonb("next_of_kin_consent_details"),
	limitations: jsonb(),
	temporaryCredentialDetails: text("temporary_credential_details"),
	auditTrail: text("audit_trail"),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
});

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const auditEvents = pgTable("audit_events", {
	id: serial().primaryKey().notNull(),
	eventType: text("event_type").notNull(),
	actorType: text("actor_type").notNull(),
	actorId: text("actor_id").notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	action: text().notNull(),
	outcome: text().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	metadata: jsonb(),
	severity: text().default('info').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const securityViolations = pgTable("security_violations", {
	id: serial().primaryKey().notNull(),
	violationType: text("violation_type").notNull(),
	severity: text().notNull(),
	actorId: text("actor_id"),
	targetResource: text("target_resource"),
	details: jsonb(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	resolved: boolean().default(false),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const consentAuditTrail = pgTable("consent_audit_trail", {
	id: serial().primaryKey().notNull(),
	patientDid: text("patient_did").notNull(),
	hospitalDid: text("hospital_did").notNull(),
	recordId: integer("record_id"),
	consentAction: text("consent_action").notNull(),
	verificationMethod: text("verification_method").notNull(),
	grantedBy: text("granted_by").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	metadata: jsonb(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const consentManagement = pgTable("consent_management", {
	id: serial().primaryKey().notNull(),
	patientDid: text("patient_did").notNull(),
	requesterId: text("requester_id").notNull(),
	consentType: text("consent_type").notNull(),
	granted: boolean().default(false),
	grantedAt: timestamp("granted_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	contentHash: text("content_hash"),
	consentGiven: boolean("consent_given").default(false),
	consentCredentialId: integer("consent_credential_id"),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
}, (table) => [
	index("idx_consent_management_content").using("btree", table.contentHash.asc().nullsLast().op("text_ops")),
	index("idx_consent_management_credential").using("btree", table.consentCredentialId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.contentHash],
			foreignColumns: [ipfsContent.contentHash],
			name: "consent_management_content_hash_fkey"
		}),
	foreignKey({
			columns: [table.consentCredentialId],
			foreignColumns: [verifiableCredentials.id],
			name: "consent_management_consent_credential_id_fkey"
		}),
]);

export const patientIdentities = pgTable("patient_identities", {
	id: serial().primaryKey().notNull(),
	did: text().notNull(),
	walletAddress: text("wallet_address"),
	publicKey: text("public_key").notNull(),
	didDocument: jsonb("did_document"),
	phoneNumber: text("phone_number"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_patient_identities_did").using("btree", table.did.asc().nullsLast().op("text_ops")),
	index("idx_patient_identities_phone").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	unique("patient_identities_did_key").on(table.did),
]);

export const verifiableCredentials = pgTable("verifiable_credentials", {
	id: serial().primaryKey().notNull(),
	patientDid: text("patient_did").notNull(),
	issuerDid: text("issuer_did").notNull(),
	credentialType: text("credential_type").notNull(),
	credentialSubject: jsonb("credential_subject"),
	issuanceDate: timestamp("issuance_date", { mode: 'string' }),
	expirationDate: timestamp("expiration_date", { mode: 'string' }),
	jwtVc: text("jwt_vc").notNull(),
	revoked: boolean().default(false),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
}, (table) => [
	index("idx_verifiable_credentials_patient").using("btree", table.patientDid.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.patientDid],
			foreignColumns: [patientIdentities.did],
			name: "verifiable_credentials_patient_did_fkey"
		}),
]);

export const ipfsContent = pgTable("ipfs_content", {
	id: serial().primaryKey().notNull(),
	contentHash: text("content_hash").notNull(),
	patientDid: text("patient_did").notNull(),
	contentType: text("content_type").notNull(),
	encryptionMethod: text("encryption_method"),
	accessControlList: jsonb("access_control_list"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	size: integer(),
}, (table) => [
	index("idx_ipfs_content_patient").using("btree", table.patientDid.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.patientDid],
			foreignColumns: [patientIdentities.did],
			name: "ipfs_content_patient_did_fkey"
		}),
	unique("ipfs_content_content_hash_key").on(table.contentHash),
]);

export const hospitalStaff = pgTable("hospital_staff", {
	id: serial().primaryKey().notNull(),
	staffId: text("staff_id").notNull(),
	name: text("name").notNull(),
	role: text("role").notNull(),
	licenseNumber: text("license_number").notNull(),
	department: text("department").notNull(),
	hospitalId: text("hospital_id").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isOnDuty: boolean("is_on_duty").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("hospital_staff_staff_id_unique").on(table.staffId),
]);
