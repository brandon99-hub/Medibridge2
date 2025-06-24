import { storage } from "./storage";
import { auditService } from "./audit-service";

/**
 * Patient Lookup Service
 * Bridges the gap between patient phone numbers and DIDs for hospital searches
 * Provides multiple search methods while maintaining privacy
 */
export class PatientLookupService {
  private static instance: PatientLookupService;

  static getInstance(): PatientLookupService {
    if (!PatientLookupService.instance) {
      PatientLookupService.instance = new PatientLookupService();
    }
    return PatientLookupService.instance;
  }

  /**
   * Primary search method: Hospital searches by patient phone number
   * Most common real-world scenario - patient provides phone to hospital
   */
  async searchByPhoneNumber(
    phoneNumber: string,
    searchingHospitalId: string,
    searchingStaffId: string
  ): Promise<PatientSearchResult> {
    try {
      // Normalize phone number format
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Find patient identity by phone number
      const patientIdentity = await storage.getPatientIdentityByPhone(normalizedPhone);
      
      if (!patientIdentity) {
        await auditService.logEvent({
          eventType: "PATIENT_SEARCH_NO_RESULTS",
          actorType: "HOSPITAL",
          actorId: searchingHospitalId,
          targetType: "PATIENT_PHONE",
          targetId: normalizedPhone,
          action: "SEARCH",
          outcome: "NOT_FOUND",
          metadata: { 
            searchMethod: "phone",
            staffId: searchingStaffId 
          },
          severity: "info",
        });

        return {
          found: false,
          message: "No patient found with this phone number",
          searchMethod: "phone",
        };
      }

      // Get patient records count and summary
      const recordsSummary = await storage.getPatientRecordsSummary(patientIdentity.patientDID);

      await auditService.logEvent({
        eventType: "PATIENT_SEARCH_SUCCESS",
        actorType: "HOSPITAL",
        actorId: searchingHospitalId,
        targetType: "PATIENT",
        targetId: patientIdentity.patientDID,
        action: "SEARCH",
        outcome: "SUCCESS",
        metadata: {
          searchMethod: "phone",
          recordsFound: recordsSummary.totalRecords,
          staffId: searchingStaffId,
        },
        severity: "info",
      });

      return {
        found: true,
        patientDID: patientIdentity.patientDID,
        patientInfo: {
          name: patientIdentity.name,
          phoneNumber: normalizedPhone,
          registrationDate: patientIdentity.createdAt,
        },
        recordsSummary,
        searchMethod: "phone",
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "PATIENT_SEARCH_ERROR",
        severity: "medium",
        actorId: searchingHospitalId,
        targetResource: `phone:${phoneNumber}`,
        details: { error: error.message, staffId: searchingStaffId },
      });

      throw new Error(`Patient search failed: ${error.message}`);
    }
  }

  /**
   * Secondary search method: Search by national ID
   * Common in countries with national health ID systems
   */
  async searchByNationalId(
    nationalId: string,
    searchingHospitalId: string,
    searchingStaffId: string
  ): Promise<PatientSearchResult> {
    try {
      const patientRecord = await storage.getPatientByNationalId(nationalId);
      
      if (!patientRecord) {
        return {
          found: false,
          message: "No patient found with this national ID",
          searchMethod: "nationalId",
        };
      }

      // Try to find associated DID if patient has Web3 identity
      const patientIdentity = await storage.getPatientIdentityByPhone(patientRecord.phoneNumber);

      const result = {
        found: true,
        patientInfo: {
          name: patientRecord.patientName,
          nationalId: patientRecord.nationalId,
          phoneNumber: patientRecord.phoneNumber,
        },
        recordsSummary: await storage.getTraditionalRecordsSummary(nationalId),
        searchMethod: "nationalId" as const,
        patientDID: patientIdentity?.patientDID,
      };

      await auditService.logEvent({
        eventType: "PATIENT_SEARCH_SUCCESS",
        actorType: "HOSPITAL",
        actorId: searchingHospitalId,
        targetType: "PATIENT",
        targetId: nationalId,
        action: "SEARCH",
        outcome: "SUCCESS",
        metadata: {
          searchMethod: "nationalId",
          hasWeb3Identity: !!patientIdentity,
          staffId: searchingStaffId,
        },
        severity: "info",
      });

      return result;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "PATIENT_SEARCH_ERROR",
        severity: "medium",
        actorId: searchingHospitalId,
        targetResource: `nationalId:${nationalId}`,
        details: { error: error.message, staffId: searchingStaffId },
      });

      throw error;
    }
  }

  /**
   * Generate patient lookup QR code
   * Patient can show QR to hospital staff for instant lookup
   */
  async generatePatientLookupQR(patientDID: string): Promise<string> {
    try {
      const lookupData = {
        type: "MEDBRIDGE_PATIENT_LOOKUP",
        patientDID,
        generated: new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        version: "1.0",
      };

      // In production, encrypt this data
      const qrData = Buffer.from(JSON.stringify(lookupData)).toString('base64');

      await auditService.logEvent({
        eventType: "PATIENT_QR_GENERATED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "QR_CODE",
        targetId: `lookup_${Date.now()}`,
        action: "GENERATE",
        outcome: "SUCCESS",
        metadata: { expiresIn: "24h" },
        severity: "info",
      });

      return qrData;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "QR_GENERATION_FAILURE",
        severity: "medium",
        details: { error: error.message, patientDID },
      });
      throw error;
    }
  }

  /**
   * Search by QR code scan
   * Hospital scans patient-provided QR code
   */
  async searchByQRCode(
    qrData: string,
    searchingHospitalId: string,
    searchingStaffId: string
  ): Promise<PatientSearchResult> {
    try {
      const lookupData = JSON.parse(Buffer.from(qrData, 'base64').toString());

      // Validate QR code
      if (lookupData.type !== "MEDBRIDGE_PATIENT_LOOKUP") {
        throw new Error("Invalid QR code type");
      }

      if (new Date() > new Date(lookupData.expires)) {
        throw new Error("QR code has expired");
      }

      const patientDID = lookupData.patientDID;
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);

      if (!patientIdentity) {
        throw new Error("Patient identity not found");
      }

      const recordsSummary = await storage.getPatientRecordsSummary(patientDID);

      await auditService.logEvent({
        eventType: "PATIENT_SEARCH_SUCCESS",
        actorType: "HOSPITAL",
        actorId: searchingHospitalId,
        targetType: "PATIENT",
        targetId: patientDID,
        action: "SEARCH",
        outcome: "SUCCESS",
        metadata: {
          searchMethod: "qr",
          staffId: searchingStaffId,
        },
        severity: "info",
      });

      return {
        found: true,
        patientDID,
        patientInfo: {
          name: patientIdentity.name,
          phoneNumber: patientIdentity.phoneNumber,
          registrationDate: patientIdentity.createdAt,
        },
        recordsSummary,
        searchMethod: "qr",
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "QR_SEARCH_FAILURE",
        severity: "medium",
        actorId: searchingHospitalId,
        targetResource: "qr_code",
        details: { error: error.message, staffId: searchingStaffId },
      });

      return {
        found: false,
        message: `QR code search failed: ${error.message}`,
        searchMethod: "qr",
      };
    }
  }

  /**
   * Patient-initiated DID sharing
   * Patient sends their DID directly to hospital
   */
  async sharePatientDID(
    patientDID: string,
    targetHospitalId: string,
    consentMessage: string
  ): Promise<void> {
    try {
      // Create temporary sharing token
      const sharingToken = {
        patientDID,
        targetHospital: targetHospitalId,
        message: consentMessage,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      };

      // In production, store this in a secure temporary storage
      await storage.createTemporaryDIDShare(sharingToken);

      await auditService.logEvent({
        eventType: "PATIENT_DID_SHARED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "HOSPITAL",
        targetId: targetHospitalId,
        action: "SHARE",
        outcome: "SUCCESS",
        metadata: { message: consentMessage, expiresIn: "2h" },
        severity: "info",
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "DID_SHARING_FAILURE",
        severity: "medium",
        details: { error: error.message, patientDID, targetHospitalId },
      });
      throw error;
    }
  }

  /**
   * Normalize phone number to standard format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Handle Kenyan numbers
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    }
    if (cleaned.length === 9) {
      return `+254${cleaned}`;
    }

    // Handle US numbers
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    // Return with + prefix
    return cleaned.startsWith('+') ? phoneNumber : `+${cleaned}`;
  }
}

interface PatientSearchResult {
  found: boolean;
  patientDID?: string;
  patientInfo?: {
    name: string;
    phoneNumber?: string;
    nationalId?: string;
    registrationDate?: string;
  };
  recordsSummary?: {
    totalRecords: number;
    dateRange: { earliest: string; latest: string };
    visitTypes: { [type: string]: number };
    departments: string[];
  };
  searchMethod: 'phone' | 'nationalId' | 'qr' | 'shared';
  message?: string;
}

export const patientLookupService = PatientLookupService.getInstance();