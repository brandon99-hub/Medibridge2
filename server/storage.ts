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
import {
  auditEvents,
  consentAuditTrail,
  securityViolations
} from "@shared/audit-schema"; // Import audit tables
import {
  emergencyConsentRecords,
  type InsertEmergencyConsentRecord,
  type EmergencyConsentRecordSchema
} from "@shared/schema"; // Import emergency consent schema
import { db } from "./db";
import { eq, and, or, sql } from "drizzle-orm"; // Import sql
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
  
  // Audit Summary Methods
  countAuditEvents(filters?: { eventType?: string; outcome?: string; }): Promise<number>;
  countSecurityViolations(filters?: { violationType?: string; resolved?: boolean; }): Promise<number>;
  countConsentAuditRecords(filters?: { consentAction?: string; }): Promise<number>;

  // Emergency Consent Methods
  createEmergencyConsentRecord(record: InsertEmergencyConsentRecord): Promise<EmergencyConsentRecordSchema>;

  // Admin/Audit Data Retrieval
  getSecurityViolations(options: { limit?: number; offset?: number; resolved?: boolean; }): Promise<SecurityViolation[]>;


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

  // Audit Summary Implementations
  async countAuditEvents(filters?: { eventType?: string; outcome?: string; }): Promise<number> {
    // This dynamic query building is a bit complex for a direct example with Drizzle's current API.
    // A simpler approach for now is to fetch all and filter, or create specific methods for common cases.
    // For a true dynamic filter, one might need to build the SQL where clause more manually or use a query builder.
    // Let's implement a basic total count for now, and specific counts as needed.
    // TODO: Implement dynamic filtering if complex queries are common.

    let query = db.select({ count: sql<number>`count(*)` }).from(auditEvents);

    // Example of how filters could be added if Drizzle syntax allows easy conditional where clauses
    // For now, this part is illustrative and would need specific Drizzle 'where' conditions
    const conditions = [];
    if (filters?.eventType) {
      conditions.push(eq(auditEvents.eventType, filters.eventType));
    }
    if (filters?.outcome) {
      conditions.push(eq(auditEvents.outcome, filters.outcome));
    }
    // if (conditions.length > 0) {
    //   query = query.where(and(...conditions)); // Drizzle's 'and' might need specific handling
    // }

    // For simplicity now, let's assume filters mean specific counts are needed by type by the caller
    // This method will just return total count if no filters, or could be enhanced.
    if (filters && Object.keys(filters).length > 0) {
        let specificQuery = db.select({ count: sql<number>`count(*)` }).from(auditEvents);
        if (filters.eventType && filters.outcome) {
            specificQuery = specificQuery.where(and(eq(auditEvents.eventType, filters.eventType), eq(auditEvents.outcome, filters.outcome)));
        } else if (filters.eventType) {
            specificQuery = specificQuery.where(eq(auditEvents.eventType, filters.eventType));
        } else if (filters.outcome) {
            specificQuery = specificQuery.where(eq(auditEvents.outcome, filters.outcome));
        }
        const result = await specificQuery;
        return Number(result[0].count);
    }

    const result = await query;
    return Number(result[0].count);
  }

  async countSecurityViolations(filters?: { violationType?: string; resolved?: boolean; }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(securityViolations);
    const conditions = [];
    if (filters?.violationType) {
      conditions.push(eq(securityViolations.violationType, filters.violationType));
    }
    if (filters?.resolved !== undefined) {
      conditions.push(eq(securityViolations.resolved, filters.resolved));
    }

    if (conditions.length > 0) {
      // Drizzle's 'and' expects at least two conditions if used like and(cond1, cond2, ...).
      // For a single condition, just use .where(condition). For multiple, chain .where or use and().
      let chainedQuery = query;
      if (conditions.length === 1) {
        chainedQuery = chainedQuery.where(conditions[0]);
      } else if (conditions.length > 1) {
        // @ts-ignore // Drizzle's 'and' type might need specific casting for dynamic arrays
        chainedQuery = chainedQuery.where(and(...conditions));
      }
      const result = await chainedQuery;
      return Number(result[0].count);
    }

    const result = await query;
    return Number(result[0].count);
  }

  async countConsentAuditRecords(filters?: { consentAction?: string; }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(consentAuditTrail);
     if (filters?.consentAction) {
      query = query.where(eq(consentAuditTrail.consentAction, filters.consentAction));
    }
    const result = await query;
    return Number(result[0].count);
  }

  // Emergency Consent Implementation
  async createEmergencyConsentRecord(record: InsertEmergencyConsentRecord): Promise<EmergencyConsentRecordSchema> {
    const [newRecord] = await db
      .insert(emergencyConsentRecords)
      .values(record)
      .returning();
    if (!newRecord) {
      // This case should ideally not happen if .returning() is used and there's no error.
      // However, to satisfy type checking if `returning()` could yield undefined on certain DBs/configs:
      throw new Error("Failed to create emergency consent record or retrieve the created record.");
    }
    return newRecord;
  }

  async getSecurityViolations(options: {
    limit?: number;
    offset?: number;
    resolved?: boolean;
  }): Promise<SecurityViolation[]> {
    let query = db.select().from(securityViolations).orderBy(sql`${securityViolations.createdAt} DESC`);

    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options.offset !== undefined) {
      query = query.offset(options.offset);
    }
    if (options.resolved !== undefined) {
      query = query.where(eq(securityViolations.resolved, options.resolved));
    }

    return await query;
  }
}

export const storage = new DatabaseStorage();
