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
      console.log('[DEBUG] Patient lookup by phone - normalized:', normalizedPhone);

      // Check cache first
      const cacheKey = `patient_lookup:phone:${normalizedPhone}`;
      const cachedResult = await redisService.getCachedQueryResult(cacheKey);
      if (cachedResult) {
        console.log(`[REDIS] Cache hit for phone lookup: ${normalizedPhone}`);
        return cachedResult;
      }

      // Find patient identity by phone number
      const patientIdentity = await storage.getPatientIdentityByPhone(normalizedPhone);
      console.log('[DEBUG] Patient lookup by phone:', normalizedPhone, 'Found identity:', patientIdentity ? patientIdentity.did : 'NOT FOUND');
      
      // If no identity found by phone, check patient profiles by phone number
      let patientProfile = null;
      if (!patientIdentity) {
        patientProfile = await storage.getPatientProfileByPhone(normalizedPhone);
        console.log('[DEBUG] Patient lookup by phone: Found profile by phone:', patientProfile ? patientProfile.patientDID : 'NOT FOUND');
        
        // CRITICAL FIX: If we found a profile but no identity, create/update the identity
        if (patientProfile && patientProfile.patientDID) {
          console.log('[DEBUG] Found profile but no identity, syncing phone number to identity');
          try {
            await storage.updatePatientIdentityPhoneNumber(patientProfile.patientDID, normalizedPhone);
            console.log('[DEBUG] Successfully synced phone number to patient identity');
          } catch (error) {
            console.error('[DEBUG] Failed to sync phone number to identity:', error);
          }
        }
      }
      
      if (!patientIdentity && !patientProfile) {
        // ENHANCED DEBUGGING: Check if patient exists with different phone formats
        console.log('[DEBUG] No patient found, checking alternative phone formats...');
        const alternativeFormats = this.generateAlternativePhoneFormats(normalizedPhone);
        
        for (const altFormat of alternativeFormats) {
          const altIdentity = await storage.getPatientIdentityByPhone(altFormat);
          const altProfile = await storage.getPatientProfileByPhone(altFormat);
          
          if (altIdentity || altProfile) {
            console.log('[DEBUG] Found patient with alternative phone format:', altFormat);
            // Use the found patient and sync the phone number
            const foundDID = altIdentity?.did || altProfile?.patientDID;
            if (foundDID) {
              await storage.updatePatientIdentityPhoneNumber(foundDID, normalizedPhone);
              patientProfile = altProfile || await storage.getPatientProfileByDID(foundDID);
              break;
            }
          }
        }
      }
      
      if (!patientIdentity && !patientProfile) {
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

      // Use the DID from either patientIdentity or patientProfile
      const patientDID = patientIdentity?.did || patientProfile?.patientDID;
      if (!patientDID) {
        throw new Error("No patient DID found");
      }

      console.log('[DEBUG] Using patientDID for records lookup:', patientDID);

      // Get patient records count and summary
      const recordsSummary = await storage.getPatientRecordsSummary(patientDID);
      console.log('[DEBUG] Records summary:', recordsSummary);

      await auditService.logEvent({
        eventType: "PATIENT_SEARCH_SUCCESS",
        actorType: "HOSPITAL",
        actorId: searchingHospitalId,
        targetType: "PATIENT",
        targetId: patientDID,
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
      let patientProfileResult = null;
      try {
        patientProfileResult = await storage.getPatientProfileByDID(patientDID);
      } catch {}

      const result: PatientSearchResult = {
        found: true,
        patientDID: patientDID,
        patientInfo: {
          name: patientProfileResult?.fullName || "",
          phoneNumber: normalizedPhone,
          nationalId: patientProfileResult?.nationalId || undefined,
          registrationDate: patientIdentity?.createdAt ? new Date(patientIdentity.createdAt).toISOString() : undefined,
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

  /**
   * Generate alternative phone number formats for better matching
   */
  private generateAlternativePhoneFormats(phoneNumber: string): string[] {
    const formats: string[] = [];
    
    // Remove + prefix
    if (phoneNumber.startsWith('+')) {
      formats.push(phoneNumber.substring(1));
    }
    
    // Add + prefix
    if (!phoneNumber.startsWith('+')) {
      formats.push(`+${phoneNumber}`);
    }
    
    // Handle Kenyan numbers specifically
    if (phoneNumber.startsWith('+254')) {
      // Try without country code
      formats.push(phoneNumber.substring(4));
      // Try with 0 prefix
      formats.push(`0${phoneNumber.substring(4)}`);
    }
    
    // Handle numbers starting with 254
    if (phoneNumber.startsWith('254')) {
      formats.push(`+${phoneNumber}`);
      formats.push(phoneNumber.substring(3));
      formats.push(`0${phoneNumber.substring(3)}`);
    }
    
    // Handle numbers starting with 0
    if (phoneNumber.startsWith('0')) {
      formats.push(`+254${phoneNumber.substring(1)}`);
      formats.push(`254${phoneNumber.substring(1)}`);
      formats.push(phoneNumber.substring(1));
    }
    
    return Array.from(new Set(formats)); // Remove duplicates
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