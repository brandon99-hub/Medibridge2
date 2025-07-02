import { storage } from "./storage";
import { auditService } from "./audit-service";
import { redisService } from "./redis-service";

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

      // Check cache first
      const cacheKey = `patient_lookup:phone:${normalizedPhone}`;
      const cachedResult = await redisService.getCachedQueryResult(cacheKey);
      if (cachedResult) {
        console.log(`[REDIS] Cache hit for phone lookup: ${normalizedPhone}`);
        return cachedResult;
      }

      // Find patient identity by phone number
      const patientIdentity = await storage.getPatientIdentityByPhone(normalizedPhone);
      
      if (!patientIdentity) {
        const result: PatientSearchResult = {
          found: false,
          patientDID: undefined,
          message: "No patient found with this phone number",
          searchMethod: "phone",
        };

        // Cache negative results for a shorter time
        await redisService.cacheQueryResult(cacheKey, result, 300); // 5 minutes

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

        return result;
      }

      // Get patient records count and summary
      const recordsSummary = await storage.getPatientRecordsSummary(patientIdentity.did);

      await auditService.logEvent({
        eventType: "PATIENT_SEARCH_SUCCESS",
        actorType: "HOSPITAL",
        actorId: searchingHospitalId,
        targetType: "PATIENT",
        targetId: patientIdentity.did,
        action: "SEARCH",
        outcome: "SUCCESS",
        metadata: {
          searchMethod: "phone",
          recordsFound: recordsSummary.totalRecords,
          staffId: searchingStaffId,
        },
        severity: "info",
      });

      // Try to get patient profile for name
      let patientProfile = null;
      try {
        patientProfile = await storage.getPatientProfileByDID(patientIdentity.did);
      } catch {}

      const result: PatientSearchResult = {
        found: true,
        patientDID: patientIdentity.did,
        patientInfo: {
          name: patientProfile?.fullName || "",
          phoneNumber: normalizedPhone,
          nationalId: patientProfile?.nationalId || undefined,
          registrationDate: patientIdentity.createdAt ? new Date(patientIdentity.createdAt).toISOString() : undefined,
        },
        recordsSummary,
        searchMethod: "phone",
      };

      // Cache successful results
      await redisService.cacheQueryResult(cacheKey, result, 900); // 15 minutes

      return result;

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
      // Check cache first
      const cacheKey = `patient_lookup:nationalId:${nationalId}`;
      const cachedResult = await redisService.getCachedQueryResult(cacheKey);
      if (cachedResult) {
        console.log(`[REDIS] Cache hit for national ID lookup: ${nationalId}`);
        return cachedResult;
      }

      // Use getPatientProfileByNationalId to get the profile
      const patientProfile = await storage.getPatientProfileByNationalId(nationalId);
      if (!patientProfile) {
        const result: PatientSearchResult = {
          found: false,
          message: "No patient found with this national ID",
          searchMethod: "nationalId",
        };

        // Cache negative results for a shorter time
        await redisService.cacheQueryResult(cacheKey, result, 300); // 5 minutes

        return result;
      }

      // Try to find associated DID if patient has Web3 identity
      const patientIdentity = await storage.getPatientIdentityByPhone(patientProfile.phoneNumber);
      const result = {
        found: true,
        patientInfo: {
          name: patientProfile.fullName,
          nationalId: patientProfile.nationalId,
          phoneNumber: patientProfile.phoneNumber,
        },
        recordsSummary: await storage.getTraditionalRecordsSummary(nationalId),
        searchMethod: "nationalId" as const,
        patientDID: patientIdentity?.did,
      };

      // Cache successful results
      await redisService.cacheQueryResult(cacheKey, result, 900); // 15 minutes

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
   * Generate patient lookup QR code containing phone number
   * Patient can show QR to hospital staff for instant lookup
   */
  async generatePatientLookupQR(phoneNumber: string): Promise<string> {
    try {
      const lookupData = {
        type: "MEDBRIDGE_PATIENT_LOOKUP",
        phoneNumber: phoneNumber,
        generated: new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        version: "1.0",
      };

      // In production, encrypt this data
      const qrData = Buffer.from(JSON.stringify(lookupData)).toString('base64');

      await auditService.logEvent({
        eventType: "PATIENT_QR_GENERATED",
        actorType: "PATIENT",
        actorId: phoneNumber,
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
        details: { error: error.message, phoneNumber },
      });
      throw error;
    }
  }

  /**
   * Search by QR code scan
   * Hospital scans patient-provided QR code containing phone number
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

      // QR code contains phone number for lookup (not DID)
      const phoneNumber = lookupData.phoneNumber;
      if (!phoneNumber) {
        throw new Error("QR code does not contain phone number");
      }

      // Use phone number search method
      return await this.searchByPhoneNumber(phoneNumber, searchingHospitalId, searchingStaffId);

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
  searchMethod: 'phone' | 'nationalId' | 'qr';
  message?: string;
}

export const patientLookupService = PatientLookupService.getInstance();