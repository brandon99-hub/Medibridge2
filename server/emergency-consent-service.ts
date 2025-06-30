import { auditService } from "./audit-service";
import { storage } from "./storage";

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
      await this.verifyDualAuthorization(request.primaryPhysician, request.secondaryAuthorizer, request.requestingUserId);

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
    requestingUserId: string
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

    // Verify both are currently on duty and authenticated
    // In production, check against hospital staff database
    const primaryOnDuty = await this.verifyStaffOnDuty(primaryPhysician.id);
    const secondaryOnDuty = await this.verifyStaffOnDuty(secondaryAuthorizer.id);

    if (!primaryOnDuty || !secondaryOnDuty) {
      throw new Error('Both authorizers must be on duty and authenticated');
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
    const expiresAt = new Date(Date.now() + request.requestedDurationMs);
    
    const limitations = this.determineAccessLimitations(request.emergencyType);
    
    const consentRecord = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: request.patientId,
      emergencyType: request.emergencyType,
      grantedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      primaryPhysician: request.primaryPhysician,
      secondaryAuthorizer: request.secondaryAuthorizer,
      nextOfKinConsent,
      medicalJustification: request.medicalJustification,
      limitations,
      hospitalId: request.hospitalId,
      auditTrail: `Emergency consent granted due to ${request.emergencyType}`,
    };

    // In production, store in database
    const recordToStore = {
      id: consentRecord.id,
      patientId: consentRecord.patientId,
      hospitalId: consentRecord.hospitalId,
      emergencyType: consentRecord.emergencyType,
      medicalJustification: consentRecord.medicalJustification,
      grantedAt: new Date(consentRecord.grantedAt),
      expiresAt: new Date(consentRecord.expiresAt),
      primaryPhysicianDetails: consentRecord.primaryPhysician, // Stored as JSONB
      secondaryAuthorizerDetails: consentRecord.secondaryAuthorizer, // Stored as JSONB
      nextOfKinConsentDetails: consentRecord.nextOfKinConsent, // Stored as JSONB
      limitations: consentRecord.limitations, // Stored as JSONB
      // temporaryCredentialDetails will be updated after issuing the credential
      auditTrail: consentRecord.auditTrail,
    };

    const storedDbRecord = await storage.createEmergencyConsentRecord(recordToStore);

    // Return the service-level record structure, which might differ slightly from DB schema
    // or could be mapped from storedDbRecord if needed. For now, using original consentRecord.
    return consentRecord;
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
   */
  private async verifyStaffOnDuty(staffId: string): Promise<boolean> {
    // In production, check against hospital staff scheduling system
    return true; // Simplified for demo
  }

  /**
   * Verify next-of-kin relationship from patient records
   */
  private async verifyNextOfKinRelationship(
    patientId: string,
    nextOfKin: NextOfKinInfo
  ): Promise<boolean> {
    // In production, check against patient emergency contact records
    return true; // Simplified for demo
  }

  /**
   * Contact next-of-kin for consent
   */
  private async contactNextOfKin(nextOfKin: NextOfKinInfo): Promise<ContactResult> {
    // In production, send SMS/call to next-of-kin
    // Placeholder behavior:
    console.warn(`[EmergencyConsentService] Placeholder: Attempted to contact next-of-kin ${nextOfKin.name} at ${nextOfKin.phoneNumber}. Actual contact not implemented.`);
    return {
      consentGiven: false, // Default to false as contact is not actually made
      method: 'Placeholder - Not Attempted',
      verificationCode: 'N/A',
      // reason: "Automated contact placeholder - actual contact not implemented or failed." // This would go into NextOfKinConsentResult
    };
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