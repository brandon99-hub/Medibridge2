import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPatientRecordSchema, insertConsentRecordSchema } from "@shared/schema";
import { registerWeb3Routes } from "./web3-routes";
import { registerSimplifiedPatientRoutes } from "./simplified-patient-routes";
import { registerSecurityTestingRoutes } from "./security-testing-routes";
import { patientLookupService } from "./patient-lookup-service";
import { emergencyConsentService } from "./emergency-consent-service"; // Import EmergencyConsentService
import { z } from "zod";
import { auditService } from "./audit-service";
import { consentService, ipfsService } from "./web3-services";
import { secureKeyVault } from "./secure-key-vault";

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


export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Simplified patient routes with Web3 backend, Web2 UX
  registerSimplifiedPatientRoutes(app);

  // Setup Web3 routes
  registerWeb3Routes(app);

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
      };
      
      const record = await storage.createPatientRecord(recordData);

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
        return res.status(403).json({ message: "Only Hospital B can perform patient lookup" });
      }

      const { phoneNumber } = req.body;
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const searchResult = await patientLookupService.searchByPhoneNumber(
        phoneNumber,
        user.id.toString(), // hospitalId
        user.username // staffId
      );

      res.json(searchResult);
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
      const hasConsent = consentRecords.length > 0;

      // Return patient info and record count for consent modal
      res.json({
        patientName: records[0].patientName,
        nationalId: records[0].nationalId,
        recordCount: records.length,
        patientDID: patientProfile?.patientDID,
        hasWeb3Profile: !!patientProfile,
        hasConsent: hasConsent,
        records: hasConsent ? records.map(record => ({
          id: record.id,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
          submittedAt: record.submittedAt,
          recordType: record.recordType,
        })) : [], // Don't return records if no consent
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

      console.log("=== CONSENT DEBUG START ===");
      console.log("Request nationalId:", nationalId);
      console.log("Normalized nationalId:", normalizedNationalId);
      console.log("Request consentType:", consentType);
      console.log("User hospital type:", user.hospitalType);

      if (consentType === "web3") {
        // Web3 consent logic
        console.log("Processing Web3 consent for nationalId:", normalizedNationalId);
        
        // Check if the input is a DID or National ID
        const isDID = normalizedNationalId.startsWith('did:');
        console.log("Input appears to be DID:", isDID);
        
        let patientProfile;
        if (isDID) {
          // If it's a DID, look up by DID directly
          console.log("Looking up patient profile by DID:", normalizedNationalId);
          patientProfile = await storage.getPatientProfileByDID(normalizedNationalId);
        } else {
          // If it's a National ID, look up by National ID
          console.log("Looking up patient profile by National ID:", normalizedNationalId);
          patientProfile = await storage.getPatientProfileByNationalId(normalizedNationalId);
        }
        
        console.log("Patient profile found:", !!patientProfile);
        console.log("Patient profile details:", patientProfile);
        
        if (!patientProfile || !patientProfile.patientDID) {
          console.log("ERROR: No Web3 identity found for input:", normalizedNationalId);
          
          // Try fallback: search for patient records and get DID from there
          console.log("Trying fallback: searching for patient records...");
          const patientRecords = await storage.getPatientRecordsByNationalId(normalizedNationalId);
          if (patientRecords.length > 0 && patientRecords[0].patientDID) {
            console.log("Found patient DID in records:", patientRecords[0].patientDID);
            const fallbackProfile = await storage.getPatientProfileByDID(patientRecords[0].patientDID);
            if (fallbackProfile) {
              console.log("Found patient profile via fallback:", fallbackProfile);
              patientProfile = fallbackProfile;
            }
          }
          
          if (!patientProfile || !patientProfile.patientDID) {
            return res.status(404).json({ message: "No Web3 identity found for this patient" });
          }
        }
        
        const patientDID = patientProfile.patientDID;
        console.log("Patient DID:", patientDID);
        const requesterId = `did:medbridge:hospital:${user.id.toString()}`;
        console.log("Requester ID:", requesterId);
        
        const existingWeb3Consents = await storage.getConsentByPatientAndRequester(patientDID, requesterId);
        console.log("Existing Web3 consents:", existingWeb3Consents);
        
        const hasConsent = existingWeb3Consents.some(c => c.consentGiven && !c.revokedAt);
        console.log("Has consent:", hasConsent);

        if (!hasConsent) {
          console.log("ERROR: Patient has not approved Web3 consent yet");
          return res.status(403).json({ message: "Patient has not approved Web3 consent yet" });
        }

        // Fetch and return Web3 records
        const records = await storage.getPatientRecordsByDID(patientDID);
        console.log("Web3 records found:", records.length);
        console.log("=== CONSENT DEBUG END ===");
        
        return res.json({
          message: "Web3 consent verified",
          records,
          patientDID,
        });
      }

      console.log("Processing traditional consent for nationalId:", normalizedNationalId);
      const records = await storage.getPatientRecordsByNationalId(normalizedNationalId);
      console.log("Traditional records found:", records.length);
      
      if (records.length === 0) {
        console.log("ERROR: No records found for nationalId:", normalizedNationalId);
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Check if consent records already exist for this patient and hospital
      const existingConsents = await storage.getConsentRecordsByPatientId(normalizedNationalId, user.id);
      console.log("Existing consents:", existingConsents.length);
      
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

      console.log("=== CONSENT DEBUG END ===");
      res.json({ 
        message: existingConsents.length > 0 ? 
          "Consent renewed successfully" : 
          "Consent granted successfully",
        records: records,
        updatedExisting: existingConsents.length > 0,
      });
    } catch (error) {
      console.error("ERROR in consent endpoint:", error);
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
      
      // Get Web3 records by DID
      const records = await storage.getPatientRecordsByDID(patientDID);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No Web3 records found for this patient" });
      }

      // Check if consent has been granted for this hospital
      const consentRecords = await storage.getConsentByPatientAndRequester(patientDID, `did:medbridge:hospital:${user.id}`);
      const hasConsent = consentRecords.some(c => c.consentGiven && !c.revokedAt);

      if (!hasConsent) {
        return res.status(403).json({ 
          message: "Patient consent required to access Web3 records",
          patientDID,
          recordCount: records.length,
          requiresConsent: true
        });
      }

      // Return full records if consent is granted
      res.json({
        patientDID,
        recordCount: records.length,
        hasConsent: true,
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
          console.error("Failed to decrypt IPFS record:", error);
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
        // TODO: Add role check for specific medical staff authorized for emergency overrides
        return res.status(401).json({ message: "Authentication required for emergency consent." });
      }

      const validationResult = emergencyConsentRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request body for emergency consent.", errors: validationResult.error.format() });
      }

      // Add requestingUserId to the data passed to the service
      const requestDataWithUser = {
        ...validationResult.data,
        requestingUserId: req.user!.username, // or req.user!.id if integer ID is preferred and available
      };

      // Add the authenticated user (requesting staff member) details if needed by the service,
      // or ensure primaryPhysician/secondaryAuthorizer are from authenticated staff.
      // For now, the requestData contains these details directly.
      // It's crucial that the system verifies that primaryPhysician or secondaryAuthorizer
      // is related to the authenticated req.user if that's the desired security model.
      // The service's verifyDualAuthorization has placeholders for such checks.

      const result = await emergencyConsentService.grantEmergencyConsent(requestDataWithUser);

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Log the error reason if not already handled by auditService in the service
        console.error("Emergency consent granting failed:", result.error);
        res.status(400).json({ message: result.error || "Failed to grant emergency consent.", auditTrail: result.auditTrail });
      }
    } catch (error) {
      // Catch any unexpected errors from the service or validation
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

      console.log("=== TEST CONSENT REQUEST ===");
      console.log("Creating consent request for patient:", patientId, "by hospital:", hospitalId);

      // Create a consent request
      const consentRequest = await storage.createConsentRequest({
        patientId: patientId,
        requestedBy: hospitalId,
        reason: "Test consent request",
        status: "new",
        requestedAt: new Date(),
      });

      console.log("Consent request created:", consentRequest);

      res.json({
        success: true,
        message: "Test consent request created",
        consentRequest: consentRequest,
      });
    } catch (error) {
      console.error("Error creating test consent request:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
