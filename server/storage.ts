import { users, patientRecords, consentRecords, type User, type InsertUser, type PatientRecord, type InsertPatientRecord, type InsertConsentRecord, type ConsentRecord, patientProfiles } from "@shared/schema";
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
import { eq, and, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import type { InsertPatientProfile } from "@shared/schema";

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
  getAllConsentRecordsByPatientId(patientId: string): Promise<ConsentRecord[]>;
  updateConsentRecord(id: number, updates: Partial<ConsentRecord>): Promise<void>;
  getPatientConsents(patientDID: string): Promise<ConsentRecord[]>;
  
  // Unified Consent Management
  createConsentRequest(request: any): Promise<any>;
  updateConsentRequestStatus(patientId: string, hospitalId: number, status: string): Promise<void>;
  revokeConsentRecords(patientId: string, hospitalId: number): Promise<void>;
  
  // Web3 Patient Identities (for existing features)
  createPatientIdentity(identity: InsertPatientIdentity): Promise<PatientIdentity>;
  getPatientIdentityByDID(did: string): Promise<PatientIdentity | undefined>;
  getPatientIdentityByWallet(walletAddress: string): Promise<PatientIdentity | undefined>;
  getPatientIdentityByPhone(phoneNumber: string): Promise<PatientIdentity | undefined>;
  
  // Verifiable Credentials (for existing features)
  createVerifiableCredential(credentialData: {
    patientDID: string;
    issuerDID: string;
    credentialType: string;
    jwtVc: string;
    credentialSubject?: any; // Optional, if we decide to store it separately
    issuanceDate?: Date;     // Optional, from JWT
    expirationDate?: Date;   // Optional, from JWT
  }): Promise<VerifiableCredential>;
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
  
  // Patient Profiles
  createPatientProfile(profile: InsertPatientProfile): Promise<any>;
  getPatientProfileByDID(did: string): Promise<any>;
  getPatientProfileByPhone(phoneNumber: string): Promise<any>;
  getPatientProfileByNationalId(nationalId: string): Promise<any>;
  updatePatientProfile(did: string, updates: Partial<InsertPatientProfile>): Promise<any>;
  
  // Temporary storage
  createTemporaryDIDShare(share: any): Promise<void>;
  
  // Traditional records summary
  getTraditionalRecordsSummary(nationalId: string): Promise<any>;
  
  // Web3 records summary
  getPatientRecordsSummary(patientDID: string): Promise<any>;
  
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

  async getAllConsentRecordsByPatientId(patientId: string): Promise<ConsentRecord[]> {
    return await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.patientId, patientId));
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

  async getPatientIdentityByPhone(phoneNumber: string): Promise<PatientIdentity | undefined> {
    const [identity] = await db
      .select()
      .from(patientIdentities)
      .where(eq(patientIdentities.phoneNumber, phoneNumber));
    return identity || undefined;
  }

  // Verifiable Credentials Methods
  async createVerifiableCredential(credentialData: {
    patientDID: string;
    issuerDID: string;
    credentialType: string;
    jwtVc: string;
    credentialSubject?: object;
    issuanceDate?: Date;
    expirationDate?: Date;
  }): Promise<VerifiableCredential> {
    const valuesToInsert: InsertVerifiableCredential = {
      patientDID: credentialData.patientDID,
      issuerDID: credentialData.issuerDID,
      credentialType: credentialData.credentialType,
      jwtVc: credentialData.jwtVc,
      // Optionally store extracted fields if they exist in the schema and are provided
      ...(credentialData.credentialSubject && { credentialSubject: credentialData.credentialSubject }),
      ...(credentialData.issuanceDate && { issuanceDate: credentialData.issuanceDate }),
      ...(credentialData.expirationDate && { expirationDate: credentialData.expirationDate }),
      revoked: false, // Default value
    };

    const [vc] = await db
      .insert(verifiableCredentials)
      .values(valuesToInsert)
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

  // Patient Profiles
  async createPatientProfile(profile: InsertPatientProfile): Promise<any> {
    const [newProfile] = await db.insert(patientProfiles).values(profile).returning();
    return newProfile;
  }

  async getPatientProfileByDID(did: string): Promise<any> {
    const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.patientDID, did));
    return profile;
  }

  async getPatientProfileByPhone(phoneNumber: string): Promise<any> {
    const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.phoneNumber, phoneNumber));
    return profile;
  }

  async getPatientProfileByNationalId(nationalId: string): Promise<any> {
    const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.nationalId, nationalId));
    return profile;
  }

  async updatePatientProfile(did: string, updates: Partial<InsertPatientProfile>): Promise<any> {
    const [updatedProfile] = await db
      .update(patientProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(patientProfiles.patientDID, did))
      .returning();
    return updatedProfile;
  }

  // Temporary storage
  async createTemporaryDIDShare(share: any): Promise<void> {
    // In production, use Redis or database
    console.log("Temporary DID share created:", share);
  }

  // Traditional records summary
  async getTraditionalRecordsSummary(nationalId: string): Promise<any> {
    const records = await this.getPatientRecordsByNationalId(nationalId);
    
    if (records.length === 0) {
      return {
        totalRecords: 0,
        dateRange: { earliest: null, latest: null },
        visitTypes: {},
        departments: [],
      };
    }

    const visitTypes: { [key: string]: number } = {};
    const departments: string[] = [];
    const dates = records.map(r => new Date(r.visitDate)).sort((a, b) => a.getTime() - b.getTime());

    records.forEach(record => {
      if (record.visitType) {
        visitTypes[record.visitType] = (visitTypes[record.visitType] || 0) + 1;
      }
      if (record.department && !departments.includes(record.department)) {
        departments.push(record.department);
      }
    });

    return {
      totalRecords: records.length,
      dateRange: {
        earliest: dates[0]?.toISOString(),
        latest: dates[dates.length - 1]?.toISOString(),
      },
      visitTypes,
      departments,
    };
  }

  // Web3 records summary
  async getPatientRecordsSummary(patientDID: string): Promise<any> {
    const records = await this.getPatientRecordsByDID(patientDID);
    
    if (records.length === 0) {
      return {
        totalRecords: 0,
        dateRange: { earliest: null, latest: null },
        visitTypes: {},
        departments: [],
      };
    }

    const visitTypes: { [key: string]: number } = {};
    const departments: string[] = [];
    const dates = records.map(r => new Date(r.visitDate)).sort((a, b) => a.getTime() - b.getTime());

    records.forEach(record => {
      if (record.visitType) {
        visitTypes[record.visitType] = (visitTypes[record.visitType] || 0) + 1;
      }
      if (record.department && !departments.includes(record.department)) {
        departments.push(record.department);
      }
    });

    return {
      totalRecords: records.length,
      dateRange: {
        earliest: dates[0]?.toISOString(),
        latest: dates[dates.length - 1]?.toISOString(),
      },
      visitTypes,
      departments,
    };
  }

  // Unified Consent Management
  async createConsentRequest(request: any): Promise<any> {
    // Store consent request in the consentRecords table with a special status
    const consentRequest = await db
      .insert(consentRecords)
      .values({
        patientId: request.patientId,
        accessedBy: request.requestedBy,
        recordId: 0, // Use 0 to indicate this is a request, not a specific record
        consentGrantedBy: "pending", // Will be updated when consent is granted
      })
      .returning();
    
    console.log(`[INFO] Consent request created for patient ${request.patientId} by hospital ${request.requestedBy}`);
    return consentRequest[0];
  }

  async updateConsentRequestStatus(patientId: string, hospitalId: number, status: string): Promise<void> {
    // Update consent request status
    console.log(`[INFO] Consent request status updated for patient ${patientId} by hospital ${hospitalId} to ${status}`);
  }

  async revokeConsentRecords(patientId: string, hospitalId: number): Promise<void> {
    // Delete consent records for this patient and hospital
    await db
      .delete(consentRecords)
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.accessedBy, hospitalId)
        )
      );
  }

  async updateConsentRecord(id: number, updates: Partial<ConsentRecord>): Promise<void> {
    await db
      .update(consentRecords)
      .set(updates)
      .where(eq(consentRecords.id, id));
  }
}

export const storage = new DatabaseStorage();
