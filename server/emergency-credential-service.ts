import { storage } from "./storage";
import { auditService } from "./audit-service";

interface EmergencyCredential {
  id: string;
  type: string;
  issuer: string;
  subject: string;
  issuedAt: string;
  expiresAt: string;
  grantedToPersonnel: string[];
  patientId: string;
  accessLevel: string;
  limitations: string[];
  emergencyConsentRecordId: string;
}

export class EmergencyCredentialService {
  private static instance: EmergencyCredentialService;

  public static getInstance(): EmergencyCredentialService {
    if (!EmergencyCredentialService.instance) {
      EmergencyCredentialService.instance = new EmergencyCredentialService();
    }
    return EmergencyCredentialService.instance;
  }

  /**
   * Validate emergency temporary credential
   */
  async validateCredential(credentialString: string): Promise<{
    isValid: boolean;
    credential?: EmergencyCredential;
    error?: string;
  }> {
    try {
      // Decode base64 credential
      const decodedString = Buffer.from(credentialString, 'base64').toString('utf-8');
      const credential: EmergencyCredential = JSON.parse(decodedString);

      // Validate credential structure
      if (!this.validateCredentialStructure(credential)) {
        return {
          isValid: false,
          error: "Invalid credential structure"
        };
      }

      // Check if credential has expired
      if (new Date() > new Date(credential.expiresAt)) {
        return {
          isValid: false,
          error: "Emergency credential has expired"
        };
      }

      // Verify emergency consent record exists and is not revoked
      const emergencyRecord = await storage.getEmergencyConsentRecord(credential.emergencyConsentRecordId);
      if (!emergencyRecord) {
        return {
          isValid: false,
          error: "Emergency consent record not found"
        };
      }

      if (emergencyRecord.revokedAt) {
        return {
          isValid: false,
          error: "Emergency consent has been revoked"
        };
      }

      // Log credential validation
      await auditService.logEvent({
        eventType: "EMERGENCY_CREDENTIAL_VALIDATED",
        actorType: "SYSTEM",
        actorId: "emergency_credential_service",
        targetType: "CREDENTIAL",
        targetId: credential.id,
        action: "VALIDATE",
        outcome: "SUCCESS",
        metadata: {
          patientId: credential.patientId,
          accessLevel: credential.accessLevel,
          expiresAt: credential.expiresAt,
          emergencyConsentRecordId: credential.emergencyConsentRecordId,
        },
        severity: "info",
      });

      return {
        isValid: true,
        credential
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "EMERGENCY_CREDENTIAL_VALIDATION_FAILURE",
        severity: "high",
        details: {
          error: error.message,
          credentialString: credentialString.substring(0, 50) + "...", // Log partial for debugging
        },
      });

      return {
        isValid: false,
        error: "Failed to validate emergency credential"
      };
    }
  }

  /**
   * Validate credential structure
   */
  private validateCredentialStructure(credential: any): credential is EmergencyCredential {
    return (
      credential &&
      typeof credential.id === 'string' &&
      credential.type === 'EmergencyAccessCredential' &&
      typeof credential.issuer === 'string' &&
      typeof credential.subject === 'string' &&
      typeof credential.issuedAt === 'string' &&
      typeof credential.expiresAt === 'string' &&
      Array.isArray(credential.grantedToPersonnel) &&
      typeof credential.patientId === 'string' &&
      typeof credential.accessLevel === 'string' &&
      Array.isArray(credential.limitations) &&
      typeof credential.emergencyConsentRecordId === 'string'
    );
  }

  /**
   * Get patient records using emergency credential
   */
  async getPatientRecordsWithEmergencyAccess(
    credential: EmergencyCredential,
    requestingUserId: string
  ): Promise<{
    success: boolean;
    records?: any[];
    patientInfo?: any;
    error?: string;
  }> {
    try {
      // Get traditional records
      const traditionalRecords = await storage.getPatientRecordsByNationalId(credential.patientId);
      
      // Get patient profile to check for Web3 records
      const patientProfile = await storage.getPatientProfileByNationalId(credential.patientId);
      
      let web3Records: any[] = [];
      if (patientProfile?.patientDID) {
        // Get Web3 records if patient has Web3 profile
        web3Records = await storage.getPatientRecordsByDID(patientProfile.patientDID);
      }

      // Combine and format records
      const allRecords = [
        ...traditionalRecords.map(record => ({
          ...record,
          recordType: 'traditional',
          source: 'traditional'
        })),
        ...web3Records.map(record => ({
          ...record,
          recordType: 'web3',
          source: 'web3'
        }))
      ];

      // Filter records based on emergency access level
      const filteredRecords = this.filterRecordsByAccessLevel(allRecords, credential.accessLevel);

      // Log emergency record access
      await auditService.logEvent({
        eventType: "EMERGENCY_RECORD_ACCESS",
        actorType: "MEDICAL_STAFF",
        actorId: requestingUserId,
        targetType: "PATIENT",
        targetId: credential.patientId,
        action: "ACCESS_RECORDS",
        outcome: "SUCCESS",
        metadata: {
          emergencyConsentRecordId: credential.emergencyConsentRecordId,
          recordCount: filteredRecords.length,
          accessLevel: credential.accessLevel,
          traditionalRecords: traditionalRecords.length,
          web3Records: web3Records.length,
          patientHasWeb3Profile: !!patientProfile?.patientDID,
        },
        severity: "warning", // Emergency access is sensitive
      });

      return {
        success: true,
        records: filteredRecords,
        patientInfo: {
          patientId: credential.patientId,
          patientName: traditionalRecords[0]?.patientName || 'Unknown',
          patientDID: patientProfile?.patientDID,
          hasWeb3Profile: !!patientProfile?.patientDID,
          emergencyType: credential.accessLevel,
          accessExpiresAt: credential.expiresAt,
        }
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "EMERGENCY_RECORD_ACCESS_FAILURE",
        severity: "high",
        actorId: requestingUserId,
        targetResource: `patient:${credential.patientId}`,
        details: {
          error: error.message,
          emergencyConsentRecordId: credential.emergencyConsentRecordId,
        },
      });

      return {
        success: false,
        error: "Failed to retrieve patient records with emergency access"
      };
    }
  }

  /**
   * Filter records based on emergency access level
   */
  private filterRecordsByAccessLevel(records: any[], accessLevel: string): any[] {
    switch (accessLevel) {
      case 'CRITICAL_CARE_RECORDS':
        // Return all records for critical care
        return records;
      case 'RECENT_MEDICAL_HISTORY':
        // Return records from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return records.filter(record => new Date(record.visitDate) >= thirtyDaysAgo);
      case 'SURGICAL_RELEVANT_RECORDS':
        // Return surgical and allergy records
        return records.filter(record => 
          record.visitType?.toLowerCase().includes('surgery') ||
          record.diagnosis?.toLowerCase().includes('allergy') ||
          record.department?.toLowerCase().includes('surgery')
        );
      case 'PSYCHIATRIC_RECORDS':
        // Return psychiatric and medication records
        return records.filter(record => 
          record.department?.toLowerCase().includes('psych') ||
          record.visitType?.toLowerCase().includes('psych') ||
          record.prescription // Include records with prescriptions
        );
      default:
        // Return all records for general emergency access
        return records;
    }
  }
}

export const emergencyCredentialService = EmergencyCredentialService.getInstance(); 