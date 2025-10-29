import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { patientWeb3Service } from "./patient-web3-service";
import { auditService } from "./audit-service";
import { emailService } from "./email-service";
import { smsService } from "./sms-service";
import { nanoid } from 'nanoid';
import { redisService } from './redis-service';

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

  // Utility to ensure patient identity exists
  async function ensurePatientIdentityExists(patientDID: string, phoneNumber?: string) {
    const existing = await storage.getPatientIdentityByDID(patientDID);
    if (!existing) {
      await storage.createPatientIdentity({
        did: patientDID,
        walletAddress: null,
        publicKey: '',
        didDocument: null,
        phoneNumber: phoneNumber || null,
      });
    }
  }

  // Utility to sync phone number to patient_identities
  async function syncIdentityPhoneNumber(patientDID: string, phoneNumber?: string) {
    if (!phoneNumber) return;
    await storage.updatePatientIdentityPhoneNumber(patientDID, phoneNumber);
  }

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
      
      // Store OTP in Redis
      await redisService.storeOTP(contact, { code: otpCode, expires: expiresAt, method });
      
      // Send OTP via SMS or email
      if (method === "phone") {
        await smsService.sendOTPSMS({
          to: contact,
          otpCode,
          expiresInMinutes: 10
        });
      } else {
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
      return res.status(400).json({ error: `Failed to send OTP: ${error.message}` });
    }
  });

  /**
   * Verify OTP and login patient (creates DID automatically)
   * POST /api/patient/verify-otp
   */
  app.post("/api/patient/verify-otp", async (req, res) => {
    try {
      // Accept both 'contact' and 'phoneNumber' for backward compatibility
      const { phoneNumber, contact, otpCode } = z.object({
        phoneNumber: z.string().optional(),
        contact: z.string().optional(),
        otpCode: z.string().length(6),
      }).parse(req.body);
      
      // Use contact if provided, otherwise fall back to phoneNumber
      const identifier = contact || phoneNumber;
      if (!identifier) {
        return res.status(400).json({ error: "Contact information (email or phone) is required" });
      }
      
      // Verify OTP from Redis
      const storedOtp = await redisService.getOTP(identifier);
      if (!storedOtp || storedOtp.code !== otpCode || storedOtp.expires < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired OTP. Please request a new code." });
      }
      // Remove used OTP from Redis
      await redisService.deleteOTP(identifier);
      
      // Try to find existing profile by phone or email
      let patientProfile = await storage.findPatientProfileByEmailOrPhone(
        identifier.includes('@') ? identifier : undefined,
        !identifier.includes('@') ? identifier : undefined
      );
      
      if (patientProfile) {
        // Ensure identity exists for existing profile
        await ensurePatientIdentityExists(patientProfile.patientDID, patientProfile.phoneNumber);
        // If the profile is missing this identifier, update it
        if (!patientProfile.phoneNumber && !identifier.includes('@')) {
          await storage.updatePatientProfileIdentifiers(patientProfile.patientDID, { phoneNumber: identifier });
        }
        if (!patientProfile.email && identifier.includes('@')) {
          await storage.updatePatientProfileIdentifiers(patientProfile.patientDID, { email: identifier });
        }
        // Re-fetch updated profile
        patientProfile = await storage.getPatientProfileByDID(patientProfile.patientDID);
        // Always sync latest phone number
        await syncIdentityPhoneNumber(patientProfile.patientDID, patientProfile.phoneNumber);
      } else {
        // First-time user: Generate DID and create profile
        const identity = await patientWeb3Service.createPatientIdentity(identifier);
        // Ensure identity exists for new profile
        await ensurePatientIdentityExists(identity.patientDID, identifier.includes('@') ? undefined : identifier);
        // Create basic profile (National ID will be added later)
        const newProfile = {
          patientDID: identity.patientDID,
          nationalId: `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Temporary unique ID
          phoneNumber: identifier.includes('@') ? "" : identifier, // Empty for email users
          email: identifier.includes('@') ? identifier : null,     // Email for email users
          fullName: "", // Will be set during profile completion
          isProfileComplete: false
        };
        console.log('[DEBUG] Creating patient profile:', newProfile);
        patientProfile = await storage.createPatientProfile(newProfile);
        // Patient profile created successfully
        // Send welcome message if it's an email-based account
        if (identifier.includes('@')) {
          try {
            await emailService.sendWelcomeEmail(identifier, identity.patientDID);
          } catch (emailError) {
            console.error('[EMAIL] Failed to send welcome email:', emailError);
            // Don't fail the whole request if email fails
          }
        } else {
          // Send welcome SMS for phone-based accounts
          try {
            await smsService.sendWelcomeSMS({
              to: identifier,
              patientDID: identity.patientDID
            });
          } catch (smsError) {
            console.error('[SMS] Failed to send welcome SMS:', smsError);
            // Don't fail the whole request if SMS fails
          }
        }
        // Re-fetch updated profile
        const latestProfile = await storage.getPatientProfileByDID(identity.patientDID);
        // Only sync phone number if it exists
        if (latestProfile.phoneNumber) {
          await syncIdentityPhoneNumber(identity.patientDID, latestProfile.phoneNumber);
        }
      }
      // Create session
      req.session.patientId = patientProfile.id;
      req.session.patientDID = patientProfile.patientDID;
      req.session.phoneNumber = patientProfile.phoneNumber;
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
      console.error('[VERIFY_OTP_ERROR] Full error:', error);
      console.error('[VERIFY_OTP_ERROR] Stack:', error.stack);
      return res.status(400).json({ error: `Failed to verify OTP: ${error.message}` });
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

      const { nationalId, fullName, email, phoneNumber } = z.object({
        nationalId: z.string().min(1, "National ID is required"),
        fullName: z.string().min(1, "Full name is required"),
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
      }).parse(req.body);

      // Get current patient profile to check if they used email for OTP
      const currentProfile = await storage.getPatientProfileByDID(req.session.patientDID);
      if (!currentProfile) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // If patient used email for OTP and doesn't have a phone number, require it
      if (currentProfile.email && !currentProfile.phoneNumber && !phoneNumber) {
        return res.status(400).json({ 
          error: "Phone number is required for email-based accounts to link your medical records",
          requiresPhoneNumber: true 
        });
      }

      // Validate phone number format if provided
      if (phoneNumber && !phoneNumber.match(/^\+\d{9,15}$/)) {
        return res.status(400).json({ 
          error: "Please enter a valid international phone number (e.g., +254712345678 for Kenya)" 
        });
      }

      // Check if National ID is already taken
      const existingProfile = await storage.getPatientProfileByNationalId(nationalId);
      if (existingProfile && existingProfile.patientDID !== req.session.patientDID) {
        return res.status(400).json({ error: "This National ID is already registered with another account" });
      }

      // Check if phone number is already taken (if provided)
      if (phoneNumber) {
        const existingPhoneProfile = await storage.getPatientProfileByPhone(phoneNumber);
        if (existingPhoneProfile && existingPhoneProfile.patientDID !== req.session.patientDID) {
          return res.status(400).json({ error: "This phone number is already registered with another account" });
        }
      }

      // Ensure identity exists before updating profile
      await ensurePatientIdentityExists(req.session.patientDID, phoneNumber);

      // Update patient profile with new info
      const updates: any = { nationalId, fullName, isProfileComplete: true };
      if (email) updates.email = email;
      if (phoneNumber) updates.phoneNumber = phoneNumber;
      const updatedProfile = await storage.updatePatientProfile(req.session.patientDID, updates);

      await auditService.logEvent({
        eventType: "PATIENT_PROFILE_COMPLETED",
        actorType: "PATIENT",
        actorId: req.session.patientDID,
        targetType: "PATIENT_PROFILE",
        targetId: req.session.patientDID,
        action: "UPDATE",
        outcome: "SUCCESS",
        metadata: { nationalId, fullName, email, phoneNumber, wasEmailBased: !!currentProfile.email },
        severity: "info",
      });

      // After updating profile, fetch latest and sync phone number
      const latestProfile = await storage.getPatientProfileByDID(req.session.patientDID);
      await syncIdentityPhoneNumber(req.session.patientDID, latestProfile.phoneNumber);

      res.json({
        success: true,
        patient: {
          id: updatedProfile.id,
          phoneNumber: updatedProfile.phoneNumber,
          email: updatedProfile.email,
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

      console.log("=== CONSENT DEBUG START ===");
      console.log("Patient profile:", patientProfile);
      if (process.env.NODE_ENV !== 'production') {
        const nidRed = patientProfile?.nationalId ? `${patientProfile.nationalId.slice(0,2)}***${patientProfile.nationalId.slice(-2)}` : 'unknown';
        console.log("Patient National ID:", nidRed);
      }

      // Get all consent records for this patient (traditional + web3)
      let allConsentRecords: any[] = [];
      try {
        if (patientProfile.nationalId) {
          allConsentRecords = await storage.getAllConsentRecordsByPatientId(patientProfile.nationalId);
          console.log("All consent records found:", allConsentRecords.length);
        }
      } catch (error) {
        console.log("No consent records found:", error);
        allConsentRecords = [];
      }

      // Attach hospital info to every consent
      const attachHospitalInfo = async (consent: any) => {
        // Use accessedBy (traditional) or requesterId (web3)
        const userId = consent.accessedBy || consent.requesterId;
        let hospital = null;
        if (userId) {
          hospital = await storage.getUser(Number(userId));
        }
        return {
          ...consent,
          hospitalName: hospital?.hospitalName || "Unknown Hospital",
          hospitalType: hospital?.hospitalType || "Unknown",
        };
      };

      const traditionalConsents = await Promise.all(
        allConsentRecords.filter(c => c.consentType !== 'web3').map(attachHospitalInfo)
      );
      const web3Consents = await Promise.all(
        allConsentRecords.filter(c => c.consentType === 'web3').map(attachHospitalInfo)
      );

      // Get pending consent requests for this patient
      let pendingRequests = [];
      try {
        if (patientProfile.nationalId) {
          console.log("Searching for pending requests with National ID:", patientProfile.nationalId);
          pendingRequests = await storage.getPendingConsentRequests(patientProfile.nationalId);
          console.log("Pending consent requests found:", pendingRequests.length);
          console.log("Pending requests details:", pendingRequests);
        }
      } catch (error) {
        console.log("No pending consent requests found:", error);
        pendingRequests = [];
      }

      console.log("=== CONSENT DEBUG END ===");

      res.json({
        success: true,
        traditionalConsents: traditionalConsents.map(consent => ({
          ...consent,
          type: 'traditional'
        })),
        web3Consents: web3Consents.map(consent => ({
          ...consent,
          type: 'web3'
        })),
        pendingRequests: pendingRequests,
        totalConsents: traditionalConsents.length + web3Consents.length,
        totalPendingRequests: pendingRequests.length,
      });

    } catch (error: any) {
      console.error("Error fetching patient consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  /**
   * Get pending consent requests for patient
   * GET /api/patient/pending-requests
   */
  app.get("/api/patient/pending-requests", async (req, res) => {
    try {
      if (!req.session.patientDID) {
        return res.status(401).json({ error: "Authentication required. Please log in to view pending requests." });
      }

      const patientProfile = await storage.getPatientProfileByDID(req.session.patientDID);
      if (!patientProfile) {
        return res.status(401).json({ error: "Invalid session. Please log in again." });
      }

      // Get pending consent requests for this patient
      let pendingRequests: any[] = [];
      try {
        if (patientProfile.nationalId) {
          pendingRequests = await storage.getPendingConsentRequests(patientProfile.nationalId);
        }
      } catch (error) {
        console.log("No pending consent requests found:", error);
        pendingRequests = [];
      }

      res.json({
        success: true,
        pendingRequests: pendingRequests,
        totalPendingRequests: pendingRequests.length,
      });

    } catch (error: any) {
      console.error("Error fetching pending requests:", error);
      res.status(500).json({ error: "Failed to fetch pending requests. Please try again later." });
    }
  });

  /**
   * Approve or deny a consent request
   * POST /api/patient/respond-to-consent
   */
  app.post("/api/patient/respond-to-consent", async (req, res) => {
    try {
      if (!req.session.patientDID) {
        return res.status(401).json({ error: "Authentication required. Please log in to respond to consent requests." });
      }

      // Accept consentType ("web3" or "traditional") for correct consent creation
      const { requestId, action, reason, consentType } = z.object({
        requestId: z.number(),
        action: z.enum(['approve', 'deny']),
        reason: z.string().optional(),
        consentType: z.enum(['web3', 'traditional']).optional(),
      }).parse(req.body);

      // Get the consent request
      const consentRequest = await storage.getConsentRequestById(requestId);
      if (!consentRequest) {
        return res.status(404).json({ error: "Consent request not found. The request may have been deleted or already processed." });
      }

      // Always fetch the patient profile by national ID from the consent request
      const nationalId = String(consentRequest.patientId).trim();
      console.log('Consent approval: Looking up patient profile for nationalId:', nationalId);
      let patientProfile = await storage.getPatientProfileByNationalId(nationalId);
      if (!patientProfile || !patientProfile.patientDID) {
        // Try fallback by DID if available
        const fallbackDID = consentRequest.patientDID || consentRequest.did || consentRequest.DID;
        if (fallbackDID) {
          console.log('Primary lookup failed. Trying fallback by DID:', fallbackDID);
          patientProfile = await storage.getPatientProfileByDID(fallbackDID.trim());
        }
      }
      console.log('Fetched patient profile (after fallback):', patientProfile);
      if (!patientProfile || !patientProfile.patientDID) {
        console.error('No Web3 identity found for nationalId:', nationalId, 'Profile:', patientProfile);
        return res.status(404).json({ error: "No Web3 identity found for this patient. Please contact support." });
      }

      // Use the consentType from the pending request, not from the frontend
      const effectiveConsentType = consentRequest.consentType || 'traditional';

      // Verify this request belongs to the authenticated patient
      if (consentRequest.patientId !== patientProfile.nationalId) {
        return res.status(403).json({ error: "Unauthorized to respond to this request. This consent request does not belong to your account." });
      }

      if (action === 'approve') {
        // --- Web3 Consent ---
        if (effectiveConsentType === 'web3') {
          // Create a Web3 consent record with proper DID format for requesterId
          await storage.createWeb3Consent({
            patientDID: patientProfile.patientDID,
            requesterId: `did:medbridge:hospital:${consentRequest.accessedBy}`,
            consentType: 'read',
            consentGiven: true,
            // Grant time-limited access (12 hours)
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            revokedAt: null,
          });

          // Update consent request status
          await storage.updateConsentRequestStatus(patientProfile.nationalId, consentRequest.accessedBy, "granted");

          await auditService.logEvent({
            eventType: "WEB3_CONSENT_APPROVED",
            actorType: "PATIENT",
            actorId: req.session.patientDID,
            targetType: "HOSPITAL",
            targetId: consentRequest.accessedBy.toString(),
            action: "APPROVE_WEB3_CONSENT",
            outcome: "SUCCESS",
            metadata: {
              requestId,
              reason: reason || "Patient approved Web3 consent",
            },
            severity: "info",
          });

          // Log to consent audit trail
          await auditService.logConsentEvent({
            patientDID: patientProfile.patientDID,
            hospitalDID: `did:medbridge:hospital:${consentRequest.accessedBy}`,
            recordId: null, // Web3 may not have a single recordId
            consentAction: "GRANTED",
            verificationMethod: "web3",
            grantedBy: req.session.patientDID,
            expiresAt: null,
            metadata: { requestId, reason },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          }, req);

          return res.json({
            success: true,
            message: "Web3 consent approved successfully",
          });
        }
        // --- Traditional Consent (default) ---
        const records = await storage.getPatientRecordsByNationalId(patientProfile.nationalId);
        for (const record of records) {
          await storage.createConsentRecord({
            patientId: patientProfile.nationalId,
            accessedBy: consentRequest.accessedBy,
            recordId: record.id,
            consentGrantedBy: patientProfile.patientDID,
            hospital_id: Number(consentRequest.accessedBy),
            consent_type: 'traditional',
          });
        }
        await storage.updateConsentRequestStatus(patientProfile.nationalId, consentRequest.accessedBy, "granted");
        await auditService.logEvent({
          eventType: "CONSENT_APPROVED",
          actorType: "PATIENT",
          actorId: req.session.patientDID,
          targetType: "HOSPITAL",
          targetId: consentRequest.accessedBy.toString(),
          action: "APPROVE_CONSENT",
          outcome: "SUCCESS",
          metadata: {
            requestId,
            recordCount: records.length,
            reason: reason || "Patient approved consent",
          },
          severity: "info",
        });
        // Log to consent audit trail for each record
        for (const record of records) {
          await auditService.logConsentEvent({
            patientDID: patientProfile.patientDID,
            hospitalDID: `did:medbridge:hospital:${consentRequest.accessedBy}`,
            recordId: record.id,
            consentAction: "GRANTED",
            verificationMethod: "traditional",
            grantedBy: req.session.patientDID,
            expiresAt: null,
            metadata: { requestId, reason },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          }, req);
        }
        res.json({
          success: true,
          message: "Consent approved successfully",
          recordsGranted: records.length,
        });
      } else {
        // Deny consent
        await storage.updateConsentRequestStatus(patientProfile.nationalId, consentRequest.accessedBy, "denied");
        await auditService.logEvent({
          eventType: effectiveConsentType === 'web3' ? "WEB3_CONSENT_DENIED" : "CONSENT_DENIED",
          actorType: "PATIENT",
          actorId: req.session.patientDID,
          targetType: "HOSPITAL",
          targetId: consentRequest.accessedBy.toString(),
          action: effectiveConsentType === 'web3' ? "DENY_WEB3_CONSENT" : "DENY_CONSENT",
          outcome: "SUCCESS",
          metadata: {
            requestId,
            reason: reason || "Patient denied consent",
          },
          severity: "info",
        });
        res.json({
          success: true,
          message: "Consent denied",
        });
      }

    } catch (error: any) {
      console.error("Error responding to consent request:", error);
      res.status(500).json({ error: "Failed to respond to consent request. Please try again later." });
    }
  });

  /**
   * Patient login with full name and national ID (no OTP)
   * POST /api/patient/login
   */
  app.post("/api/patient/login", async (req, res) => {
    try {
      const { fullName, nationalId } = z.object({
        fullName: z.string().min(1, "Full name is required"),
        nationalId: z.string().min(1, "National ID is required"),
      }).parse(req.body);

      // Find patient profile by full name and national ID
      const patientProfile = await storage.getPatientProfileByNationalId(nationalId);
      if (!patientProfile || patientProfile.fullName.trim().toLowerCase() !== fullName.trim().toLowerCase()) {
        return res.status(401).json({ error: "Invalid name or National ID. Please check your credentials and try again." });
      }

      // Create session
      req.session.patientId = patientProfile.id;
      req.session.patientDID = patientProfile.patientDID;
      req.session.phoneNumber = patientProfile.phoneNumber;

      res.json({
        success: true,
        patient: {
          id: patientProfile.id,
          phoneNumber: patientProfile.phoneNumber,
          email: patientProfile.email,
          patientDID: patientProfile.patientDID,
          nationalId: patientProfile.nationalId,
          fullName: patientProfile.fullName,
          isProfileComplete: patientProfile.isProfileComplete,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: `Login failed: ${error.message}` });
    }
  });

  /**
   * Debug endpoint: Sync phone number to patient identity
   * POST /api/patient/debug/sync-phone
   */
  app.post("/api/patient/debug/sync-phone", async (req, res) => {
    try {
      const { patientDID, phoneNumber } = z.object({
        patientDID: z.string(),
        phoneNumber: z.string(),
      }).parse(req.body);

      console.log('[DEBUG] Manually syncing phone number', phoneNumber, 'to DID:', patientDID);
      
      // Update patient identity with phone number
      await storage.updatePatientIdentityPhoneNumber(patientDID, phoneNumber);
      
      // Also update patient profile if needed
      await storage.updatePatientProfileIdentifiers(patientDID, { phoneNumber });
      
      console.log('[DEBUG] Phone number sync completed successfully');
      
      res.json({
        success: true,
        message: "Phone number synced successfully",
        patientDID,
        phoneNumber,
      });
    } catch (error: any) {
      console.error('[DEBUG] Phone sync error:', error);
      res.status(400).json({ error: error.message });
    }
  });
}