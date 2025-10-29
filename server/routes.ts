import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPatientRecordSchema, insertConsentRecordSchema } from "@shared/schema";
import { registerWeb3Routes } from "./web3-routes";
import { registerSimplifiedPatientRoutes } from "./simplified-patient-routes";
import { registerSecurityTestingRoutes } from "./security-testing-routes";
import { registerFilecoinRoutes } from "./filecoin-routes";

import staffManagementRoutes from "./staff-management-routes";
import { patientLookupService } from "./patient-lookup-service";
import { emergencyConsentService } from "./emergency-consent-service"; // Import EmergencyConsentService
import { emergencyCredentialService } from "./emergency-credential-service"; // Import EmergencyCredentialService
import { z } from "zod";
import { auditService } from "./audit-service";
import { consentService, ipfsService } from "./web3-services";
import { secureKeyVault } from "./secure-key-vault";
import { ipfsRedundancyService } from "./ipfs-redundancy-service";
import { smsService } from "./sms-service";
import { redisService } from "./redis-service";
import { requireAdminAuth } from "./admin-auth-middleware";
import zkpRoutes from "./zkp-routes";
import { StaffInvitationService } from "./staff-invitation-service";
import { zkpService } from "./zkp-service";

// Zod schema for AuthorizedPersonnel
const authorizedPersonnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['PHYSICIAN', 'SURGEON', 'EMERGENCY_DOCTOR', 'CHIEF_RESIDENT']),
  licenseNumber: z.string(),
  department: z.string(),
});

// Zod schema for NextOfKinInfo
const nextOfKinInfoSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phoneNumber: z.string(),
  email: z.string().email().optional(),
});

// Zod schema for EmergencyConsentRequest
const emergencyConsentRequestSchema = z.object({
  patientId: z.string(),
  hospitalId: z.string(),
  emergencyType: z.enum(['LIFE_THREATENING', 'UNCONSCIOUS_PATIENT', 'CRITICAL_CARE', 'SURGERY_REQUIRED', 'MENTAL_HEALTH_CRISIS']),
  medicalJustification: z.string().min(50, { message: "Medical justification must be at least 50 characters long" }),
  primaryPhysician: authorizedPersonnelSchema,
  secondaryAuthorizer: authorizedPersonnelSchema,
  nextOfKin: nextOfKinInfoSchema.optional(),
  patientContactAttempted: z.boolean(),
  requestedDurationMs: z.number().positive(),
});


