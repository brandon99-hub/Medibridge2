import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { patientWeb3Service } from "./patient-web3-service";

/**
 * Simplified Patient Routes - Web3 backend with Web2 frontend
 * Patients authenticate via phone/OTP, DIDs generated automatically
 */
export function registerSimplifiedPatientRoutes(app: Express): void {

  // In-memory storage for development (replace with database)
  const patientStore = new Map<string, any>();
  const otpStore = new Map<string, { code: string; expires: number }>();

  /**
   * Send OTP to patient phone
   * POST /api/patient/request-otp
   */
  app.post("/api/patient/request-otp", async (req, res) => {
    try {
      const { phoneNumber } = z.object({
        phoneNumber: z.string().regex(/^\+[1-9]\d{10,14}$/, "Invalid phone number"),
      }).parse(req.body);
      
      const otpCode = patientWeb3Service.generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      
      otpStore.set(phoneNumber, { code: otpCode, expires: expiresAt });
      
      // In production, send SMS via Twilio
      console.log(`[OTP] ${phoneNumber}: ${otpCode}`);
      
      res.json({
        success: true,
        message: "OTP sent to your phone",
        expiresIn: 600,
      });
      
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Verify OTP and login patient (creates DID automatically)
   * POST /api/patient/verify-otp
   */
  app.post("/api/patient/verify-otp", async (req, res) => {
    try {
      const { phoneNumber, otpCode } = z.object({
        phoneNumber: z.string(),
        otpCode: z.string().length(6),
      }).parse(req.body);
      
      // Verify OTP
      const storedOtp = otpStore.get(phoneNumber);
      if (!storedOtp || storedOtp.code !== otpCode || storedOtp.expires < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }
      
      // Remove used OTP
      otpStore.delete(phoneNumber);
      
      // Check if patient exists
      let patient = patientStore.get(phoneNumber);
      
      if (!patient) {
        // First-time user: Generate DID and keys automatically
        const identity = await patientWeb3Service.createPatientIdentity(phoneNumber);
        
        patient = {
          id: require('nanoid').nanoid(),
          phoneNumber,
          patientDID: identity.patientDID,
          encryptedKeys: identity.encryptedKeys,
          salt: identity.salt,
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
        };
        
        patientStore.set(phoneNumber, patient);
        console.log(`[INFO] Created patient identity: ${identity.patientDID}`);
      }
      
      // Update last login
      patient.lastLoginAt = new Date().toISOString();
      
      // Create session
      req.session.patientId = patient.id;
      req.session.patientDID = patient.patientDID;
      req.session.phoneNumber = phoneNumber;
      
      res.json({
        success: true,
        patient: {
          id: patient.id,
          phoneNumber: patient.phoneNumber,
          patientDID: patient.patientDID,
          isNewUser: !patient.lastLoginAt,
          createdAt: patient.createdAt,
        },
      });
      
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Issue consent credential - called when patient approves access
   * POST /api/issue-consent/
   */
  app.post("/api/issue-consent/", async (req, res) => {
    try {
      const { patientId, hospitalId, recordId, validForHours = 24 } = z.object({
        patientId: z.string(), // Phone number
        hospitalId: z.number(),
        recordId: z.number(),
        validForHours: z.number().default(24),
      }).parse(req.body);
      
      const patient = patientStore.get(patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Get hospital and record
      const hospital = await storage.getUser(hospitalId);
      const record = await storage.getPatientRecordById(recordId);
      
      if (!hospital || !record) {
        return res.status(404).json({ error: "Hospital or record not found" });
      }
      
      // Generate hospital DID if needed
      const hospitalDID = `did:medbridge:hospital:${hospital.username}`;
      
      // Encrypt and store record on IPFS if not already there
      let recordCID = record.ipfsCid;
      let encryptionKey = record.encryptionKey;
      
      if (!recordCID) {
        const recordData = {
          patientName: record.patientName,
          nationalId: record.nationalId,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
        };
        
        const encrypted = await patientWeb3Service.encryptMedicalRecord(recordData);
        recordCID = await patientWeb3Service.storeOnIPFS(encrypted.encryptedData, {
          patientDID: patient.patientDID,
          recordType: record.visitType || 'medical-visit',
          timestamp: new Date().toISOString(),
        });
        encryptionKey = encrypted.encryptionKey;
        
        // Update record in database
        await storage.updateRecordIPFS(recordId, recordCID, encryptionKey);
      }
      
      // Issue verifiable credential
      const credentialJWT = await patientWeb3Service.issueConsentCredential({
        patientDID: patient.patientDID,
        hospitalDID,
        recordCID,
        encryptionKey,
        expiresInHours: validForHours,
        patientPhone: patient.phoneNumber,
        encryptedKeys: patient.encryptedKeys,
        salt: patient.salt,
      });
      
      // Store consent record
      await storage.createConsentRecord({
        patientId: patient.phoneNumber,
        patientDID: patient.patientDID,
        recordId,
        consentGrantedBy: patient.phoneNumber,
        accessedBy: hospitalId,
        verifiableCredential: credentialJWT,
        expiresAt: new Date(Date.now() + validForHours * 60 * 60 * 1000),
      });
      
      res.json({
        success: true,
        verifiableCredential: credentialJWT,
        expiresAt: new Date(Date.now() + validForHours * 60 * 60 * 1000).toISOString(),
        recordCID,
        message: "Consent granted successfully",
      });
      
    } catch (error: any) {
      console.error("Issue consent failed:", error);
      res.status(500).json({ error: "Failed to issue consent", details: error.message });
    }
  });

  /**
   * Get medical record using verifiable credential
   * POST /api/get-record/
   */
  app.post("/api/get-record/", async (req, res) => {
    try {
      const { verifiableCredential, hospitalDID } = z.object({
        verifiableCredential: z.string(),
        hospitalDID: z.string(),
      }).parse(req.body);
      
      // Verify credential
      const verification = await patientWeb3Service.verifyCredential(verifiableCredential);
      if (!verification.isValid) {
        return res.status(401).json({ error: "Invalid credential", details: verification.error });
      }
      
      const credential = verification.credential!;
      
      // Verify hospital DID matches
      if (credential.subject !== hospitalDID) {
        return res.status(403).json({ error: "Credential not issued for this hospital" });
      }
      
      // Get encrypted record from IPFS
      const recordAccess = credential.credentialSubject.recordAccess;
      const { data: encryptedData } = await patientWeb3Service.retrieveFromIPFS(recordAccess.cid);
      
      // Decrypt record
      const decryptedRecord = await patientWeb3Service.decryptMedicalRecord(
        encryptedData,
        recordAccess.encryptionKey
      );
      
      console.log(`[AUDIT] Hospital ${hospitalDID} accessed record ${recordAccess.cid}`);
      
      res.json({
        success: true,
        record: decryptedRecord,
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: hospitalDID,
          recordCID: recordAccess.cid,
          grantedBy: credential.issuer,
        },
      });
      
    } catch (error: any) {
      console.error("Get record failed:", error);
      res.status(500).json({ error: "Failed to retrieve record", details: error.message });
    }
  });

  /**
   * Get patient info
   * GET /api/patient/me
   */
  app.get("/api/patient/me", (req, res) => {
    if (!req.session.phoneNumber) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const patient = patientStore.get(req.session.phoneNumber);
    if (!patient) {
      return res.status(401).json({ error: "Invalid session" });
    }
    
    res.json({
      patient: {
        id: patient.id,
        phoneNumber: patient.phoneNumber,
        patientDID: patient.patientDID,
        createdAt: patient.createdAt,
        lastLoginAt: patient.lastLoginAt,
      },
    });
  });

  /**
   * Patient logout
   * POST /api/patient/logout
   */
  app.post("/api/patient/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true, message: "Logged out successfully" });
    });
  });
}