import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { patientWeb3Service } from "./patient-web3-service";
import { auditService } from "./audit-service";
import { emailService } from "./email-service";
import { nanoid } from 'nanoid';

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    patientId?: number;
    patientDID?: string;
    phoneNumber?: string;
  }
}

/**
 * Simplified Patient Routes - Web3 backend with Web2 frontend
 * Patients authenticate via phone/OTP, DIDs generated automatically
 */
export function registerSimplifiedPatientRoutes(app: Express): void {

  // In-memory storage for OTP (replace with Redis in production)
  const otpStore = new Map<string, { code: string; expires: number; method: string }>();

  /**
   * Send OTP to patient phone or email (dual verification support)
   * POST /api/patient/request-otp
   */
  app.post("/api/patient/request-otp", async (req, res) => {
    try {
      const { contact, method } = z.object({
        contact: z.string(),
        method: z.enum(["phone", "email"]).default("phone"),
      }).parse(req.body);

      // Validate contact based on method
      if (method === "phone") {
        if (!contact.match(/^\+\d{9,15}$/)) {
          return res.status(400).json({ error: "Invalid phone number. Use international format like +254712345678" });
        }
      } else {
        if (!contact.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          return res.status(400).json({ error: "Invalid email address" });
        }
      }
      
      const otpCode = patientWeb3Service.generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      
      otpStore.set(contact, { code: otpCode, expires: expiresAt, method });
      
      // In production, send SMS via Twilio or email via SendGrid
      if (method === "phone") {
        console.log(`[SMS OTP] ${contact}: ${otpCode}`);
      } else {
        // Send email OTP using email service
        await emailService.sendOTPEmail({
          to: contact,
          otpCode,
          expiresInMinutes: 10
        });
      }
      
      // Enhanced audit logging for OTP requests
      await auditService.logAuthEvent(
        "OTP_REQUEST",
        contact,
        method,
        "SUCCESS",
        req,
        { expiresIn: 600 }
      );
      
      res.json({
        success: true,
        message: `OTP sent to your ${method}`,
        expiresIn: 600,
        method,
      });
      
    } catch (error: any) {
      await auditService.logAuthEvent(
        "OTP_REQUEST",
        req.body.contact || "unknown",
        req.body.method || "unknown",
        "FAILURE",
        req,
        { error: error.message }
      );
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
      
      // Check if patient exists in database
      let patientProfile = await storage.getPatientProfileByPhone(phoneNumber);
      
      if (!patientProfile) {
        // First-time user: Generate DID and create profile
        const identity = await patientWeb3Service.createPatientIdentity(phoneNumber);
        
        // Create basic profile (National ID will be added later)
        patientProfile = await storage.createPatientProfile({
          patientDID: identity.patientDID,
          nationalId: "", // Will be set during profile completion
          phoneNumber,
          email: phoneNumber.includes('@') ? phoneNumber : null,
          fullName: "", // Will be set during profile completion
          isProfileComplete: false,
        });
        
        console.log(`[INFO] Created patient profile: ${identity.patientDID}`);
        
        // Send welcome email if it's an email-based account
        if (phoneNumber.includes('@')) {
          await emailService.sendWelcomeEmail(phoneNumber, identity.patientDID);
        }
      }
      
      // Create session
      req.session.patientId = patientProfile.id;
      req.session.patientDID = patientProfile.patientDID;
      req.session.phoneNumber = phoneNumber;
      
      res.json({
        success: true,
        patient: {
          id: patientProfile.id,
          phoneNumber: patientProfile.phoneNumber,
          patientDID: patientProfile.patientDID,
          isNewUser: !patientProfile.isProfileComplete,
          isProfileComplete: patientProfile.isProfileComplete,
          createdAt: patientProfile.createdAt,
        },
      });
      
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Complete patient profile with National ID and full name
   * POST /api/patient/complete-profile
   */
  app.post("/api/patient/complete-profile", async (req, res) => {
    try {
      if (!req.session.patientDID) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { nationalId, fullName } = z.object({
        nationalId: z.string().min(1, "National ID is required"),
        fullName: z.string().min(1, "Full name is required"),
      }).parse(req.body);

      // Check if National ID is already taken
      const existingProfile = await storage.getPatientProfileByNationalId(nationalId);
      if (existingProfile && existingProfile.patientDID !== req.session.patientDID) {
        return res.status(400).json({ error: "This National ID is already registered with another account" });
      }

      // Update patient profile
      const updatedProfile = await storage.updatePatientProfile(req.session.patientDID, {
        nationalId,
        fullName,
        isProfileComplete: true,
      });

      await auditService.logEvent({
        eventType: "PATIENT_PROFILE_COMPLETED",
        actorType: "PATIENT",
        actorId: req.session.patientDID,
        targetType: "PATIENT_PROFILE",
        targetId: req.session.patientDID,
        action: "UPDATE",
        outcome: "SUCCESS",
        metadata: { nationalId, fullName },
        severity: "info",
      });

      res.json({
        success: true,
        patient: {
          id: updatedProfile.id,
          phoneNumber: updatedProfile.phoneNumber,
          patientDID: updatedProfile.patientDID,
          nationalId: updatedProfile.nationalId,
          fullName: updatedProfile.fullName,
          isProfileComplete: updatedProfile.isProfileComplete,
        },
      });
      
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get patient info
   * GET /api/patient/me
   */
  app.get("/api/patient/me", async (req, res) => {
    if (!req.session.patientDID) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const patientProfile = await storage.getPatientProfileByDID(req.session.patientDID);
    if (!patientProfile) {
      return res.status(401).json({ error: "Invalid session" });
    }
    
    res.json({
      patient: {
        id: patientProfile.id,
        phoneNumber: patientProfile.phoneNumber,
        email: patientProfile.email,
        patientDID: patientProfile.patientDID,
        nationalId: patientProfile.nationalId,
        fullName: patientProfile.fullName,
        isProfileComplete: patientProfile.isProfileComplete,
        createdAt: patientProfile.createdAt,
        updatedAt: patientProfile.updatedAt,
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

  /**
   * Get patient's medical records
   * GET /api/patient/records
   */
  app.get("/api/patient/records", async (req, res) => {
    try {
      if (!req.session.patientDID) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const patientProfile = await storage.getPatientProfileByDID(req.session.patientDID);
      if (!patientProfile) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Get records by National ID (if available) or DID
      let records = [];
      if (patientProfile.nationalId) {
        records = await storage.getPatientRecordsByNationalId(patientProfile.nationalId);
      } else {
        records = await storage.getPatientRecordsByDID(req.session.patientDID);
      }

      // Get consent records for this patient
      const consentRecords = await storage.getConsentRecordsByPatientId(
        patientProfile.nationalId || req.session.patientDID,
        0 // 0 means all hospitals
      );

      // Format records with consent information
      const formattedRecords = records.map(record => {
        const recordConsents = consentRecords.filter(cr => cr.recordId === record.id);
        return {
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
          consentGiven: record.consentGiven,
          consentRecords: recordConsents.map(cr => ({
            accessedBy: cr.accessedBy,
            consentGrantedBy: cr.consentGrantedBy,
            accessedAt: cr.accessedAt,
          })),
        };
      });

      await auditService.logEvent({
        eventType: "PATIENT_RECORDS_ACCESSED",
        actorType: "PATIENT",
        actorId: req.session.patientDID,
        targetType: "PATIENT_RECORDS",
        targetId: req.session.patientDID,
        action: "VIEW",
        outcome: "SUCCESS",
        metadata: { 
          recordCount: formattedRecords.length,
          hasNationalId: !!patientProfile.nationalId,
        },
        severity: "info",
      });

      res.json({
        success: true,
        records: formattedRecords,
        totalRecords: formattedRecords.length,
        patientInfo: {
          nationalId: patientProfile.nationalId,
          fullName: patientProfile.fullName,
          phoneNumber: patientProfile.phoneNumber,
        },
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "PATIENT_RECORDS_ACCESS_ERROR",
        severity: "medium",
        actorId: req.session.patientDID || "unknown",
        targetResource: "patient_records",
        details: { error: error.message },
      });

      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  /**
   * Get patient's consent requests and history
   * GET /api/patient/consents
   */
  app.get("/api/patient/consents", async (req, res) => {
    try {
      if (!req.session.patientDID) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const patientProfile = await storage.getPatientProfileByDID(req.session.patientDID);
      if (!patientProfile) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Get all consent records for this patient
      let consentRecords: any[] = [];
      try {
        if (patientProfile.nationalId) {
          // Get consents by National ID for all hospitals (pass null to get all)
          consentRecords = await storage.getAllConsentRecordsByPatientId(patientProfile.nationalId);
        }
      } catch (error) {
        console.log("No traditional consent records found:", error);
        consentRecords = [];
      }

      // Get Web3 consents if patient has DID
      let web3Consents: any[] = [];
      try {
        if (req.session.patientDID) {
          web3Consents = await storage.getConsentByPatientAndRequester(req.session.patientDID, "");
        }
      } catch (error) {
        console.log("No Web3 consent records found:", error);
        web3Consents = [];
      }

      res.json({
        success: true,
        traditionalConsents: consentRecords,
        web3Consents: web3Consents,
        totalConsents: consentRecords.length + web3Consents.length,
      });

    } catch (error: any) {
      console.error("Error fetching patient consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });
}