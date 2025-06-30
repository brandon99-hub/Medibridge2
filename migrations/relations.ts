import { relations } from "drizzle-orm/relations";
import { users, consentRecords, patientRecords, ipfsContent, consentManagement, verifiableCredentials, patientIdentities } from "./schema";

export const consentRecordsRelations = relations(consentRecords, ({one}) => ({
	user: one(users, {
		fields: [consentRecords.accessedBy],
		references: [users.id]
	}),
	patientRecord: one(patientRecords, {
		fields: [consentRecords.recordId],
		references: [patientRecords.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	consentRecords: many(consentRecords),
	patientRecords: many(patientRecords),
}));

export const patientRecordsRelations = relations(patientRecords, ({one, many}) => ({
	consentRecords: many(consentRecords),
	user: one(users, {
		fields: [patientRecords.submittedBy],
		references: [users.id]
	}),
}));

export const consentManagementRelations = relations(consentManagement, ({one}) => ({
	ipfsContent: one(ipfsContent, {
		fields: [consentManagement.contentHash],
		references: [ipfsContent.contentHash]
	}),
	verifiableCredential: one(verifiableCredentials, {
		fields: [consentManagement.consentCredentialId],
		references: [verifiableCredentials.id]
	}),
}));

export const ipfsContentRelations = relations(ipfsContent, ({one, many}) => ({
	consentManagements: many(consentManagement),
	patientIdentity: one(patientIdentities, {
		fields: [ipfsContent.patientDid],
		references: [patientIdentities.did]
	}),
}));

export const verifiableCredentialsRelations = relations(verifiableCredentials, ({one, many}) => ({
	consentManagements: many(consentManagement),
	patientIdentity: one(patientIdentities, {
		fields: [verifiableCredentials.patientDid],
		references: [patientIdentities.did]
	}),
}));

export const patientIdentitiesRelations = relations(patientIdentities, ({many}) => ({
	verifiableCredentials: many(verifiableCredentials),
	ipfsContents: many(ipfsContent),
}));