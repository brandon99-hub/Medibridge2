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
  createdAt: timestamp("created_at").defaultNow(),
});

export const patientRecords = pgTable("patient_records", {
  id: serial("id").primaryKey(),
  patientDID: text("patient_did").notNull(), // Decentralized Identifier
  patientName: text("patient_name").notNull(),
  nationalId: text("national_id").notNull(),
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

export const patientRecordsRelations = relations(patientRecords, ({ one, many }) => ({
  submittedBy: one(users, {
    fields: [patientRecords.submittedBy],
    references: [users.id],
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

export const insertPatientRecordSchema = createInsertSchema(patientRecords).omit({
  id: true,
  submittedBy: true,
  submittedAt: true,
  ipfsHash: true,
  encryptionKey: true,
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  accessedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPatientRecord = z.infer<typeof insertPatientRecordSchema>;
export type PatientRecord = typeof patientRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;
