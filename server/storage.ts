import { users, patientRecords, consentRecords, type User, type InsertUser, type PatientRecord, type InsertPatientRecord, type InsertConsentRecord, type ConsentRecord, patientProfiles, filecoinDeals, storageLocations, storageCosts, storageHealthMetrics, type InsertFilecoinDeal, type FilecoinDeal, type InsertStorageLocation, type StorageLocation, type InsertStorageCost, type StorageCost, type InsertStorageHealthMetric, type StorageHealthMetric, zkpProofs, zkpVerifications, type InsertZKPProof, type ZKPProof, type InsertZKPVerification, type ZKPVerification, hospitalStaff, patientEmergencyContacts, hospitalStaffInvitations, type HospitalStaff, type InsertHospitalStaff, type PatientEmergencyContact, type InsertPatientEmergencyContact, type HospitalStaffInvitation, type InsertHospitalStaffInvitation, feedback, proofCodes } from "@shared/schema";
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
  securityViolations,
  type SecurityViolation
} from "@shared/audit-schema"; // Import audit tables
import {
  emergencyConsentRecords,
  type InsertEmergencyConsentRecord,
  type EmergencyConsentRecordSchema
} from "@shared/schema"; // Import emergency consent schema
import { db } from "./db";
import { eq, and, or, sql, isNull, gt, desc, inArray, lt, gte, lte } from "drizzle-orm"; // Import sql and inArray
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import type { InsertPatientProfile } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateHospitalDID(hospitalId: number, hospitalDID: string): Promise<void>;
  
  // Patient Records
  createPatientRecord(record: Omit<InsertPatientRecord, "hospital_id"> & { submittedBy: number, hospital_id: number }): Promise<PatientRecord>;
  getPatientRecordsByNationalId(nationalId: string): Promise<PatientRecord[]>;
  getPatientRecordsByDID(patientDID: string): Promise<PatientRecord[]>;
  getWeb3PatientRecordsByDID(patientDID: string): Promise<PatientRecord[]>;
  getPatientRecordById(id: number): Promise<PatientRecord | undefined>;
  updateRecordIPFS(recordId: number, ipfsCid: string, encryptionKey: string): Promise<void>;
  updateRecordFilecoin(recordId: number, filecoinCid: string, storageCost: number, storageMetadata: any): Promise<void>;
  
  // Consent Management
  createConsentRecord(consent: InsertConsentRecord): Promise<ConsentRecord>;
  getConsentRecordsByPatientId(patientId: string, accessedBy: number): Promise<ConsentRecord[]>;
  getAllConsentRecordsByPatientId(patientId: string): Promise<ConsentRecord[]>;
  updateConsentRecord(id: number, updates: Partial<ConsentRecord>): Promise<void>;
  getPatientConsents(patientDID: string): Promise<ConsentRecord[]>;
  
  // Unified Consent Management
  createConsentRequest(request: any): Promise<any>;
  getPendingConsentRequests(patientId: string): Promise<any[]>;
  getConsentRequestById(requestId: number): Promise<any>;
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
  getCredentialById(id: number): Promise<VerifiableCredential | undefined>;
  revokeCredential(id: number): Promise<void>;
  
  // IPFS Content
  createIpfsContent(content: InsertIpfsContent): Promise<IpfsContent>;
  getIpfsContentByHash(hash: string): Promise<IpfsContent | undefined>;
  getContentByPatientDID(patientDID: string): Promise<IpfsContent[]>;
  
  // Web3 Consent Management
  createConsentManagement(consent: InsertConsentManagement): Promise<ConsentManagement>;
  getConsentByPatientAndRequester(patientDID: string, requesterId: string): Promise<ConsentManagement[]>;
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
  countAuditEvents(filters?: { eventType?: string | string[]; outcome?: string; hospital_id?: number }): Promise<number>;
  countSecurityViolations(filters?: { violationType?: string; resolved?: boolean; hospital_id?: number }): Promise<number>;
  countConsentAuditRecords(filters?: { consentAction?: string; }): Promise<number>;

  // Emergency Consent Methods
  createEmergencyConsentRecord(record: InsertEmergencyConsentRecord): Promise<EmergencyConsentRecordSchema>;
  getEmergencyConsentRecord(id: string): Promise<EmergencyConsentRecordSchema | undefined>;

  // Admin/Audit Data Retrieval
  getSecurityViolations(options?: { limit?: number; offset?: number; resolved?: boolean; hospital_id?: number }): Promise<SecurityViolation[]>;
  resolveSecurityViolation(violationId: number, hospital_id: number): Promise<void>;
  unresolveSecurityViolation(violationId: number, hospital_id: number): Promise<void>;

  // Utility: Find patient profile by email or phone
  findPatientProfileByEmailOrPhone(email?: string, phone?: string): Promise<any>;

  // Utility: Update patient profile to add missing email or phone
  updatePatientProfileIdentifiers(patientDID: string, identifiers: { email?: string, phoneNumber?: string }): Promise<any>;

  // Additional method
  updatePatientIdentityPhoneNumber(patientDID: string, phoneNumber: string): Promise<void>;

  // New method
  getAllActiveWeb3Consents(patientDID: string): Promise<ConsentManagement[]>;

  // New method
  createWeb3Consent(consent: {
    patientDID: string;
    requesterId: string;
    consentType?: string;
    consentGiven: boolean;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
  }): Promise<ConsentManagement>;

  // New method
  updateWeb3Consent(id: number, updates: Partial<ConsentManagement>): Promise<void>;

  sessionStore: session.Store;

  // Store a consent audit event in the consent_audit_trail table
  createConsentAudit(audit: any): Promise<void>;

  // Store an audit event in the audit_events table
  createAuditEvent(audit: any, hospital_id?: number): Promise<void>;

  // Store a security violation in the security_violations table
  createSecurityViolation(violation: any, hospital_id?: number): Promise<void>;

  // Fetch the N most recent audit events
  getRecentAuditEvents(limit?: number): Promise<any[]>;

  // Filecoin Deals Methods
  createFilecoinDeal(deal: InsertFilecoinDeal): Promise<FilecoinDeal>;
  getFilecoinDealById(id: number): Promise<FilecoinDeal | undefined>;
  getFilecoinDealByDealId(dealId: string): Promise<FilecoinDeal | undefined>;
  getFilecoinDealsByPatientDID(patientDID: string): Promise<FilecoinDeal[]>;
  updateFilecoinDealStatus(dealId: string, status: 'active' | 'expired' | 'terminated'): Promise<void>;
  getExpiringFilecoinDeals(daysUntilExpiry: number): Promise<FilecoinDeal[]>;

  // Storage Locations Methods
  createStorageLocation(location: InsertStorageLocation): Promise<StorageLocation>;
  getStorageLocationsByContentHash(contentHash: string): Promise<StorageLocation[]>;
  updateStorageLocationStatus(id: number, status: 'active' | 'archived' | 'failed'): Promise<void>;
  getStorageLocationsByType(storageType: 'ipfs' | 'filecoin' | 'local'): Promise<StorageLocation[]>;

  // Storage Costs Methods
  createStorageCost(cost: InsertStorageCost): Promise<StorageCost>;
  getStorageCostsByPatientDID(patientDID: string): Promise<StorageCost[]>;
  getTotalStorageCostsByPatientDID(patientDID: string): Promise<number>;
  getStorageCostsByPeriod(billingPeriod: 'monthly' | 'yearly' | 'one_time'): Promise<StorageCost[]>;

  // Storage Health Metrics Methods
  createStorageHealthMetric(metric: InsertStorageHealthMetric): Promise<StorageHealthMetric>;
  getLatestStorageHealthMetrics(): Promise<StorageHealthMetric[]>;
  getStorageHealthMetricByType(storageType: string): Promise<StorageHealthMetric | undefined>;
  updateStorageHealthMetric(id: number, updates: Partial<StorageHealthMetric>): Promise<void>;

  // Hospital Staff Methods
  getHospitalStaffByStaffId(staffId: string): Promise<HospitalStaff | undefined>;
  getActiveHospitalStaff(): Promise<HospitalStaff[]>;
  getOnDutyHospitalStaff(): Promise<HospitalStaff[]>;
  createHospitalStaff(staff: InsertHospitalStaff): Promise<HospitalStaff>;
  updateHospitalStaff(id: number, updates: Partial<InsertHospitalStaff>): Promise<HospitalStaff>;
  getHospitalStaffByHospitalId(hospitalId: string): Promise<HospitalStaff[]>;

  // Patient Emergency Contacts Methods
  getPatientEmergencyContacts(patientId: string): Promise<PatientEmergencyContact[]>;
  getVerifiedPatientEmergencyContacts(patientId: string): Promise<PatientEmergencyContact[]>;
  createPatientEmergencyContact(contact: InsertPatientEmergencyContact): Promise<PatientEmergencyContact>;

  // ZKP Methods
  createZKPProof(proof: InsertZKPProof): Promise<ZKPProof>;
  getZKPProof(id: number): Promise<ZKPProof | undefined>;
  getZKPProofsByPatientDID(patientDID: string): Promise<ZKPProof[]>;
  getPatientZKPProofs(patientDID: string): Promise<ZKPProof[]>;
  updateZKPProofVerificationCount(id: number, count: number): Promise<void>;
  revokeZKPProof(id: number, patientDID: string): Promise<boolean>;
  deactivateZKPProof(id: number): Promise<void>;
  createZKPVerification(verification: InsertZKPVerification): Promise<ZKPVerification>;
  getZKPVerificationsByProofId(proofId: number): Promise<ZKPVerification[]>;

  // Staff Invitation Methods
  createHospitalStaffInvitation(invitation: InsertHospitalStaffInvitation): Promise<HospitalStaffInvitation>;
  getInvitationByToken(token: string): Promise<HospitalStaffInvitation | undefined>;
  getPendingInvitationByEmail(email: string): Promise<HospitalStaffInvitation | undefined>;
  updateInvitation(id: number, updates: Partial<HospitalStaffInvitation>): Promise<void>;
  getInvitationsByHospitalId(hospitalId: number): Promise<HospitalStaffInvitation[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;

  // --- ADMIN DASHBOARD METHODS ---
  getAuditSummary(hospital_id?: number): Promise<any>;

  // New methods
  createProofCode(data: { codeHash: string, proofId: number, expiresAt: Date }): Promise<void>;
  getProofCodeByHash(codeHash: string): Promise<any>;
  markProofCodeUsed(id: number): Promise<void>;
  incrementProofCodeAttempts(id: number): Promise<void>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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

  async createPatientRecord(record: Omit<InsertPatientRecord, "hospital_id"> & { submittedBy: number, hospital_id: number }): Promise<PatientRecord> {
    const [patientRecord] = await db
      .insert(patientRecords)
      .values(record)
      .returning();
    return patientRecord;
  }

  async getPatientRecordsByNationalId(nationalId: string): Promise<PatientRecord[]> {
    const records = await db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.nationalId, nationalId))
      .orderBy(patientRecords.submittedAt);
    
    return records;
  }

  async getPatientRecordsByDID(patientDID: string): Promise<PatientRecord[]> {
    const records = await db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.patientDID, patientDID))
      .orderBy(patientRecords.submittedAt);
    
    return records;
  }

  async getWeb3PatientRecordsByDID(patientDID: string): Promise<PatientRecord[]> {
    const records = await db
      .select()
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.patientDID, patientDID),
          eq(patientRecords.recordType, "web3")
        )
      )
      .orderBy(patientRecords.submittedAt);
    
    return records;
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
    const records = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.patientId, patientId));
    // Map consent_type to consentType and remove consent_type from the returned object
    return records.map((record: any) => {
      const { consent_type, ...rest } = record;
      return { ...rest, consentType: consent_type || 'traditional' };
    });
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

  async updateRecordFilecoin(recordId: number, filecoinCid: string, storageCost: number, storageMetadata: any): Promise<void> {
    await db
      .update(patientRecords)
      .set({ 
        filecoinCid, 
        storageCost: storageCost.toString(), 
        storageMetadata 
      })
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

  async getCredentialById(id: number): Promise<VerifiableCredential | undefined> {
    const [credential] = await db
      .select()
      .from(verifiableCredentials)
      .where(eq(verifiableCredentials.id, id));
    return credential || undefined;
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

  async getConsentByPatientAndRequester(patientDID: string, requesterId: string): Promise<ConsentManagement[]> {
    return await db
      .select()
      .from(consentManagement)
      .where(
        and(
          eq(consentManagement.patientDID, patientDID),
          eq(consentManagement.requesterId, requesterId)
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
    // For now, just store in memory or log
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
    // Get the first record for this patient to use as a valid recordId
    const patientRecords = await this.getPatientRecordsByNationalId(request.patientId);
    if (patientRecords.length === 0) {
      throw new Error(`No records found for patient ${request.patientId}`);
    }
    // Use the first record's ID as the recordId
    const recordId = patientRecords[0].id;
    // Store consent request in the consentRecords table with a special status
    const consentRequest = await db
      .insert(consentRecords)
      .values({
        patientId: request.patientId,
        accessedBy: request.accessedBy,
        recordId: recordId,
        consentGrantedBy: "pending",
        consent_type: request.consentType || 'traditional',
        hospital_id: request.hospital_id,
        // Ensure pending requests do NOT get treated as recent access
        accessedAt: null as any,
      })
      .returning();
    // Consent request created successfully
    return consentRequest[0];
  }

  async getPendingConsentRequests(patientId: string): Promise<any[]> {
    // Get pending consent requests for a patient
    const pendingRequests = await db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.consentGrantedBy, "pending")
        )
      );
    // Get hospital information for each request
    const requestsWithHospitalInfo = await Promise.all(
      pendingRequests.map(async (request: any) => {
        const hospital = await this.getUser(request.accessedBy);
        return {
          ...request,
          consentType: request.consent_type || 'traditional',
          hospitalName: hospital?.hospitalName || "Unknown Hospital",
          hospitalType: hospital?.hospitalType || "Unknown",
        };
      })
    );
    return requestsWithHospitalInfo;
  }

  async getConsentRequestById(requestId: number): Promise<any> {
    // Get a specific consent request by ID
    const [request] = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.id, requestId));
    if (request) {
      const hospital = await this.getUser(request.accessedBy);
      return {
        ...request,
        consentType: (request as any).consent_type || 'traditional',
        hospitalName: hospital?.hospitalName || "Unknown Hospital",
        hospitalType: hospital?.hospitalType || "Unknown",
      };
    }
    return null;
  }

  async updateConsentRequestStatus(patientId: string, hospitalId: number, status: string): Promise<void> {
    // Update consent request status
    await db
      .update(consentRecords)
      .set({ 
        consentGrantedBy: status === "granted" ? hospitalId.toString() : status,
        accessedAt: new Date()
      })
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.accessedBy, hospitalId),
          eq(consentRecords.consentGrantedBy, "pending")
        )
      );
    
    // Consent request status updated successfully
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
  async countAuditEvents(filters?: { eventType?: string | string[]; outcome?: string; hospital_id?: number }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(auditEvents);
    if (filters && filters.hospital_id !== undefined) {
      query = (query as any).where(eq(auditEvents.hospital_id, filters.hospital_id));
    }

    if (filters && Object.keys(filters).length > 0) {
      if (filters.eventType && filters.outcome) {
        if (Array.isArray(filters.eventType)) {
          const result = await query.where(and(inArray(auditEvents.eventType, filters.eventType), eq(auditEvents.outcome, filters.outcome)));
          return Number(result[0].count);
        } else {
          const result = await query.where(and(eq(auditEvents.eventType, filters.eventType), eq(auditEvents.outcome, filters.outcome)));
          return Number(result[0].count);
        }
      } else if (filters.eventType) {
        if (Array.isArray(filters.eventType)) {
          const result = await query.where(inArray(auditEvents.eventType, filters.eventType));
          return Number(result[0].count);
        } else {
          const result = await query.where(eq(auditEvents.eventType, filters.eventType));
          return Number(result[0].count);
        }
      } else if (filters.outcome) {
        const result = await query.where(eq(auditEvents.outcome, filters.outcome));
        return Number(result[0].count);
      }
    }

    const result = await query;
    return Number(result[0].count);
  }

  async countSecurityViolations(filters?: { violationType?: string; resolved?: boolean; hospital_id?: number }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(securityViolations);
    if (filters && filters.hospital_id !== undefined) {
      query = (query as any).where(eq(securityViolations.hospital_id, filters.hospital_id));
    }
    
    if (filters?.violationType && filters?.resolved !== undefined) {
      const result = await query.where(and(eq(securityViolations.violationType, filters.violationType), eq(securityViolations.resolved, filters.resolved)));
      return Number(result[0].count);
    } else if (filters?.violationType) {
      const result = await query.where(eq(securityViolations.violationType, filters.violationType));
      return Number(result[0].count);
    } else if (filters?.resolved !== undefined) {
      const result = await query.where(eq(securityViolations.resolved, filters.resolved));
      return Number(result[0].count);
    }

    const result = await query;
    return Number(result[0].count);
  }

  async countConsentAuditRecords(filters?: { consentAction?: string; }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(consentAuditTrail);
    
    if (filters?.consentAction) {
      const result = await query.where(eq(consentAuditTrail.consentAction, filters.consentAction));
      return Number(result[0].count);
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

  async getEmergencyConsentRecord(id: string): Promise<EmergencyConsentRecordSchema | undefined> {
    const [record] = await db
      .select()
      .from(emergencyConsentRecords)
      .where(eq(emergencyConsentRecords.id, id));
    return record || undefined;
  }

  async getSecurityViolations(options?: { limit?: number; offset?: number; resolved?: boolean; hospital_id?: number }): Promise<SecurityViolation[]> {
    const { limit = 10, offset = 0, resolved, hospital_id } = options || {};
    let query = db.select().from(securityViolations);
    if (typeof resolved === "boolean") {
      query = (query as any).where(eq(securityViolations.resolved, resolved));
    }
    if (hospital_id !== undefined) {
      query = (query as any).where(eq(securityViolations.hospital_id, hospital_id));
    }
    return await query.orderBy(desc(securityViolations.createdAt)).limit(limit).offset(offset);
  }

  async resolveSecurityViolation(violationId: number, hospital_id: number): Promise<void> {
    await db
      .update(securityViolations)
      .set({ 
        resolved: true, 
        resolvedAt: new Date() 
      })
      .where(and(
        eq(securityViolations.id, violationId),
        eq(securityViolations.hospital_id, hospital_id)
      ));
  }

  async unresolveSecurityViolation(violationId: number, hospital_id: number): Promise<void> {
    await db
      .update(securityViolations)
      .set({ 
        resolved: false, 
        resolvedAt: null 
      })
      .where(and(
        eq(securityViolations.id, violationId),
        eq(securityViolations.hospital_id, hospital_id)
      ));
  }

  // Utility: Find patient profile by email or phone
  async findPatientProfileByEmailOrPhone(email?: string, phone?: string): Promise<any> {
    if (!email && !phone) return undefined;
    let profile: any = undefined;
    if (email) {
      [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.email, email));
      if (profile) return profile;
    }
    if (phone) {
      [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.phoneNumber, phone));
      if (profile) return profile;
    }
    return undefined;
  }

  // Utility: Update patient profile to add missing email or phone
  async updatePatientProfileIdentifiers(patientDID: string, identifiers: { email?: string, phoneNumber?: string }): Promise<any> {
    const updates: any = {};
    if (identifiers.email) updates.email = identifiers.email;
    if (identifiers.phoneNumber) updates.phoneNumber = identifiers.phoneNumber;
    if (Object.keys(updates).length === 0) return undefined;
    const [updatedProfile]: any = await db
      .update(patientProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(patientProfiles.patientDID, patientDID))
      .returning();
    return updatedProfile;
  }

  // Additional method
  async updatePatientIdentityPhoneNumber(patientDID: string, phoneNumber: string): Promise<void> {
    await db.update(patientIdentities)
      .set({ phoneNumber, updatedAt: new Date() })
      .where(eq(patientIdentities.did, patientDID));
  }

  // New method
  async getAllActiveWeb3Consents(patientDID: string): Promise<ConsentManagement[]> {
    return await db
      .select()
      .from(consentManagement)
      .where(
        and(
          eq(consentManagement.patientDID, patientDID),
          eq(consentManagement.consentGiven, true),
          isNull(consentManagement.revokedAt),
          or(isNull(consentManagement.expiresAt), gt(consentManagement.expiresAt, new Date()))
        )
      );
  }

  // New method
  async createWeb3Consent(consent: {
    patientDID: string;
    requesterId: string;
    consentType?: string;
    consentGiven: boolean;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
  }): Promise<ConsentManagement> {
    const [created] = await db
      .insert(consentManagement)
      .values({
        patientDID: consent.patientDID,
        requesterId: consent.requesterId,
        consentType: consent.consentType || 'read',
        consentGiven: consent.consentGiven,
        expiresAt: consent.expiresAt ?? null,
        revokedAt: consent.revokedAt ?? null,
      })
      .returning();
    return created;
  }

  // New method
  async updateWeb3Consent(id: number, updates: Partial<ConsentManagement>): Promise<void> {
    await db
      .update(consentManagement)
      .set(updates)
      .where(eq(consentManagement.id, id));
  }

  // Store a consent audit event in the consent_audit_trail table
  async createConsentAudit(audit: any): Promise<void> {
    await db.insert(consentAuditTrail).values(audit);
  }

  // Store an audit event in the audit_events table
  async createAuditEvent(audit: any, hospital_id?: number): Promise<void> {
    await db.insert(auditEvents).values({ ...audit, hospital_id }).returning();
  }

  // Store a security violation in the security_violations table
  async createSecurityViolation(violation: any, hospital_id?: number): Promise<void> {
    // Use hospital_id from violation object if provided, otherwise use parameter
    const finalHospitalId = violation.hospital_id ?? hospital_id;
    await db.insert(securityViolations).values({ 
      ...violation, 
      hospital_id: finalHospitalId 
    }).returning();
  }

  // Fetch the N most recent audit events
  async getRecentAuditEvents(limit?: number): Promise<any[]> {
    const query = db.select().from(auditEvents).orderBy(sql`${auditEvents.createdAt} DESC`);
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  // Filecoin Deals Methods
  async createFilecoinDeal(deal: InsertFilecoinDeal): Promise<FilecoinDeal> {
    const [filecoinDeal] = await db
      .insert(filecoinDeals)
      .values(deal)
      .returning();
    return filecoinDeal;
  }

  async getFilecoinDealById(id: number): Promise<FilecoinDeal | undefined> {
    const [deal] = await db.select().from(filecoinDeals).where(eq(filecoinDeals.id, id));
    return deal || undefined;
  }

  async getFilecoinDealByDealId(dealId: string): Promise<FilecoinDeal | undefined> {
    const [deal] = await db.select().from(filecoinDeals).where(eq(filecoinDeals.dealId, dealId));
    return deal || undefined;
  }

  async getFilecoinDealsByPatientDID(patientDID: string): Promise<FilecoinDeal[]> {
    return await db
      .select()
      .from(filecoinDeals)
      .where(eq(filecoinDeals.patientDID, patientDID))
      .orderBy(desc(filecoinDeals.createdAt));
  }

  async updateFilecoinDealStatus(dealId: string, status: 'active' | 'expired' | 'terminated'): Promise<void> {
    await db
      .update(filecoinDeals)
      .set({ dealStatus: status })
      .where(eq(filecoinDeals.dealId, dealId));
  }

  async getExpiringFilecoinDeals(daysUntilExpiry: number): Promise<FilecoinDeal[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
    
    return await db
      .select()
      .from(filecoinDeals)
      .where(and(
        eq(filecoinDeals.dealStatus, 'active'),
        gt(filecoinDeals.expiresAt, new Date()),
        sql`${filecoinDeals.expiresAt} <= ${expiryDate}`
      ));
  }

  // Storage Locations Methods
  async createStorageLocation(location: InsertStorageLocation): Promise<StorageLocation> {
    const [storageLocation] = await db
      .insert(storageLocations)
      .values(location)
      .returning();
    return storageLocation;
  }

  async getStorageLocationsByContentHash(contentHash: string): Promise<StorageLocation[]> {
    return await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.contentHash, contentHash));
  }

  async updateStorageLocationStatus(id: number, status: 'active' | 'archived' | 'failed'): Promise<void> {
    await db
      .update(storageLocations)
      .set({ status, lastVerified: new Date() })
      .where(eq(storageLocations.id, id));
  }

  async getStorageLocationsByType(storageType: 'ipfs' | 'filecoin' | 'local'): Promise<StorageLocation[]> {
    return await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.storageType, storageType));
  }

  // Storage Costs Methods
  async createStorageCost(cost: InsertStorageCost): Promise<StorageCost> {
    const [storageCost] = await db
      .insert(storageCosts)
      .values(cost)
      .returning();
    return storageCost;
  }

  async getStorageCostsByPatientDID(patientDID: string): Promise<StorageCost[]> {
    return await db
      .select()
      .from(storageCosts)
      .where(eq(storageCosts.patientDID, patientDID))
      .orderBy(desc(storageCosts.createdAt));
  }

  async getTotalStorageCostsByPatientDID(patientDID: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`SUM(${storageCosts.costAmount})` })
      .from(storageCosts)
      .where(eq(storageCosts.patientDID, patientDID));
    
    return result[0]?.total || 0;
  }

  async getStorageCostsByPeriod(billingPeriod: 'monthly' | 'yearly' | 'one_time'): Promise<StorageCost[]> {
    return await db
      .select()
      .from(storageCosts)
      .where(eq(storageCosts.billingPeriod, billingPeriod))
      .orderBy(desc(storageCosts.createdAt));
  }

  // Storage Health Metrics Methods
  async createStorageHealthMetric(metric: InsertStorageHealthMetric): Promise<StorageHealthMetric> {
    const [healthMetric] = await db
      .insert(storageHealthMetrics)
      .values(metric)
      .returning();
    return healthMetric;
  }

  async getLatestStorageHealthMetrics(): Promise<StorageHealthMetric[]> {
    return await db
      .select()
      .from(storageHealthMetrics)
      .orderBy(desc(storageHealthMetrics.lastCheckAt));
  }

  async getStorageHealthMetricByType(storageType: string): Promise<StorageHealthMetric | undefined> {
    const [metric] = await db
      .select()
      .from(storageHealthMetrics)
      .where(eq(storageHealthMetrics.storageType, storageType))
      .orderBy(desc(storageHealthMetrics.lastCheckAt))
      .limit(1);
    return metric || undefined;
  }

  async updateStorageHealthMetric(id: number, updates: Partial<StorageHealthMetric>): Promise<void> {
    await db
      .update(storageHealthMetrics)
      .set({ ...updates, lastCheckAt: new Date() })
      .where(eq(storageHealthMetrics.id, id));
  }

  // Hospital Staff Methods
  async getHospitalStaffByStaffId(staffId: string): Promise<HospitalStaff | undefined> {
    const [staff] = await db.select().from(hospitalStaff).where(eq(hospitalStaff.staffId, staffId));
    return staff || undefined;
  }

  async getActiveHospitalStaff(): Promise<HospitalStaff[]> {
    const staff = await db.select().from(hospitalStaff).where(eq(hospitalStaff.isActive, true));
    return staff;
  }

  async getOnDutyHospitalStaff(): Promise<HospitalStaff[]> {
    const staff = await db.select().from(hospitalStaff).where(eq(hospitalStaff.isOnDuty, true));
    return staff;
  }

  async createHospitalStaff(staff: InsertHospitalStaff): Promise<HospitalStaff> {
    const [newStaff] = await db.insert(hospitalStaff).values(staff).returning();
    return newStaff;
  }

  async updateHospitalStaff(id: number, updates: Partial<InsertHospitalStaff>): Promise<HospitalStaff> {
    const [updatedStaff] = await db
      .update(hospitalStaff)
      .set(updates)
      .where(eq(hospitalStaff.id, id))
      .returning();
    return updatedStaff;
  }

  async getHospitalStaffByHospitalId(hospitalId: string): Promise<HospitalStaff[]> {
    // Filter staff by hospitalId for proper multi-tenancy
    const staff = await db.select().from(hospitalStaff).where(
      and(
        eq(hospitalStaff.hospitalId, hospitalId),
        eq(hospitalStaff.isActive, true)
      )
    );
    return staff;
  }

  // Patient Emergency Contacts Methods
  async getPatientEmergencyContacts(patientId: string): Promise<PatientEmergencyContact[]> {
    const contacts = await db.select().from(patientEmergencyContacts).where(eq(patientEmergencyContacts.patientId, patientId));
    return contacts;
  }

  async getVerifiedPatientEmergencyContacts(patientId: string): Promise<PatientEmergencyContact[]> {
    const contacts = await db.select().from(patientEmergencyContacts).where(and(eq(patientEmergencyContacts.patientId, patientId), eq(patientEmergencyContacts.isVerified, true)));
    return contacts;
  }

  async createPatientEmergencyContact(contact: InsertPatientEmergencyContact): Promise<PatientEmergencyContact> {
    const [newContact] = await db.insert(patientEmergencyContacts).values(contact).returning();
    return newContact;
  }

  // ZKP Methods Implementation
  async createZKPProof(proof: InsertZKPProof): Promise<ZKPProof> {
    const [result] = await db.insert(zkpProofs).values(proof).returning();
    return result;
  }

  // ZKP Analytics Methods
  async getTotalZKPProofs(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(zkpProofs);
    return result[0]?.count || 0;
  }

  async getActiveZKPProofs(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(zkpProofs)
      .where(and(eq(zkpProofs.isActive, true), gt(zkpProofs.expiresAt, new Date())));
    return result[0]?.count || 0;
  }

  async getExpiringZKPProofs(days: number): Promise<number> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(zkpProofs)
      .where(and(
        eq(zkpProofs.isActive, true),
        lt(zkpProofs.expiresAt, expiryDate),
        gt(zkpProofs.expiresAt, new Date())
      ));
    return result[0]?.count || 0;
  }

  async getProofCountByType(proofType: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(zkpProofs)
      .where(and(eq(zkpProofs.proofType, proofType), eq(zkpProofs.isActive, true)));
    return result[0]?.count || 0;
  }

  // Feedback Methods
  async createFeedback(feedbackData: {
    phoneNumber: string;
    rating: number;
    feedback: string;
    submittedAt: Date;
  }): Promise<void> {
    await db.insert(feedback).values({
      phoneNumber: feedbackData.phoneNumber,
      rating: feedbackData.rating,
      feedback: feedbackData.feedback,
      submittedAt: feedbackData.submittedAt,
    });
  }

  async getZKPProof(id: number): Promise<ZKPProof | undefined> {
    const [result] = await db.select().from(zkpProofs).where(eq(zkpProofs.id, id));
    return result;
  }

  async getZKPProofsByPatientDID(patientDID: string): Promise<ZKPProof[]> {
    return await db.select().from(zkpProofs).where(eq(zkpProofs.patientDID, patientDID));
  }

  async getPatientZKPProofs(patientDID: string): Promise<ZKPProof[]> {
    return await db.select().from(zkpProofs).where(eq(zkpProofs.patientDID, patientDID));
  }

  async updateZKPProofVerificationCount(id: number, count: number): Promise<void> {
    await db.update(zkpProofs)
      .set({ 
        verificationCount: count,
        updatedAt: new Date()
      })
      .where(eq(zkpProofs.id, id));
  }

  async revokeZKPProof(id: number, patientDID: string): Promise<boolean> {
    const result = await db.update(zkpProofs)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(and(eq(zkpProofs.id, id), eq(zkpProofs.patientDID, patientDID)))
      .returning();
    
    return result.length > 0;
  }

  async deactivateZKPProof(id: number): Promise<void> {
    await db.update(zkpProofs)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(zkpProofs.id, id));
  }

  async createZKPVerification(verification: InsertZKPVerification): Promise<ZKPVerification> {
    const [result] = await db.insert(zkpVerifications).values(verification).returning();
    return result;
  }

  async getZKPVerificationsByProofId(proofId: number): Promise<ZKPVerification[]> {
    return await db.select().from(zkpVerifications).where(eq(zkpVerifications.proofId, proofId));
  }

  // --- ADMIN DASHBOARD METHODS ---
  async getAuditSummary(hospital_id?: number): Promise<any> {
    // Aggregate metrics for the admin dashboard, filtered by hospital_id
    const [
      totalEvents,
      unresolvedViolations,
      consentEvents,
      recordAccesses,
      successfulLogins,
      failedLogins,
      unauthorizedAttempts,
      recentActivity,
      vcStats,
      consentStats
    ] = await Promise.all([
      this.countAuditEvents({ hospital_id }),
      this.countSecurityViolations({ resolved: false, hospital_id }),
      this.countConsentAuditRecords({ consentAction: "GRANTED" }),
      this.countAuditEvents({ eventType: ["RECORD_ACCESSED", "RECORD_ACCESS", "RECORD_ACCESSED_VIA_VC", "FILECOIN_RECORD_ACCESS"], outcome: "SUCCESS", hospital_id }),
      this.countAuditEvents({ eventType: "LOGIN_SUCCESS", outcome: "SUCCESS", hospital_id }),
      this.countAuditEvents({ eventType: "LOGIN_FAILURE", outcome: "FAILURE", hospital_id }),
      this.countAuditEvents({ eventType: "UNAUTHORIZED_ACCESS", outcome: "FAILURE", hospital_id }),
      this.getRecentAuditEvents(10), // Optionally filter by hospital_id if needed
      this.getVCIssuanceStats(),
      this.getConsentTrends()
    ]);
    return {
      totalEvents,
      securityViolations: unresolvedViolations,
      consentEvents,
      securityMetrics: {
        recordAccesses,
        successfulLogins,
        failedLogins,
        unauthorizedAttempts
      },
      recentActivity,
      vcIssuanceStats: vcStats,
      consentTrends: consentStats
    };
  }

  // Helper: VC Issuance Stats
  async getVCIssuanceStats(): Promise<any> {
    // Counts for today, this week, this month, and avg response time (if possible)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisWeek, thisMonth, allVCs] = await Promise.all([
      db.select().from(verifiableCredentials).where(sql`issuance_date >= ${startOfToday}`),
      db.select().from(verifiableCredentials).where(sql`issuance_date >= ${startOfWeek}`),
      db.select().from(verifiableCredentials).where(sql`issuance_date >= ${startOfMonth}`),
      db.select().from(verifiableCredentials)
    ]);

    // Calculate average issuance time if possible (difference between issuanceDate and the earliest issuanceDate)
    let avgResponseTime = null;
    if (allVCs.length > 1) {
      const times = allVCs
        .map(vc => vc.issuanceDate ? new Date(vc.issuanceDate).getTime() : null)
        .filter(t => t !== null)
        .sort((a, b) => a! - b!);
      if (times.length > 1) {
        const diffs = times.slice(1).map((t, i) => t! - times[i]!);
        avgResponseTime = (diffs.reduce((a, b) => a + b, 0) / diffs.length) / 1000; // in seconds
      }
    }

    return {
      today: today.length,
      thisWeek: thisWeek.length,
      thisMonth: thisMonth.length,
      avgResponseTime: avgResponseTime ? `${avgResponseTime.toFixed(1)}s` : null
    };
  }

  // Helper: Consent Trends
  async getConsentTrends(): Promise<any> {
    // Grant rate, avg processing time, revocation rate from consentAuditTrail
    const all = await db.select().from(consentAuditTrail);
    const granted = all.filter(e => e.consentAction === "GRANTED");
    const revoked = all.filter(e => e.consentAction === "REVOKED");
    const expired = all.filter(e => e.consentAction === "EXPIRED");
    const total = all.length;
    const grantRate = total > 0 ? (granted.length / total) * 100 : 0;
    const revocationRate = total > 0 ? (revoked.length / total) * 100 : 0;
    // Avg processing time: difference between createdAt and expiresAt for granted consents
    let avgProcessingTime = null;
    if (granted.length > 0) {
      const times = granted
        .map(e => e.expiresAt && e.createdAt ? (new Date(e.expiresAt).getTime() - new Date(e.createdAt).getTime()) : null)
        .filter(t => t !== null);
      if (times.length > 0) {
        avgProcessingTime = (times.reduce((a, b) => a + b, 0) / times.length) / 60000; // in minutes
      }
    }
    return {
      grantRate: grantRate ? `${grantRate.toFixed(1)}%` : null,
      avgProcessingTime: avgProcessingTime ? `${avgProcessingTime.toFixed(1)} min` : null,
      revocationRate: revocationRate ? `${revocationRate.toFixed(1)}%` : null
    };
  }

  // Staff Invitation Methods Implementation
  async createHospitalStaffInvitation(invitation: InsertHospitalStaffInvitation): Promise<HospitalStaffInvitation> {
    const [result] = await db.insert(hospitalStaffInvitations).values(invitation).returning();
    return result;
  }

  async getInvitationByToken(token: string): Promise<HospitalStaffInvitation | undefined> {
    const [result] = await db.select().from(hospitalStaffInvitations).where(eq(hospitalStaffInvitations.invitationToken, token));
    return result;
  }

  async getPendingInvitationByEmail(email: string): Promise<HospitalStaffInvitation | undefined> {
    const [result] = await db.select().from(hospitalStaffInvitations).where(
      and(
        eq(hospitalStaffInvitations.email, email),
        eq(hospitalStaffInvitations.status, 'pending'),
        gt(hospitalStaffInvitations.expiresAt, new Date())
      )
    );
    return result;
  }

  async updateInvitation(id: number, updates: Partial<HospitalStaffInvitation>): Promise<void> {
    await db.update(hospitalStaffInvitations)
      .set(updates)
      .where(eq(hospitalStaffInvitations.id, id));
  }

  async getInvitationsByHospitalId(hospitalId: number): Promise<HospitalStaffInvitation[]> {
    return await db.select().from(hospitalStaffInvitations).where(eq(hospitalStaffInvitations.hospitalId, hospitalId));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email));
    return result;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db.update(users)
      .set(updates)
      .where(eq(users.id, id));
  }

  // New methods
  async createProofCode(data: { codeHash: string, proofId: number, expiresAt: Date }): Promise<void> {
    await db.insert(proofCodes).values({
      codeHash: data.codeHash,
      proofId: data.proofId,
      expiresAt: data.expiresAt,
    });
  }

  async getProofCodeByHash(codeHash: string): Promise<any> {
    return db.query.proofCodes.findFirst({ where: eq(proofCodes.codeHash, codeHash) });
  }

  // Fetch all proof-code rows for a given code (one code can map to multiple proofs in a visit)
  async getProofCodesByHash(codeHash: string): Promise<any[]> {
    return db.select().from(proofCodes).where(eq(proofCodes.codeHash, codeHash));
  }

  async markProofCodeUsed(id: number): Promise<void> {
    await db.update(proofCodes).set({ used: true }).where(eq(proofCodes.id, id));
  }

  async incrementProofCodeAttempts(id: number): Promise<void> {
    await db.update(proofCodes).set({ attempts: sql`${proofCodes.attempts} + 1` }).where(eq(proofCodes.id, id));
  }

  // Analytics helper: fetch ZKP proofs by date range (active only)
  async getZKPProofsByDateRange(from: Date, to: Date): Promise<ZKPProof[]> {
    return await db
      .select()
      .from(zkpProofs)
      .where(and(
        gte(zkpProofs.createdAt, from),
        lte(zkpProofs.createdAt, to),
        eq(zkpProofs.isActive, true)
      ));
  }
}

export const storage = new DatabaseStorage();