export async function registerRoutes(app: Express): Promise<Server> {
  // Auth is initialized in server/index.ts

  // Simplified patient routes with Web3 backend, Web2 UX
  registerSimplifiedPatientRoutes(app);

  // Setup Web3 routes
  registerWeb3Routes(app);

  // Setup Filecoin routes
  registerFilecoinRoutes(app);

  // Setup ZKP routes
  app.use('/api/zkp', zkpRoutes);

  // Analytics: Disease summary from verified ZK proofs (aggregated, privacy-preserving)
  app.get('/api/analytics/disease-summary', async (req, res, next) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Minimal aggregation using stored zkpProofs publicStatement
      // In a fuller implementation, we’d join with icd_codes or a mapping table
      const proofs = await storage.getZKPProofsByDateRange(fromDate, toDate);
      const summary: Record<string, number> = {};
      for (const p of proofs) {
        // Count by publicStatement bucket (e.g., category or contagious flag)
        const key = p.publicStatement || 'Unknown';
        summary[key] = (summary[key] || 0) + 1;
      }

      res.json({ success: true, from: fromDate.toISOString(), to: toDate.toISOString(), summary });
    } catch (error) {
      next(error);
    }
  });

  // Setup Staff Management routes
  app.use('/api/staff', staffManagementRoutes);

  // Submit patient record (Hospital A)
  app.post("/api/submit_record", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "A") {
        return res.status(403).json({ message: "Only Hospital A can submit records" });
      }

      const validatedData = insertPatientRecordSchema.parse(req.body);
      
      // Check if a patient profile exists for this National ID
      const patientProfile = await storage.getPatientProfileByNationalId(validatedData.nationalId);
      
      // If patient profile exists, use their DID; otherwise, leave patientDID as null for traditional records
      const recordData = {
        ...validatedData,
        patientDID: patientProfile?.patientDID || null,
        recordType: patientProfile ? "web3" : "traditional",
        submittedBy: user.id,
        hospital_id: user.hospital_id, // Ensure hospital_id is always set
      };

      // --- Enhancement: Analyze medical data and add NLP results ---
      try {
        const zkp = await zkpService;
        const analysis = await zkp.analyzeMedicalData(validatedData);
        recordData.entities = analysis.entities || [];
        recordData.icd_codes = analysis.icd_codes || [];
      } catch (err) {
        console.error("[NLP/ICD] Failed to analyze medical data:", err);
        // Proceed without entities/icd_codes if analysis fails
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("User in /api/submit_record");
        console.log("Record data prepared for insert");
      }
      const record = await storage.createPatientRecord(recordData);

      // Fire-and-forget: generate dynamic ZK proofs from NLP/ICD analysis (non-blocking)
      try {
        const zkp = await zkpService;
        if (recordData.patientDID) {
          zkp.generateProofsFromMedicalData(recordData.patientDID, validatedData, {
            entities: recordData.entities || [],
            icd_codes: recordData.icd_codes || [],
          }).catch(err => console.error('[ZKP] Proof generation failed:', err));
        }
      } catch (e) {
        console.error('[ZKP] Skipping auto-proof generation:', e);
      }

      res.status(201).json({ 
        message: "Record submitted successfully", 
        recordId: record.id,
        recordType: recordData.recordType,
        patientDID: recordData.patientDID,
      });
    } catch (error) {
      next(error);
    }
  });

  // Phone-based patient lookup for Web3 (Hospital B)
  app.post("/api/patient-lookup/phone", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can access patient lookup" });
      }

      const { phoneNumber } = z.object({ phoneNumber: z.string() }).parse(req.body);
      
      const result = await patientLookupService.searchByPhoneNumber(
        phoneNumber,
        user.hospital_id.toString(),
        user.id.toString()
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Get patient records (Hospital B)
  app.post("/api/get_records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can retrieve records" });
      }

      const { nationalId } = z.object({ nationalId: z.string() }).parse(req.body);
      
      const records = await storage.getPatientRecordsByNationalId(nationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Check if patient has a Web3 profile
      const patientProfile = await storage.getPatientProfileByNationalId(nationalId);

      // Check if consent has been granted for this hospital
      const consentRecords = await storage.getConsentRecordsByPatientId(nationalId, user.id);
      // Compute traditional consent validity as last GRANTED access within 12 hours
      // Only consider consent records where consentGrantedBy is a numeric hospital id (not "pending")
      const grantedRecords = consentRecords.filter((r: any) => typeof r.consentGrantedBy === 'string' && /^\d+$/.test(r.consentGrantedBy));
      let hasConsent = false;
      let traditionalConsentExpiresAt: Date | undefined = undefined;
      if (grantedRecords.length > 0) {
        const lastAccessed = grantedRecords
          .map(r => r.accessedAt)
          .filter((d: any) => !!d)
          .sort((a: any, b: any) => new Date(b as any).getTime() - new Date(a as any).getTime())[0] as Date | undefined;
        if (lastAccessed) {
          const expires = new Date(new Date(lastAccessed).getTime() + 12 * 60 * 60 * 1000);
          traditionalConsentExpiresAt = expires;
          hasConsent = new Date() < expires;
        }
      }

      // If patient has DID, also consider Web3 consent (stricter, stored with explicit expiresAt)
      let web3ConsentExpiresAt: Date | undefined = undefined;
      if (patientProfile?.patientDID) {
        const web3Consents = await storage.getConsentByPatientAndRequester(
          patientProfile.patientDID,
          `did:medbridge:hospital:${user.id}`
        );
        const active = web3Consents.filter(c => c.consentGiven && !c.revokedAt && (!c.expiresAt || new Date() < c.expiresAt));
        if (active.length > 0) {
          // Take the soonest expiry among active consents
          const expList = active.map(c => c.expiresAt).filter(Boolean) as Date[];
          if (expList.length > 0) {
            web3ConsentExpiresAt = new Date(Math.min(...expList.map(d => new Date(d).getTime())));
          }
          hasConsent = true;
        }
      }

      // If consent is NOT valid, avoid returning PII or medical details
      if (!hasConsent) {
        return res.json({
          hasConsent: false,
          requiresConsent: true,
          recordCount: records.length,
        });
      }

      // Return patient info and records when consent is valid
      res.json({
        patientName: records[0].patientName,
        nationalId: records[0].nationalId,
        recordCount: records.length,
        patientDID: patientProfile?.patientDID,
        hasWeb3Profile: !!patientProfile,
        hasConsent: true,
        consentExpiresAt: web3ConsentExpiresAt || traditionalConsentExpiresAt || null,
        consentType: web3ConsentExpiresAt ? 'web3' : 'traditional',
        totalRecords: records.length,
        records: records.map(record => ({
          id: record.id,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
          submittedAt: record.submittedAt,
          recordType: record.recordType,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // Request consent for patient records
  app.post("/api/request-consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can request consent" });
      }

      console.log("Consent request user object:", user);
      console.log("Consent request hospital_id value:", user.hospital_id);
      if (!user.hospital_id) {
        return res.status(400).json({ error: "User is missing hospital_id. Cannot create consent request." });
      }

      const { nationalId, reason } = z.object({ 
        nationalId: z.string(),
        reason: z.string().optional(),
      }).parse(req.body);

      const records = await storage.getPatientRecordsByNationalId(nationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Check if consent already exists - but don't block, just inform
      const existingConsents = await storage.getConsentRecordsByPatientId(nationalId, user.id);
      const hasExistingConsent = existingConsents.length > 0;

      // Check if patient has a Web3 profile
      const patientProfile = await storage.getPatientProfileByNationalId(nationalId);
      const consentType = patientProfile?.patientDID ? 'web3' : 'traditional';

      // Create a consent request record (pending approval)
      await storage.createConsentRequest({
        patientId: nationalId,
        accessedBy: user.id,
        reason: reason || "Medical care coordination",
        status: hasExistingConsent ? "renewal" : "new",
        requestedAt: new Date(),
        consentType: consentType,
        hospital_id: user.hospital_id, // Ensure hospital_id is included
      });

      await auditService.logEvent({
        eventType: "CONSENT_REQUESTED",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: nationalId,
        action: "REQUEST_CONSENT",
        outcome: "SUCCESS",
        metadata: { 
          recordCount: records.length,
          reason: reason || "Medical care coordination",
          hospitalName: user.hospitalName,
          hasExistingConsent,
        },
        severity: "info",
      });

      res.json({ 
        message: hasExistingConsent ? 
          "Consent renewal request submitted successfully" : 
          "Consent request submitted successfully",
        patientName: records[0].patientName,
        recordCount: records.length,
        status: hasExistingConsent ? "renewal" : "new",
        hasExistingConsent,
      });
    } catch (error) {
      next(error);
    }
  });

  // Grant consent and access records
  app.post("/api/consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { nationalId, consentType } = z.object({
        nationalId: z.string(),
        consentType: z.enum(['web3', 'traditional']),
      }).parse(req.body);

      // Normalize the nationalId to handle potential whitespace and type issues
      const normalizedNationalId = nationalId.trim();

      // Processing consent request

      if (consentType === "web3") {
        // Web3 consent logic
        // Processing Web3 consent
        
        // Check if the input is a DID or National ID
        const isDID = normalizedNationalId.startsWith('did:');
        // Input validation completed
        
        let patientProfile;
        if (isDID) {
          // If it's a DID, look up by DID directly
          patientProfile = await storage.getPatientProfileByDID(normalizedNationalId);
        } else {
          // If it's a National ID, look up by National ID
          patientProfile = await storage.getPatientProfileByNationalId(normalizedNationalId);
        }
        
        if (!patientProfile || !patientProfile.patientDID) {
          // Try fallback: search for patient records and get DID from there
          const patientRecords = await storage.getPatientRecordsByNationalId(normalizedNationalId);
          if (patientRecords.length > 0 && patientRecords[0].patientDID) {
            const fallbackProfile = await storage.getPatientProfileByDID(patientRecords[0].patientDID);
            if (fallbackProfile) {
              patientProfile = fallbackProfile;
            }
          }
          
          if (!patientProfile || !patientProfile.patientDID) {
            return res.status(404).json({ message: "No Web3 identity found for this patient" });
          }
        }
        
        const patientDID = patientProfile.patientDID;
        const requesterId = `did:medbridge:hospital:${user.id.toString()}`;
        
        const existingWeb3Consents = await storage.getConsentByPatientAndRequester(patientDID, requesterId);
        
        const hasConsent = existingWeb3Consents.some(c => c.consentGiven && !c.revokedAt);

        if (!hasConsent) {
          return res.status(403).json({ message: "Patient has not approved Web3 consent yet" });
        }

        // Fetch and return Web3 records
        const records = await storage.getPatientRecordsByDID(patientDID);
        
        return res.json({
          message: "Web3 consent verified",
          records,
          patientDID,
        });
      }

      const records = await storage.getPatientRecordsByNationalId(normalizedNationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Check if consent records already exist for this patient and hospital
      const existingConsents = await storage.getConsentRecordsByPatientId(normalizedNationalId, user.id);
      
      if (existingConsents.length > 0) {
        // Update existing consent records with new consent grantor
        for (const consent of existingConsents) {
          await storage.updateConsentRecord(consent.id, {
            consentGrantedBy: user.id.toString(),
            accessedAt: new Date(),
          });
          
          // Log record access event
          await auditService.logEvent({
            eventType: "RECORD_ACCESSED",
            actorType: "HOSPITAL",
            actorId: user.username,
            targetType: "RECORD",
            targetId: consent.id.toString(),
            action: "READ",
            outcome: "SUCCESS",
            metadata: { 
              patientId: normalizedNationalId,
              recordId: consent.id,
              hospitalId: user.id,
              hospitalName: user.hospitalName,
            },
            severity: "info",
          }, req);
        }
      } else {
        // Create new consent records for each patient record
        for (const record of records) {
          await storage.createConsentRecord({
            patientId: normalizedNationalId,
            accessedBy: user.id,
            recordId: record.id,
            consentGrantedBy: user.id.toString(),
            hospital_id: user.hospital_id,
            consent_type: 'traditional',
          });
          
          // Log record access event
          await auditService.logEvent({
            eventType: "RECORD_ACCESSED",
            actorType: "HOSPITAL",
            actorId: user.username,
            targetType: "RECORD",
            targetId: record.id.toString(),
            action: "READ",
            outcome: "SUCCESS",
            metadata: { 
              patientId: normalizedNationalId,
              recordId: record.id,
              hospitalId: user.id,
              hospitalName: user.hospitalName,
            },
            severity: "info",
          }, req);
        }
      }

      // Update consent request status
      await storage.updateConsentRequestStatus(normalizedNationalId, user.id, "granted");

      await auditService.logEvent({
        eventType: "CONSENT_GRANTED",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: normalizedNationalId,
        action: "GRANT_CONSENT",
        outcome: "SUCCESS",
        metadata: { 
          recordCount: records.length,
          consentGrantedBy: user.id.toString(),
          hospitalName: user.hospitalName,
          updatedExisting: existingConsents.length > 0,
        },
        severity: "info",
      });

      // Consent processing completed
      res.json({ 
        message: existingConsents.length > 0 ? 
          "Consent renewed successfully" : 
          "Consent granted successfully",
        records: records,
        updatedExisting: existingConsents.length > 0,
      });
    } catch (error) {
      next(error);
    }
  });

  // Revoke consent
  app.post("/api/revoke-consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { nationalId } = z.object({
        nationalId: z.string(),
      }).parse(req.body);

      // Revoke all consent records for this patient and hospital
      await storage.revokeConsentRecords(nationalId, user.id);

      await auditService.logEvent({
        eventType: "CONSENT_REVOKED",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: nationalId,
        action: "REVOKE_CONSENT",
        outcome: "SUCCESS",
        metadata: { 
          hospitalName: user.hospitalName,
        },
        severity: "info",
      });

      res.json({ 
        message: "Consent revoked successfully"
      });
    } catch (error) {
      next(error);
    }
  });

  // Get Web3 patient records (Hospital B)
  app.post("/api/web3/get-records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can retrieve Web3 records" });
      }

      const { patientDID } = z.object({ patientDID: z.string() }).parse(req.body);
      
      console.log('[DEBUG] Web3 get-records: Searching for patientDID:', patientDID);
      
      // Get Web3 records by DID - filter for recordType: 'web3' only
      const web3Records = await storage.getWeb3PatientRecordsByDID(patientDID);
      console.log('[DEBUG] Web3 get-records: Web3 records found:', web3Records.length);
      
      if (web3Records.length === 0) {
        return res.status(404).json({ message: "No Web3 records found for this patient" });
      }

      // Check if consent has been granted for this hospital and is not expired
      const consentRecords = await storage.getConsentByPatientAndRequester(patientDID, `did:medbridge:hospital:${user.id}`);
      const now = new Date();
      // Require explicit expiry; null expiry is NOT considered valid
      const validConsents = consentRecords.filter(c => c.consentGiven && !c.revokedAt && !!c.expiresAt && now < c.expiresAt);
      const hasConsent = validConsents.length > 0;
      let consentExpiresAt: Date | null = null;
      if (hasConsent) {
        const expiries = validConsents.map(c => new Date(c.expiresAt as any).getTime()).filter(Boolean);
        if (expiries.length > 0) {
          consentExpiresAt = new Date(Math.min(...expiries));
        }
      }

      if (!hasConsent) {
        return res.status(403).json({ 
          message: "Patient consent required to access Web3 records",
          patientDID,
          recordCount: web3Records.length,
          requiresConsent: true
        });
      }

      // Return full records if consent is granted
      res.json({
        patientDID,
        recordCount: web3Records.length,
        hasConsent: true,
        consentExpiresAt,
        records: web3Records.map(record => ({
          id: record.id,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
          submittedAt: record.submittedAt,
          recordType: record.recordType,
          ipfsHash: record.ipfsHash,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // Register security testing routes
  registerSecurityTestingRoutes(app);

  // Issue verifiable credential for consent (missing endpoint)
  app.post("/api/issue-consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { patientId, hospitalId, recordId, validForHours } = z.object({
        patientId: z.string(),
        hospitalId: z.number(),
        recordId: z.number(),
        validForHours: z.number().optional().default(24),
      }).parse(req.body);

      // Get patient profile to find their DID
      const patientProfile = await storage.getPatientProfileByNationalId(patientId);
      if (!patientProfile || !patientProfile.patientDID) {
        return res.status(404).json({ message: "No Web3 identity found for this patient" });
      }

      const patientDID = patientProfile.patientDID;
      const requesterId = `did:medbridge:hospital:${hospitalId}`;

      // Check if consent already exists
      const existingConsents = await storage.getConsentByPatientAndRequester(patientDID, requesterId);
      
      if (existingConsents.length > 0) {
        return res.status(400).json({ 
          message: "Consent already exists for this patient and hospital",
          existingConsent: true
        });
      }

      // Create Web3 consent record
      const consentRecord = await storage.createWeb3Consent({
        patientDID,
        requesterId,
        consentType: 'read',
        consentGiven: true,
        expiresAt: new Date(Date.now() + (validForHours * 60 * 60 * 1000)),
        revokedAt: null,
      });

      // Issue verifiable credential
      const jwtVc = await consentService.issueConsentCredential(
        patientDID,
        requesterId,
        recordId.toString(),
        'read'
      );

      // Store the verifiable credential
      const storedCredential = await storage.createVerifiableCredential({
        patientDID,
        issuerDID: patientDID,
        credentialType: "HealthcareConsent",
        jwtVc: jwtVc,
      });

      // Update consent record with credential ID
      await storage.updateWeb3Consent(consentRecord.id, {
        consentCredentialId: storedCredential.id,
      });

      await auditService.logEvent({
        eventType: "WEB3_CONSENT_ISSUED",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: patientId,
        action: "ISSUE_WEB3_CONSENT",
        outcome: "SUCCESS",
        metadata: { 
          patientDID,
          requesterId,
          recordId,
          validForHours,
          hospitalName: user.hospitalName,
        },
        severity: "info",
      });

      res.json({
        success: true,
        message: "Verifiable credential issued successfully",
        verifiableCredential: jwtVc,
        consentId: consentRecord.id,
        credentialId: storedCredential.id,
        expiresAt: consentRecord.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // Access record using verifiable credential (missing endpoint)
  app.post("/api/get-record", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { verifiableCredential, hospitalDID } = z.object({
        verifiableCredential: z.string(),
        hospitalDID: z.string(),
      }).parse(req.body);

      // Verify the verifiable credential
      const verificationResult = await consentService.verifyConsentCredential(verifiableCredential);
      
      if (!verificationResult.isValid) {
        return res.status(401).json({ message: verificationResult.error || "Invalid verifiable credential" });
      }

      // Extract information from the credential
      const vcPayload = verificationResult.verifiedJwt!.payload.vc;
      const credentialSubject = vcPayload.credentialSubject;
      
      if (!credentialSubject || !credentialSubject.contentHash) {
        return res.status(400).json({ message: "Unable to parse verifiable credential" });
      }

      const patientDID = verificationResult.verifiedJwt!.payload.iss;
      const recordId = credentialSubject.contentHash;

      // Check if consent is still valid
      const consents = await storage.getConsentByPatientAndRequester(patientDID, hospitalDID);
      const validConsent = consents.find(consent => 
        consent.consentGiven && 
        !consent.revokedAt &&
        (!consent.expiresAt || new Date() < consent.expiresAt)
      );

      if (!validConsent) {
        return res.status(403).json({ message: "Consent has expired or been revoked" });
      }

      // Get the specific record
      const record = await storage.getPatientRecordById(parseInt(recordId));
      
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      // If it's a Web3 record with IPFS hash, decrypt it
      let recordData = null;
      if (record.ipfsHash && record.encryptionKey) {
        try {
          const plaintextEncryptionKey = await secureKeyVault.decryptDataKey(record.encryptionKey);
          recordData = await ipfsService.retrieveContent(record.ipfsHash, plaintextEncryptionKey);
        } catch (error) {
          // Failed to decrypt IPFS record
          return res.status(500).json({ message: "Failed to decrypt record data" });
        }
      } else {
        // Traditional record - return the record as is
        recordData = {
          id: record.id,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
          submittedAt: record.submittedAt,
        };
      }

      await auditService.logEvent({
        eventType: "RECORD_ACCESSED_VIA_VC",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: record.nationalId,
        action: "ACCESS_RECORD_WITH_VC",
        outcome: "SUCCESS",
        metadata: { 
          patientDID,
          recordId,
          hospitalDID,
          hospitalName: user.hospitalName,
          recordType: record.recordType,
        },
        severity: "info",
      });

      res.json({
        success: true,
        message: "Record accessed successfully using verifiable credential",
        record: recordData,
        patientDID,
        recordId,
        accessedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Emergency Consent Route
  app.post("/api/emergency/grant-consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required for emergency consent." });
      }

      // Role check for emergency consent authorization
      const user = req.user!;
      const authorizedRoles = ['PHYSICIAN', 'SURGEON', 'EMERGENCY_DOCTOR', 'CHIEF_RESIDENT'];
      
      // Role-based authorization for emergency consent
      // Admins can always authorize emergency consent
      const hasEmergencyAuth = user.isAdmin || 
        (user.hospitalType === "A" && user.username.includes("doctor")) ||
        (user.hospitalType === "B" && user.username.includes("emergency"));
      
      if (!hasEmergencyAuth) {
        await auditService.logSecurityViolation({
          violationType: "UNAUTHORIZED_EMERGENCY_CONSENT_ATTEMPT",
          severity: "high",
          actorId: user.username,
          targetResource: "emergency_consent",
          details: {
            userRole: user.hospitalType,
            isAdmin: user.isAdmin,
            attemptedAction: "emergency_consent_grant",
          },
        }, req);
        
        return res.status(403).json({ 
          message: "Insufficient privileges for emergency consent authorization. Only authorized medical staff can grant emergency consent." 
        });
      }

      const validationResult = emergencyConsentRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request body for emergency consent.", errors: validationResult.error.format() });
      }

      // Add requestingUserId to the data passed to the service
      const requestDataWithUser = {
        ...validationResult.data,
        requestingUserId: req.user!.username, // or req.user!.id if integer ID is preferred and available
        requestingUserIsAdmin: req.user!.isAdmin, // Pass admin status
      };

      // Add the authenticated user (requesting staff member) details if needed by the service,
      // or ensure primaryPhysician/secondaryAuthorizer are from authenticated staff.
      // For now, the requestData contains these details directly.
      // The system verifies that primaryPhysician or secondaryAuthorizer
      // is related to the authenticated req.user through the service's verifyDualAuthorization method.

      const result = await emergencyConsentService.grantEmergencyConsent(requestDataWithUser);

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Log the error reason if not already handled by auditService in the service
        // Emergency consent granting failed
        res.status(400).json({ message: result.error || "Failed to grant emergency consent.", auditTrail: result.auditTrail });
      }
    } catch (error) {
      // Catch any unexpected errors from the service or validation
      next(error);
    }
  });

  // Emergency Record Access APIs
  app.post("/api/emergency/access-records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required for emergency record access." });
      }

      const user = req.user!;
      const { temporaryCredential, patientId } = z.object({
        temporaryCredential: z.string(),
        patientId: z.string(),
      }).parse(req.body);

      // Validate emergency credential
      const validationResult = await emergencyCredentialService.validateCredential(temporaryCredential);
      
      if (!validationResult.isValid || !validationResult.credential) {
        return res.status(403).json({ 
          message: "Invalid or expired emergency credential",
          error: validationResult.error 
        });
      }

      // Verify the credential is for the correct patient
      if (validationResult.credential.patientId !== patientId) {
        await auditService.logSecurityViolation({
          violationType: "EMERGENCY_CREDENTIAL_PATIENT_MISMATCH",
          severity: "high",
          actorId: user.username,
          targetResource: `patient:${patientId}`,
          details: {
            credentialPatientId: validationResult.credential.patientId,
            requestedPatientId: patientId,
            emergencyConsentRecordId: validationResult.credential.emergencyConsentRecordId,
          },
        }, req);
        
        return res.status(403).json({ 
          message: "Emergency credential does not match requested patient" 
        });
      }

      // Get patient records using emergency access
      const recordsResult = await emergencyCredentialService.getPatientRecordsWithEmergencyAccess(
        validationResult.credential,
        user.username
      );

      if (!recordsResult.success) {
        return res.status(500).json({ 
          message: "Failed to retrieve patient records",
          error: recordsResult.error 
        });
      }

      res.json({
        success: true,
        message: "Emergency access granted",
        patientInfo: recordsResult.patientInfo,
        records: recordsResult.records,
        emergencyAccess: {
          accessLevel: validationResult.credential.accessLevel,
          limitations: validationResult.credential.limitations,
          expiresAt: validationResult.credential.expiresAt,
          emergencyConsentRecordId: validationResult.credential.emergencyConsentRecordId,
        },
        accessedAt: new Date().toISOString(),
      });

    } catch (error) {
      next(error);
    }
  });

  // Test endpoint to create a consent request (for debugging)
  app.post("/api/test/create-consent-request", async (req, res, next) => {
    try {
      const { patientId, hospitalId } = z.object({
        patientId: z.string(),
        hospitalId: z.number(),
      }).parse(req.body);

      // Create a consent request
      const consentRequest = await storage.createConsentRequest({
        patientId: patientId,
        requestedBy: hospitalId,
        reason: "Test consent request",
        status: "new",
        requestedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Test consent request created",
        consentRequest: consentRequest,
      });
    } catch (error) {
      next(error);
    }
  });

  // Patient recovery info endpoint
  app.get("/api/patient/recovery-info", async (req, res, next) => {
    try {
      const { patientDID } = req.query;
      
      if (!patientDID || typeof patientDID !== 'string') {
        return res.status(400).json({ error: "Patient DID is required" });
      }

      // Get patient identity to check if they have recovery info
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      
      if (!patientIdentity) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // For now, return basic recovery info
      // In production, this would check actual backup status
      const recoveryInfo = {
        hasBackup: true, // Would check actual backup status
        lastBackup: new Date().toISOString(),
        recoveryPhrase: null, // Would be generated on demand
        qrCodeData: null, // Would be generated on demand
      };

      res.json(recoveryInfo);
    } catch (error) {
      next(error);
    }
  });

  // IPFS status endpoint
  app.get("/api/ipfs/status", async (req, res, next) => {
    try {
      const { cid } = req.query;
      
      if (!cid || typeof cid !== 'string') {
        return res.status(400).json({ error: "CID is required" });
      }

      // Use the IPFS redundancy service to check status
      const status = await ipfsRedundancyService.checkContentAvailability(cid);
      
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  // Redis health check endpoint
  app.get("/api/redis/health", async (req, res, next) => {
    try {
      const isHealthy = await redisService.healthCheck();
      const stats = await redisService.getCacheStats();
      
      res.json({
        healthy: isHealthy,
        stats: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Cache management endpoints (admin only)
  app.post("/api/admin/cache/clear", requireAdminAuth, async (req, res, next) => {
    try {
      await redisService.clearAllCaches();
      res.json({ 
        message: "All caches cleared successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cache/stats", requireAdminAuth, async (req, res, next) => {
    try {
      const stats = await redisService.getCacheStats();
      res.json({
        stats: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Test SMS endpoint
  app.post("/api/test/sms", async (req, res, next) => {
    try {
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }

      await smsService.sendOTPSMS({
        to,
        otpCode: message,
        expiresInMinutes: 10
      });
      
      res.json({ 
        success: true, 
        message: "SMS sent successfully",
        to,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // --- HOSPITAL STAFF PROFILE ENDPOINTS ---

  // Complete hospital staff profile (create new staff)
  app.post("/api/hospital/complete-staff-profile", requireAdminAuth, async (req, res, next) => {
    try {
      const { hospitalId, adminLicense, staff } = z.object({
        hospitalId: z.string(),
        adminLicense: z.string().min(1),
        staff: z.array(z.object({
          name: z.string().min(1),
          staffId: z.string().min(1),
          role: z.enum(["PHYSICIAN", "SURGEON", "EMERGENCY_DOCTOR", "CHIEF_RESIDENT"]),
          licenseNumber: z.string().min(1),
          department: z.string().min(1),
          email: z.string().email(),
          isActive: z.boolean(),
          isOnDuty: z.boolean(),
        })).min(2).max(3),
      }).parse(req.body);

      // Validate that the authenticated user is from the specified hospital
      if (req.user!.id.toString() !== hospitalId) {
        return res.status(403).json({ error: "You can only manage staff for your own hospital" });
      }

      // Check for duplicate staff IDs
      const staffIds = staff.map(s => s.staffId);
      const uniqueIds = new Set(staffIds);
      if (uniqueIds.size !== staffIds.length) {
        return res.status(400).json({ error: "Duplicate staff IDs are not allowed. Each staff member must have a unique staff ID." });
      }

      // Check for duplicate emails
      const emails = staff.map(s => s.email);
      const uniqueEmails = new Set(emails);
      if (uniqueEmails.size !== emails.length) {
        return res.status(400).json({ error: "Duplicate email addresses are not allowed. Each staff member must have a unique email." });
      }

      // Create staff records and send email invitations
      let createdStaff;
      const staffInvitationService = StaffInvitationService.getInstance();
      
      try {
        createdStaff = await Promise.all(
          staff.map(async (staffMember) => {
            // Create the staff record first
            const staffRecord = await storage.createHospitalStaff({
              staffId: staffMember.staffId,
              name: staffMember.name,
              role: staffMember.role,
              licenseNumber: staffMember.licenseNumber,
              department: staffMember.department,
              email: staffMember.email,
              hospitalId: hospitalId,
              isActive: staffMember.isActive,
              isOnDuty: staffMember.isOnDuty,
            });

            // Send email invitation for this staff member
            const invitationResult = await staffInvitationService.createStaffInvitation(
              parseInt(hospitalId),
              req.user!.id,
              {
                email: staffMember.email,
                role: 'EMERGENCY_AUTHORIZER', // All profile completion staff are emergency authorizers
                department: staffMember.department,
                name: staffMember.name,
              }
            );

            if (!invitationResult.success) {
              console.error(`Failed to send invitation to ${staffMember.email}:`, invitationResult.error);
              // Continue with staff creation even if email fails
            }

            return staffRecord;
          })
        );
      } catch (err: any) {
        if (err.code === '23505' && err.detail && err.detail.includes('staff_id')) {
          // Duplicate staffId error
          const match = err.detail.match(/\(staff_id\)=\(([^)]+)\)/);
          const duplicateId = match ? match[1] : undefined;
          return res.status(400).json({ error: `Duplicate staff ID: ${duplicateId || 'unknown'}. Each staff member must have a unique staff ID.` });
        }
        // Other DB error
        return res.status(500).json({ error: `Database error: ${err.message || 'Unknown error'}` });
      }

      // Update admin user's adminLicense
      await storage.updateUser(req.user!.id, { adminLicense });

      // Log the event
      await auditService.logEvent({
        eventType: "STAFF_PROFILE_COMPLETED",
        actorType: "HOSPITAL_ADMIN",
        actorId: req.user!.id.toString(),
        targetType: "HOSPITAL_STAFF",
        targetId: hospitalId,
        action: "CREATE",
        outcome: "SUCCESS",
        metadata: { 
          staffCount: createdStaff.length,
          staffIds: staffIds,
          emails: emails,
          hospitalId 
        },
        severity: "info",
      });

      res.json({
        success: true,
        message: "Staff profile completed successfully. Email invitations have been sent to all staff members.",
        staff: createdStaff,
      });
    } catch (error: any) {
      console.error('Full error in complete-staff-profile:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ error: `Failed to complete staff profile: ${error.message}` });
    }
  });

  // Update hospital staff profile
  app.post("/api/hospital/update-staff-profile", requireAdminAuth, async (req, res, next) => {
    try {
      const { hospitalId, adminLicense, staff } = z.object({
        hospitalId: z.string(),
        adminLicense: z.string().min(1),
        staff: z.array(z.object({
          id: z.number().optional(),
          name: z.string().min(1),
          staffId: z.string().min(1),
          role: z.enum(["PHYSICIAN", "SURGEON", "EMERGENCY_DOCTOR", "CHIEF_RESIDENT"]),
          licenseNumber: z.string().min(1),
          department: z.string().min(1),
          email: z.string().email(),
          isActive: z.boolean(),
          isOnDuty: z.boolean(),
        })).min(2).max(3),
      }).parse(req.body);

      // Validate that the authenticated user is from the specified hospital
      if (req.user!.id.toString() !== hospitalId) {
        return res.status(403).json({ error: "You can only manage staff for your own hospital" });
      }

      // Check for duplicate staff IDs
      const staffIds = staff.map(s => s.staffId);
      const uniqueIds = new Set(staffIds);
      if (uniqueIds.size !== staffIds.length) {
        return res.status(400).json({ error: "Duplicate staff IDs are not allowed. Each staff member must have a unique staff ID." });
      }

      // Check for duplicate emails
      const emails = staff.map(s => s.email);
      const uniqueEmails = new Set(emails);
      if (uniqueEmails.size !== emails.length) {
        return res.status(400).json({ error: "Duplicate email addresses are not allowed. Each staff member must have a unique email." });
      }

      // Update staff records and send email invitations for new staff
      let updatedStaff;
      const staffInvitationService = StaffInvitationService.getInstance();
      
      try {
        updatedStaff = await Promise.all(
          staff.map(async (staffMember) => {
            if (staffMember.id) {
              // Update existing staff
              return await storage.updateHospitalStaff(staffMember.id, {
                staffId: staffMember.staffId,
                name: staffMember.name,
                role: staffMember.role,
                licenseNumber: staffMember.licenseNumber,
                department: staffMember.department,
                email: staffMember.email,
                isActive: staffMember.isActive,
                isOnDuty: staffMember.isOnDuty,
              });
            } else {
              // Create new staff and send invitation
              const staffRecord = await storage.createHospitalStaff({
                staffId: staffMember.staffId,
                name: staffMember.name,
                role: staffMember.role,
                licenseNumber: staffMember.licenseNumber,
                department: staffMember.department,
                email: staffMember.email,
                hospitalId: hospitalId,
                isActive: staffMember.isActive,
                isOnDuty: staffMember.isOnDuty,
              });

              // Send email invitation for new staff member
              const invitationResult = await staffInvitationService.createStaffInvitation(
                parseInt(hospitalId),
                req.user!.id,
                {
                  email: staffMember.email,
                  role: 'EMERGENCY_AUTHORIZER', // All profile completion staff are emergency authorizers
                  department: staffMember.department,
                  name: staffMember.name,
                }
              );

              if (!invitationResult.success) {
                console.error(`Failed to send invitation to ${staffMember.email}:`, invitationResult.error);
                // Continue with staff creation even if email fails
              }

              return staffRecord;
            }
          })
        );
      } catch (err: any) {
        if (err.code === '23505' && err.detail && err.detail.includes('staff_id')) {
          // Duplicate staffId error
          const match = err.detail.match(/\(staff_id\)=\(([^)]+)\)/);
          const duplicateId = match ? match[1] : undefined;
          return res.status(400).json({ error: `Duplicate staff ID: ${duplicateId || 'unknown'}. Each staff member must have a unique staff ID.` });
        }
        // Other DB error
        return res.status(500).json({ error: `Database error: ${err.message || 'Unknown error'}` });
      }

      // Update admin user's adminLicense
      await storage.updateUser(req.user!.id, { adminLicense });

      // Log the event
      await auditService.logEvent({
        eventType: "STAFF_PROFILE_UPDATED",
        actorType: "HOSPITAL_ADMIN",
        actorId: req.user!.id.toString(),
        targetType: "HOSPITAL_STAFF",
        targetId: hospitalId,
        action: "UPDATE",
        outcome: "SUCCESS",
        metadata: { 
          staffCount: updatedStaff.length,
          staffIds: staffIds,
          emails: emails,
          hospitalId 
        },
        severity: "info",
      });

      res.json({
        success: true,
        message: "Staff profile updated successfully. Email invitations have been sent to new staff members.",
        staff: updatedStaff,
      });
    } catch (error: any) {
      console.error('Full error in update-staff-profile:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ error: `Failed to update staff profile: ${error.message}` });
    }
  });

  // Get hospital staff profile status
  app.get("/api/hospital/staff-profile", requireAdminAuth, async (req, res, next) => {
    try {
      const { hospitalId } = req.query;
      
      if (!hospitalId || typeof hospitalId !== 'string') {
        return res.status(400).json({ error: "Hospital ID is required" });
      }

      // Validate that the authenticated user is from the specified hospital
      if (req.user!.id.toString() !== hospitalId) {
        return res.status(403).json({ error: "You can only view staff for your own hospital" });
      }

      // Get staff for this hospital
      const staff = await storage.getHospitalStaffByHospitalId(hospitalId);

      // Get admin license for this hospital (from the admin user)
      const adminUser = await storage.getUser(parseInt(hospitalId));
      const adminLicense = adminUser?.adminLicense || "";

      res.json({
        hasStaffProfile: staff.length >= 2 && !!adminLicense,
        staffCount: staff.length,
        staff: staff,
        adminLicense,
      });
    } catch (error) {
      next(error);
    }
  });

  // --- ADMIN DASHBOARD ENDPOINTS ---

  // Security & Audit Summary (for admin dashboard)
  app.get("/api/security/audit-summary", requireAdminAuth, async (req, res, next) => {
    try {
      const summary = await storage.getAuditSummary(req.user!.hospital_id);
      res.json({ summary });
    } catch (error) {
      next(error);
    }
  });

  // Recent Security Violations (for admin dashboard)
  app.get("/api/admin/security-violations", requireAdminAuth, async (req, res, next) => {
    try {
      const resolved = req.query.resolved === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const violations = await storage.getSecurityViolations({ resolved, limit, hospital_id: req.user!.hospital_id });
      res.json({ violations });
    } catch (error) {
      next(error);
    }
  });

  // Resolve security violation
  app.post("/api/admin/security-violations/:id/resolve", requireAdminAuth, async (req, res, next) => {
    try {
      const violationId = parseInt(req.params.id);
      if (isNaN(violationId)) {
        return res.status(400).json({ error: "Invalid violation ID" });
      }

      await storage.resolveSecurityViolation(violationId, req.user!.hospital_id);
      
      // Log the resolution event
      await auditService.logEvent({
        eventType: "SECURITY_VIOLATION_RESOLVED",
        actorType: "HOSPITAL_ADMIN",
        actorId: req.user!.id.toString(),
        targetType: "SECURITY_VIOLATION",
        targetId: violationId.toString(),
        action: "RESOLVE",
        outcome: "SUCCESS",
        metadata: { violationId },
        severity: "info",
      }, req);

      res.json({ success: true, message: "Security violation resolved successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Unresolve security violation
  app.post("/api/admin/security-violations/:id/unresolve", requireAdminAuth, async (req, res, next) => {
    try {
      const violationId = parseInt(req.params.id);
      if (isNaN(violationId)) {
        return res.status(400).json({ error: "Invalid violation ID" });
      }

      await storage.unresolveSecurityViolation(violationId, req.user!.hospital_id);
      
      // Log the unresolution event
      await auditService.logEvent({
        eventType: "SECURITY_VIOLATION_UNRESOLVED",
        actorType: "HOSPITAL_ADMIN",
        actorId: req.user!.id.toString(),
        targetType: "SECURITY_VIOLATION",
        targetId: violationId.toString(),
        action: "UNRESOLVE",
        outcome: "SUCCESS",
        metadata: { violationId },
        severity: "warning",
      }, req);

      res.json({ success: true, message: "Security violation marked as unresolved" });
    } catch (error) {
      next(error);
    }
  });

  // Resend invitation to a staff member
  app.post("/api/hospital/resend-invitation", requireAdminAuth, async (req, res, next) => {
    try {
      const { staffId, email, forceResend } = req.body;
      if (!staffId && !email) {
        return res.status(400).json({ error: "staffId or email is required" });
      }
      // Find staff by staffId or email
      let staff;
      if (staffId) {
        staff = await storage.getHospitalStaffByStaffId(staffId);
      } else {
        const allStaff = await storage.getHospitalStaffByHospitalId(req.user!.id.toString());
        staff = allStaff.find(s => s.email === email);
      }
      if (!staff) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      // Trigger invitation logic, pass forceResend
      const staffInvitationService = StaffInvitationService.getInstance();
      const invitationResult = await staffInvitationService.createStaffInvitation(
        parseInt(staff.hospitalId),
        req.user!.id,
        {
          email: staff.email || "",
          role: (staff.role as any) || "BOTH_A_B",
          department: staff.department,
          name: staff.name,
        },
        forceResend === true
      );
      if (!invitationResult.success) {
        return res.status(500).json({ error: invitationResult.error || "Failed to send invitation" });
      }
      res.json({ success: true, message: "Invitation resent successfully" });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
