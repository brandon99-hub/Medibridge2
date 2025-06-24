import { users, patientRecords, consentRecords, type User, type InsertUser, type PatientRecord, type InsertPatientRecord, type InsertConsentRecord, type ConsentRecord } from "@shared/schema";
import { 
  patientIdentities, 
  verifiableCredentials, 
  ipfsContent, 
  consentManagement,
  type PatientIdentity,
  type InsertPatientIdentity,
  type VerifiableCredential,
  type InsertVerifiableCredential,
  type IpfsContent,
  type InsertIpfsContent,
  type ConsentManagement,
  type InsertConsentManagement
} from "@shared/web3-schema";
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
  updateHospitalDID(hospitalId: number, hospitalDID: string): Promise<void>;
  
  // Patient Records
  createPatientRecord(record: InsertPatientRecord & { submittedBy: number }): Promise<PatientRecord>;
  getPatientRecordsByNationalId(nationalId: string): Promise<PatientRecord[]>;
  getPatientRecordsByDID(patientDID: string): Promise<PatientRecord[]>;
  getPatientRecordById(id: number): Promise<PatientRecord | undefined>;
  updateRecordIPFS(recordId: number, ipfsCid: string, encryptionKey: string): Promise<void>;
  
  // Consent Management
  createConsentRecord(consent: InsertConsentRecord): Promise<ConsentRecord>;
  getConsentRecordsByPatientId(patientId: string, accessedBy: number): Promise<ConsentRecord[]>;
  getPatientConsents(patientDID: string): Promise<ConsentRecord[]>;
  
  // Web3 Patient Identities (for existing features)
  createPatientIdentity(identity: InsertPatientIdentity): Promise<PatientIdentity>;
  getPatientIdentityByDID(did: string): Promise<PatientIdentity | undefined>;
  getPatientIdentityByWallet(walletAddress: string): Promise<PatientIdentity | undefined>;
  
  // Verifiable Credentials (for existing features)
  createVerifiableCredential(credential: InsertVerifiableCredential): Promise<VerifiableCredential>;
  getCredentialsByPatientDID(patientDID: string): Promise<VerifiableCredential[]>;
  revokeCredential(id: number): Promise<void>;
  
  // IPFS Content
  createIpfsContent(content: InsertIpfsContent): Promise<IpfsContent>;
  getIpfsContentByHash(hash: string): Promise<IpfsContent | undefined>;
  getContentByPatientDID(patientDID: string): Promise<IpfsContent[]>;
  
  // Web3 Consent Management
  createConsentManagement(consent: InsertConsentManagement): Promise<ConsentManagement>;
  getConsentByPatientAndRequester(patientDID: string, requesterDID: string): Promise<ConsentManagement[]>;
  revokeConsent(id: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

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

  async updateHospitalDID(hospitalId: number, hospitalDID: string): Promise<void> {
    // For now, we'll skip this as the current schema doesn't have hospitalDID
    console.log(`[INFO] Hospital DID ${hospitalDID} assigned to hospital ${hospitalId}`);
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

  async getPatientRecordsByDID(patientDID: string): Promise<PatientRecord[]> {
    return await db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.patientDID, patientDID))
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

  async getPatientConsents(patientDID: string): Promise<ConsentRecord[]> {
    return await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.patientId, patientDID))
      .orderBy(consentRecords.accessedAt);
  }

  async updateRecordIPFS(recordId: number, ipfsCid: string, encryptionKey: string): Promise<void> {
    await db
      .update(patientRecords)
      .set({ ipfsHash: ipfsCid, encryptionKey })
      .where(eq(patientRecords.id, recordId));
  }

  // Web3 Patient Identity Methods
  async createPatientIdentity(identity: InsertPatientIdentity): Promise<PatientIdentity> {
    const [patientIdentity] = await db
      .insert(patientIdentities)
      .values(identity)
      .returning();
    return patientIdentity;
  }

  async getPatientIdentityByDID(did: string): Promise<PatientIdentity | undefined> {
    const [identity] = await db
      .select()
      .from(patientIdentities)
      .where(eq(patientIdentities.did, did));
    return identity || undefined;
  }

  async getPatientIdentityByWallet(walletAddress: string): Promise<PatientIdentity | undefined> {
    const [identity] = await db
      .select()
      .from(patientIdentities)
      .where(eq(patientIdentities.walletAddress, walletAddress));
    return identity || undefined;
  }

  // Verifiable Credentials Methods
  // Verifiable Credentials Methods
  async createVerifiableCredential(credential: InsertVerifiableCredential): Promise<VerifiableCredential> {
    const [vc] = await db
      .insert(verifiableCredentials)
      .values(credential)
      .returning();
    return vc;
  }

  async getCredentialsByPatientDID(patientDID: string): Promise<VerifiableCredential[]> {
    return await db
      .select()
      .from(verifiableCredentials)
      .where(eq(verifiableCredentials.patientDID, patientDID));
  }

  async revokeCredential(id: number): Promise<void> {
    await db
      .update(verifiableCredentials)
      .set({ revoked: true, revokedAt: new Date() })
      .where(eq(verifiableCredentials.id, id));
  }

  // IPFS Content Methods
  async createIpfsContent(content: InsertIpfsContent): Promise<IpfsContent> {
    const [ipfsRecord] = await db
      .insert(ipfsContent)
      .values(content)
      .returning();
    return ipfsRecord;
  }

  async getIpfsContentByHash(hash: string): Promise<IpfsContent | undefined> {
    const [content] = await db
      .select()
      .from(ipfsContent)
      .where(eq(ipfsContent.contentHash, hash));
    return content || undefined;
  }

  async getContentByPatientDID(patientDID: string): Promise<IpfsContent[]> {
    return await db
      .select()
      .from(ipfsContent)
      .where(eq(ipfsContent.patientDID, patientDID));
  }

  // Web3 Consent Management Methods
  async createConsentManagement(consent: InsertConsentManagement): Promise<ConsentManagement> {
    const [consentRecord] = await db
      .insert(consentManagement)
      .values(consent)
      .returning();
    return consentRecord;
  }

  async getConsentByPatientAndRequester(patientDID: string, requesterDID: string): Promise<ConsentManagement[]> {
    return await db
      .select()
      .from(consentManagement)
      .where(
        and(
          eq(consentManagement.patientDID, patientDID),
          eq(consentManagement.requesterDID, requesterDID)
        )
      );
  }

  async revokeConsent(id: number): Promise<void> {
    await db
      .update(consentManagement)
      .set({ revokedAt: new Date() })
      .where(eq(consentManagement.id, id));
  }
}

export const storage = new DatabaseStorage();
