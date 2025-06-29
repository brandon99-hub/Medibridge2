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
      const existingConsent = await storage.getConsentRecordsByPatientId(nationalId, user.id);
      const hasExistingConsent = existingConsent.length > 0;

      // Create a consent request record (pending approval)
      await storage.createConsentRequest({
        patientId: nationalId,
        requestedBy: user.id,
        reason: reason || "Medical care coordination",
        status: hasExistingConsent ? "renewal" : "new",
        requestedAt: new Date(),
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
      const { nationalId, consentGrantedBy } = z.object({
        nationalId: z.string(),
        consentGrantedBy: z.string(),
      }).parse(req.body);

      const records = await storage.getPatientRecordsByNationalId(nationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Check if consent records already exist for this patient and hospital
      const existingConsents = await storage.getConsentRecordsByPatientId(nationalId, user.id);
      
      if (existingConsents.length > 0) {
        // Update existing consent records with new consent grantor
        for (const consent of existingConsents) {
          await storage.updateConsentRecord(consent.id, {
            consentGrantedBy,
            accessedAt: new Date(),
          });
        }
      } else {
        // Create new consent records for each patient record
        for (const record of records) {
          await storage.createConsentRecord({
            patientId: nationalId,
            accessedBy: user.id,
            recordId: record.id,
            consentGrantedBy,
          });
        }
      }

      // Update consent request status
      await storage.updateConsentRequestStatus(nationalId, user.id, "granted");

      await auditService.logEvent({
        eventType: "CONSENT_GRANTED",
        actorType: "HOSPITAL",
        actorId: user.id.toString(),
        targetType: "PATIENT",
        targetId: nationalId,
        action: "GRANT_CONSENT",
        outcome: "SUCCESS",
        metadata: { 
          recordCount: records.length,
          consentGrantedBy,
          hospitalName: user.hospitalName,
          updatedExisting: existingConsents.length > 0,
        },
        severity: "info",
      });

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

  const httpServer = createServer(app);
  return httpServer;
}
