import { auditService } from "./audit-service";
import { storage } from "./storage";
import { emailService } from "./email-service";
import { smsService } from "./sms-service";

/**
 * Emergency Consent Service
 * Handles consent in emergency cases when patient is unconscious or unreachable
 * Addresses fallback consent authority with dual-auth protocol
 */
export class EmergencyConsentService {
  private static instance: EmergencyConsentService;

  static getInstance(): EmergencyConsentService {
    if (!EmergencyConsentService.instance) {
      EmergencyConsentService.instance = new EmergencyConsentService();
    }
    return EmergencyConsentService.instance;
  }

  /**
   * Grant emergency consent when patient cannot provide consent
   * Requires dual authorization from medical staff
   */
  async grantEmergencyConsent(request: EmergencyConsentRequest): Promise<EmergencyConsentResult> {
    try {
      // Validate emergency conditions
      this.validateEmergencyConditions(request);

      // Verify dual authorization, passing the requesting user's ID
      await this.verifyDualAuthorization(request.primaryPhysician, request.secondaryAuthorizer, request.requestingUserId, request.requestingUserIsAdmin || false);

      // Check if next-of-kin is available and authorized
      const nextOfKinConsent = await this.checkNextOfKinConsent(request.patientId, request.nextOfKin);

      // Create emergency consent record
      const emergencyConsent = await this.createEmergencyConsentRecord(request, nextOfKinConsent);

      // Issue temporary access credential
      const temporaryCredential = await this.issueTemporaryCredential(request, emergencyConsent);

      // Comprehensive audit logging
      await auditService.logEvent({
        eventType: "EMERGENCY_CONSENT_GRANTED",
        actorType: "MEDICAL_STAFF",
        actorId: request.primaryPhysician.id,
        targetType: "PATIENT",
        targetId: request.patientId,
        action: "EMERGENCY_CONSENT",
        outcome: "SUCCESS",
        metadata: {
          emergencyType: request.emergencyType,
          primaryPhysician: request.primaryPhysician,
          secondaryAuthorizer: request.secondaryAuthorizer,
          nextOfKinInvolved: !!request.nextOfKin,
          hospitalId: request.hospitalId,
          justification: request.medicalJustification,
        },
        severity: "warning", // Emergency consent is sensitive
      });

      return {
        success: true,
        consentId: emergencyConsent.id,
        temporaryCredential,
        expiresAt: emergencyConsent.expiresAt,
        limitations: emergencyConsent.limitations,
        auditTrail: emergencyConsent.auditTrail,
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "EMERGENCY_CONSENT_FAILURE",
        severity: "high",
        actorId: request.primaryPhysician?.id || "unknown",
        targetResource: `patient:${request.patientId}`,
        details: {
          error: error.message,
          emergencyType: request.emergencyType,
          hospitalId: request.hospitalId,
        },
      });

      return {
        success: false,
        error: error.message,
        auditTrail: `Emergency consent denied: ${error.message}`,
      };
    }
  }

  /**
   * Validate that emergency conditions are met
   */
  private validateEmergencyConditions(request: EmergencyConsentRequest): void {
    // Check if it's a valid emergency type
    const validEmergencyTypes = [
      'LIFE_THREATENING',
      'UNCONSCIOUS_PATIENT',
      'CRITICAL_CARE',
      'SURGERY_REQUIRED',
      'MENTAL_HEALTH_CRISIS'
    ];

    if (!validEmergencyTypes.includes(request.emergencyType)) {
      throw new Error('Invalid emergency type for consent override');
    }

    // Verify medical justification is provided
    if (!request.medicalJustification || request.medicalJustification.length < 50) {
      throw new Error('Detailed medical justification required for emergency consent');
    }

    // Check that patient contact was attempted
    if (!request.patientContactAttempted) {
      throw new Error('Patient contact must be attempted before emergency consent');
    }

    // Verify timeframe is reasonable
    const maxEmergencyDuration = 24 * 60 * 60 * 1000; // 24 hours
    if (request.requestedDurationMs > maxEmergencyDuration) {
      throw new Error('Emergency consent duration cannot exceed 24 hours');
    }
  }

  /**
   * Verify dual authorization from medical staff
   */
  private async verifyDualAuthorization(
    primaryPhysician: AuthorizedPersonnel,
    secondaryAuthorizer: AuthorizedPersonnel,
    requestingUserId: string,
    requestingUserIsAdmin: boolean = false
  ): Promise<void> {
    // Check that the primary physician listed in the request is the authenticated user making the request
    if (primaryPhysician.id !== requestingUserId) {
      throw new Error('Primary physician ID in the request must match the ID of the authenticated user submitting the request.');
    }

    // Ensure two different people for primary and secondary authorization
    if (primaryPhysician.id === secondaryAuthorizer.id) {
      throw new Error('Emergency consent requires authorization from two different medical personnel (primary and secondary cannot be the same).');
    }

    // Verify both are qualified for emergency consent
    const qualifiedRoles = ['PHYSICIAN', 'SURGEON', 'EMERGENCY_DOCTOR', 'CHIEF_RESIDENT'];
    
    if (!qualifiedRoles.includes(primaryPhysician.role)) {
      throw new Error('Primary physician not qualified for emergency consent authorization');
    }

    if (!qualifiedRoles.includes(secondaryAuthorizer.role)) {
      throw new Error('Secondary authorizer not qualified for emergency consent authorization');
    }

    // For admins, we're more lenient - they can authorize even if not in staff list
    // For regular staff, verify they are on duty
    const primaryOnDuty = requestingUserIsAdmin || await this.verifyStaffOnDuty(primaryPhysician.id);
    const secondaryOnDuty = await this.verifyStaffOnDuty(secondaryAuthorizer.id);

    if (!primaryOnDuty || !secondaryOnDuty) {
      throw new Error('Both authorizers must be on duty and authenticated, or the primary authorizer must be a system administrator');
    }
  }

  /**
   * Check if next-of-kin is available and can provide consent
   */
  private async checkNextOfKinConsent(
    patientId: string,
    nextOfKin?: NextOfKinInfo
  ): Promise<NextOfKinConsentResult> {
    if (!nextOfKin) {
      return {
        available: false,
        reason: 'No next-of-kin information provided',
      };
    }

    try {
      // In production, verify next-of-kin relationship from patient records
      const isAuthorized = await this.verifyNextOfKinRelationship(patientId, nextOfKin);
      
      if (!isAuthorized) {
        return {
          available: false,
          reason: 'Next-of-kin relationship could not be verified',
        };
      }

      // Attempt to contact next-of-kin for consent
      const contactResult = await this.contactNextOfKin(nextOfKin);
      
      return {
        available: true,
        consentGiven: contactResult.consentGiven,
        contactMethod: contactResult.method,
        timestamp: new Date().toISOString(),
        verificationCode: contactResult.verificationCode,
      };

    } catch (error: any) {
      return {
        available: false,
        reason: `Failed to contact next-of-kin: ${error.message}`,
      };
    }
  }

  /**
   * Create emergency consent record in database
   */
  private async createEmergencyConsentRecord(
    request: EmergencyConsentRequest,
    nextOfKinConsent: NextOfKinConsentResult
  ): Promise<EmergencyConsentRecord> {
    const recordId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + request.requestedDurationMs);

    const emergencyConsent = await storage.createEmergencyConsentRecord({
      id: recordId,
      patientId: request.patientId,
      hospitalId: request.hospitalId,
      emergencyType: request.emergencyType,
      medicalJustification: request.medicalJustification,
      expiresAt: expiresAt,
      primaryPhysicianDetails: {
        id: request.primaryPhysician.id,
        name: request.primaryPhysician.name,
        role: request.primaryPhysician.role,
        licenseNumber: request.primaryPhysician.licenseNumber,
        department: request.primaryPhysician.department,
      },
      secondaryAuthorizerDetails: {
        id: request.secondaryAuthorizer.id,
        name: request.secondaryAuthorizer.name,
        role: request.secondaryAuthorizer.role,
        licenseNumber: request.secondaryAuthorizer.licenseNumber,
        department: request.secondaryAuthorizer.department,
      },
      nextOfKinConsentDetails: request.nextOfKin ? {
        name: request.nextOfKin.name,
        relationship: request.nextOfKin.relationship,
        phoneNumber: request.nextOfKin.phoneNumber,
        email: request.nextOfKin.email,
        consentGiven: nextOfKinConsent.consentGiven || false,
        contactMethod: nextOfKinConsent.contactMethod,
        timestamp: nextOfKinConsent.timestamp,
        verificationCode: nextOfKinConsent.verificationCode,
      } : null,
      limitations: this.determineAccessLimitations(request.emergencyType),
      auditTrail: `Emergency consent granted by ${request.primaryPhysician.name} and ${request.secondaryAuthorizer.name} at ${new Date().toISOString()}`,
    });

    return {
      id: recordId,
      patientId: request.patientId,
      emergencyType: request.emergencyType,
      grantedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      primaryPhysician: request.primaryPhysician,
      secondaryAuthorizer: request.secondaryAuthorizer,
      nextOfKinConsent: nextOfKinConsent,
      medicalJustification: request.medicalJustification,
      limitations: this.determineAccessLimitations(request.emergencyType),
      hospitalId: request.hospitalId,
      auditTrail: emergencyConsent.auditTrail || '',
    };
  }

  /**
   * Issue temporary access credential for emergency consent
   */
  private async issueTemporaryCredential(
    request: EmergencyConsentRequest,
    emergencyConsentRecord: EmergencyConsentRecord // The record from createEmergencyConsentRecord method
  ): Promise<string> {
    // This is the object that will be base64 encoded for the temporary credential string
    const credentialPayload = {
      id: `temp_${emergencyConsentRecord.id}`,
      type: 'EmergencyAccessCredential',
      issuer: 'MediBridge_Emergency_System', // System issues this
      subject: request.hospitalId, // Hospital receiving access
      issuedAt: new Date().toISOString(),
      expiresAt: emergencyConsentRecord.expiresAt,
      grantedToPersonnel: [request.primaryPhysician.id, request.secondaryAuthorizer.id],
      patientId: request.patientId,
      accessLevel: this.determineAccessLevel(request.emergencyType),
      limitations: emergencyConsentRecord.limitations,
      emergencyConsentRecordId: emergencyConsentRecord.id, // Link back to the persisted record
    };

    const credentialString = Buffer.from(JSON.stringify(credentialPayload)).toString('base64');

    // Optionally, update the persisted emergencyConsentRecord with these credential details
    // This would require an update method in storage.ts and modification to emergencyConsentRecords schema
    // For now, this detail is part of the returned EmergencyConsentResult.
    // e.g., await storage.updateEmergencyConsentRecord(emergencyConsentRecord.id, { temporaryCredentialDetails: credentialString });

    return credentialString;
  }

  /**
   * Determine access limitations based on emergency type
   */
  private determineAccessLimitations(emergencyType: string): string[] {
    const limitations: string[] = [];

    switch (emergencyType) {
      case 'LIFE_THREATENING':
        limitations.push('Access limited to critical care records');
        limitations.push('Automatic expiration in 6 hours unless renewed');
        break;
      case 'UNCONSCIOUS_PATIENT':
        limitations.push('Access limited to recent medical history');
        limitations.push('Revokes automatically when patient regains consciousness');
        break;
      case 'SURGERY_REQUIRED':
        limitations.push('Access limited to surgical history and allergies');
        limitations.push('Expires after surgical procedure completion');
        break;
      case 'MENTAL_HEALTH_CRISIS':
        limitations.push('Access limited to psychiatric and medication records');
        limitations.push('Requires patient consent renewal within 12 hours');
        break;
      default:
        limitations.push('General emergency access with 24-hour expiration');
    }

    limitations.push('All access logged and subject to post-emergency review');
    limitations.push('Cannot grant further access to third parties');

    return limitations;
  }

  /**
   * Determine access level for emergency type
   */
  private determineAccessLevel(emergencyType: string): string {
    switch (emergencyType) {
      case 'LIFE_THREATENING':
        return 'CRITICAL_CARE_RECORDS';
      case 'UNCONSCIOUS_PATIENT':
        return 'RECENT_MEDICAL_HISTORY';
      case 'SURGERY_REQUIRED':
        return 'SURGICAL_RELEVANT_RECORDS';
      case 'MENTAL_HEALTH_CRISIS':
        return 'PSYCHIATRIC_RECORDS';
      default:
        return 'EMERGENCY_RELEVANT_RECORDS';
    }
  }

  /**
   * Verify staff member is on duty and authenticated
   * Production implementation: Check against hospital staff database
   */
  private async verifyStaffOnDuty(staffId: string): Promise<boolean> {
    try {
      // In production, this would query the hospital's staff database
      // For now, implement a basic validation that ensures staffId is valid format
      if (!staffId || staffId.length < 3) {
        return false;
      }
      
      // Check if staff exists in our system (basic validation)
      const staffExists = await this.checkStaffExists(staffId);
      return staffExists;
    } catch (error) {
      console.error(`[EmergencyConsentService] Staff verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Verify next-of-kin relationship from patient records
   * Production implementation: Check against patient emergency contact records
   */
  private async verifyNextOfKinRelationship(
    patientId: string,
    nextOfKin: NextOfKinInfo
  ): Promise<boolean> {
    try {
      // In production, this would query patient records for emergency contacts
      // For now, implement basic validation
      if (!nextOfKin.name || !nextOfKin.phoneNumber || !nextOfKin.relationship) {
        return false;
      }
      
      // Check if this next-of-kin is registered for this patient
      const isRegistered = await this.checkNextOfKinRegistered(patientId, nextOfKin);
      return isRegistered;
    } catch (error) {
      console.error(`[EmergencyConsentService] Next-of-kin verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if staff member exists in the system
   */
  private async checkStaffExists(staffId: string): Promise<boolean> {
    try {
      // REAL PRODUCTION: Query the hospital_staff table using storage service
      const staff = await storage.getHospitalStaffByStaffId(staffId);
      return staff !== undefined && staff.isActive && staff.isOnDuty;
    } catch (error) {
      console.error(`[EmergencyConsentService] Staff check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if next-of-kin is registered for the patient
   */
  private async checkNextOfKinRegistered(
    patientId: string, 
    nextOfKin: NextOfKinInfo
  ): Promise<boolean> {
    try {
      // REAL PRODUCTION: Query the patient_emergency_contacts table using storage service
      const contacts = await storage.getVerifiedPatientEmergencyContacts(patientId);
      return contacts.some(contact => contact.phoneNumber === nextOfKin.phoneNumber);
    } catch (error) {
      console.error(`[EmergencyConsentService] Next-of-kin check failed: ${error}`);
      return false;
    }
  }

  /**
   * Contact next-of-kin for consent
   */
  private async contactNextOfKin(nextOfKin: NextOfKinInfo): Promise<ContactResult> {
    try {
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Try email first if available
      if (nextOfKin.email) {
        try {
          await emailService.sendEmergencyConsentEmail({
            to: nextOfKin.email,
            nextOfKinName: nextOfKin.name,
            patientRelationship: nextOfKin.relationship,
            verificationCode,
            emergencyType: 'Medical Emergency',
            hospitalName: 'MediBridge Hospital',
            contactPhone: nextOfKin.phoneNumber,
          });
          
          await auditService.logEvent({
            eventType: "NEXT_OF_KIN_CONTACTED",
            actorType: "SYSTEM",
            actorId: "emergency_consent_service",
            targetType: "NEXT_OF_KIN",
            targetId: nextOfKin.email,
            action: "CONTACT",
            outcome: "SUCCESS",
            metadata: {
              contactMethod: "email",
              verificationCode,
              nextOfKinName: nextOfKin.name,
            },
            severity: "info",
          });
          
          return {
            consentGiven: false, // Will be updated when they respond
            method: 'email',
            verificationCode,
          };
        } catch (emailError) {
          console.warn(`[EmergencyConsentService] Email contact failed: ${emailError}`);
        }
      }
      
      // Fallback to SMS using Twilio
      await smsService.sendEmergencyConsentSMS({
        to: nextOfKin.phoneNumber,
        nextOfKinName: nextOfKin.name,
        patientRelationship: nextOfKin.relationship,
        verificationCode,
        emergencyType: 'Medical Emergency',
        hospitalName: 'MediBridge Hospital',
      });
      
      await auditService.logEvent({
        eventType: "NEXT_OF_KIN_CONTACTED",
        actorType: "SYSTEM",
        actorId: "emergency_consent_service",
        targetType: "NEXT_OF_KIN",
        targetId: nextOfKin.phoneNumber,
        action: "CONTACT",
        outcome: "SUCCESS",
        metadata: {
          contactMethod: "sms",
          verificationCode,
          nextOfKinName: nextOfKin.name,
        },
        severity: "info",
      });
      
      return {
        consentGiven: false, // Will be updated when they respond
        method: 'sms',
        verificationCode,
      };
      
    } catch (error: any) {
      console.error(`[EmergencyConsentService] Failed to contact next-of-kin: ${error.message}`);
      
      await auditService.logSecurityViolation({
        violationType: "NEXT_OF_KIN_CONTACT_FAILURE",
        severity: "medium",
        details: {
          error: error.message,
          nextOfKinName: nextOfKin.name,
          contactMethod: nextOfKin.email ? 'email' : 'sms',
        },
      });
      
    return {
        consentGiven: false,
        method: 'failed',
      verificationCode: 'N/A',
    };
    }
  }

  /**
   * Check if user can authorize emergency consent (admin or on-duty staff)
   */
  private async canAuthorizeEmergency(userId: string, isAdmin: boolean = false): Promise<boolean> {
    // Admins can always authorize emergency consent
    if (isAdmin) {
      return true;
    }
    
    // Check if user is on-duty staff
    return await this.checkStaffExists(userId);
  }
}

interface EmergencyConsentRequest {
  patientId: string;
  hospitalId: string;
  emergencyType: 'LIFE_THREATENING' | 'UNCONSCIOUS_PATIENT' | 'CRITICAL_CARE' | 'SURGERY_REQUIRED' | 'MENTAL_HEALTH_CRISIS';
  medicalJustification: string;
  primaryPhysician: AuthorizedPersonnel;
  secondaryAuthorizer: AuthorizedPersonnel;
  nextOfKin?: NextOfKinInfo;
  patientContactAttempted: boolean;
  requestedDurationMs: number;
  requestingUserId: string; // Added to link request to authenticated user
  requestingUserIsAdmin?: boolean; // Added to handle admin authorization
}

interface AuthorizedPersonnel {
  id: string;
  name: string;
  role: 'PHYSICIAN' | 'SURGEON' | 'EMERGENCY_DOCTOR' | 'CHIEF_RESIDENT';
  licenseNumber: string;
  department: string;
}

interface NextOfKinInfo {
  name: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
}

interface NextOfKinConsentResult {
  available: boolean;
  consentGiven?: boolean;
  contactMethod?: string;
  timestamp?: string;
  verificationCode?: string;
  reason?: string;
}

interface ContactResult {
  consentGiven: boolean;
  method: string;
  verificationCode: string;
}

interface EmergencyConsentRecord {
  id: string;
  patientId: string;
  emergencyType: string;
  grantedAt: string;
  expiresAt: string;
  primaryPhysician: AuthorizedPersonnel;
  secondaryAuthorizer: AuthorizedPersonnel;
  nextOfKinConsent: NextOfKinConsentResult;
  medicalJustification: string;
  limitations: string[];
  hospitalId: string;
  auditTrail: string;
}

interface EmergencyConsentResult {
  success: boolean;
  consentId?: string;
  temporaryCredential?: string;
  expiresAt?: string;
  limitations?: string[];
  error?: string;
  auditTrail: string;
}

export const emergencyConsentService = EmergencyConsentService.getInstance();