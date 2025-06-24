import { users, patientRecords, consentRecords, type User, type InsertUser, type PatientRecord, type InsertPatientRecord, type InsertConsentRecord, type ConsentRecord } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Patient Records
  createPatientRecord(record: InsertPatientRecord & { submittedBy: number }): Promise<PatientRecord>;
  getPatientRecordsByNationalId(nationalId: string): Promise<PatientRecord[]>;
  getPatientRecordById(id: number): Promise<PatientRecord | undefined>;
  
  // Consent Management
  createConsentRecord(consent: InsertConsentRecord): Promise<ConsentRecord>;
  getConsentRecordsByPatientId(patientId: string, accessedBy: number): Promise<ConsentRecord[]>;
  
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createPatientRecord(record: InsertPatientRecord & { submittedBy: number }): Promise<PatientRecord> {
    const [patientRecord] = await db
      .insert(patientRecords)
      .values(record)
      .returning();
    return patientRecord;
  }

  async getPatientRecordsByNationalId(nationalId: string): Promise<PatientRecord[]> {
    return await db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.nationalId, nationalId))
      .orderBy(patientRecords.submittedAt);
  }

  async getPatientRecordById(id: number): Promise<PatientRecord | undefined> {
    const [record] = await db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.id, id));
    return record || undefined;
  }

  async createConsentRecord(consent: InsertConsentRecord): Promise<ConsentRecord> {
    const [consentRecord] = await db
      .insert(consentRecords)
      .values(consent)
      .returning();
    return consentRecord;
  }

  async getConsentRecordsByPatientId(patientId: string, accessedBy: number): Promise<ConsentRecord[]> {
    return await db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.accessedBy, accessedBy)
        )
      );
  }
}

export const storage = new DatabaseStorage();
