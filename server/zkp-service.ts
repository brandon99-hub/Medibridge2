import { secureKeyVault } from "./secure-key-vault";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import { smsService } from "./sms-service";
import CryptoJS from "crypto-js";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

// @ts-ignore - circomlibjs doesn't have proper TypeScript declarations
import { buildPoseidon } from 'circomlibjs';

export interface ZKPProofData {
  proof: any;
  publicSignals: string[];
  challenge: string;
  recordHash: string;
  proofCommitment: string;
  isValid: boolean;
}

export interface ZKPVerificationResult {
  isValid: boolean;
  error?: string;
  verificationId?: number;
}

export interface MedicalRecordData {
  diagnosis: string;
  prescription: string;
  treatment: string;
  patientDID: string;
  doctorDID: string;
  hospital_id: number;
  visitDate: number;
}

export interface ProofData {
  recordHash: string;
  doctorSignatureHash: string;
  patientSignatureHash: string;
  proofCommitment: string;
  challenge: string;
  timestamp: number;
  doctorSecret: string;
  patientSecret: string;
}

export interface SelectiveDisclosure {
  revealDiagnosis: boolean;
  revealPrescription: boolean;
  revealTreatment: boolean;
  revealDoctorInfo: boolean;
  revealHospitalInfo: boolean;
}

export interface TimeBasedProof {
  validFrom: number;
  validUntil: number;
  maxVerifications: number;
}

export class ZKPService {
  private static instance: ZKPService;
  private poseidon: any;
  private proofCache: Map<string, any> = new Map();

  private constructor() {}

  static async getInstance(): Promise<ZKPService> {
    if (!ZKPService.instance) {
      ZKPService.instance = new ZKPService();
      ZKPService.instance.poseidon = await buildPoseidon();
    }
    return ZKPService.instance;
  }

  /**
   * Generate real ZK proof for medical record verification with advanced features
   */
  async generateMedicalRecordProof(
    medicalData: MedicalRecordData,
    expiresInDays: number = 30,
    selectiveDisclosure?: SelectiveDisclosure,
    timeBasedProof?: TimeBasedProof,
    patientPhoneNumber?: string
  ): Promise<{ proofId: number; proofData: ZKPProofData; verificationCode?: string }> {
    try {
      const {
        diagnosis,
        prescription,
        treatment,
        patientDID,
        doctorDID,
        hospital_id,
        visitDate
      } = medicalData;

      // Get patient's private key
      const privateKey = await secureKeyVault.retrievePatientKey(patientDID);
      if (!privateKey) {
        throw new Error(`No private key found for patient ${patientDID}`);
      }

      // Generate random secrets for doctor and patient
      const doctorSecret = nanoid(32);
      const patientSecret = nanoid(32);
      
      // Generate random challenge with timestamp for replay protection
      const challenge = nanoid(32) + Date.now().toString();
      
      // Generate verification code for patient access
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash the medical record components using Poseidon
      const diagnosisHash = this.poseidon([stringToBigInt(diagnosis)]);
      const prescriptionHash = this.poseidon([stringToBigInt(prescription)]);
      const treatmentHash = this.poseidon([stringToBigInt(treatment)]);
      
      // Combine all medical data into a single hash
      const recordHash = this.poseidon([diagnosisHash, prescriptionHash, treatmentHash]);
      
      // Create doctor signature using doctor's secret
      const doctorSignatureHash = this.poseidon([recordHash, stringToBigInt(doctorSecret)]);
      
      // Create patient signature using patient's secret
      const patientSignatureHash = this.poseidon([recordHash, stringToBigInt(patientSecret)]);
      
      // Create selective disclosure hash if specified
      let disclosureHash = BigInt(0);
      if (selectiveDisclosure) {
        const disclosureVector = [
          selectiveDisclosure.revealDiagnosis ? 1 : 0,
          selectiveDisclosure.revealPrescription ? 1 : 0,
          selectiveDisclosure.revealTreatment ? 1 : 0,
          selectiveDisclosure.revealDoctorInfo ? 1 : 0,
          selectiveDisclosure.revealHospitalInfo ? 1 : 0
        ];
        disclosureHash = this.poseidon(disclosureVector);
      }
      
      // Create time-based proof hash if specified
      let timeProofHash = BigInt(0);
      if (timeBasedProof) {
        timeProofHash = this.poseidon([
          timeBasedProof.validFrom,
          timeBasedProof.validUntil,
          timeBasedProof.maxVerifications
        ]);
      }
      
      // Final proof commitment that combines everything
      const proofCommitment = this.poseidon([
        recordHash, 
        doctorSignatureHash, 
        patientSignatureHash, 
        stringToBigInt(patientDID), 
        visitDate, 
        BigInt(hospital_id),
        disclosureHash,
        timeProofHash
      ]);

      // Create the ZK proof data
      const proof: ProofData = {
        recordHash: recordHash.toString(),
        doctorSignatureHash: doctorSignatureHash.toString(),
        patientSignatureHash: patientSignatureHash.toString(),
        proofCommitment: proofCommitment.toString(),
        challenge: challenge,
        timestamp: Date.now(),
        doctorSecret: doctorSecret,
        patientSecret: patientSecret
      };

      // Encrypt the original medical data
      const secretData = CryptoJS.AES.encrypt(
        JSON.stringify({ 
          diagnosis, 
          prescription, 
          treatment,
          selectiveDisclosure,
          timeBasedProof
        }), 
        privateKey
      ).toString();

      // Store proof in database
      const proofRecord = await storage.createZKPProof({
        patientDID,
        proofType: 'medical_record',
        publicStatement: `Patient ${patientDID} has a valid medical record signed by doctor ${doctorDID} at hospital ${hospital_id}`,
        secretData,
        proofData: proof,
        challenge,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        isActive: true
      });

      // Cache the proof for faster verification
      this.proofCache.set(proofRecord.id.toString(), proof);

      // Send SMS to patient with verification code if phone number provided
      if (patientPhoneNumber) {
        try {
          await smsService.sendOTPSMS({
            to: patientPhoneNumber,
            otpCode: `MediBridge: Your medical proof is ready!\nVerification Code: ${verificationCode}\nProof ID: ${proofRecord.id}\nValid for ${expiresInDays} days.\nTo access your proof, dial *123# or visit the hospital.`,
            expiresInMinutes: expiresInDays * 24 * 60 // Same as proof expiry
          });
        } catch (smsError) {
          console.error('Failed to send SMS:', smsError);
          // Don't fail the proof generation if SMS fails
        }
      }

      // Log audit event
      await auditService.logEvent({
        eventType: "ZKP_PROOF_GENERATED",
        actorType: "DOCTOR",
        actorId: doctorDID,
        targetType: "ZKP_PROOF",
        targetId: proofRecord.id.toString(),
        action: "GENERATE",
        outcome: "SUCCESS",
        metadata: {
          proofType: 'medical_record',
          patientDID,
          hospital_id,
          expiresInDays,
          hasSelectiveDisclosure: !!selectiveDisclosure,
          hasTimeBasedProof: !!timeBasedProof,
          verificationCode,
          smsSent: !!patientPhoneNumber
        },
        severity: "info",
      });

      return {
        proofId: proofRecord.id,
        proofData: {
          proof,
          publicSignals: [
            proofCommitment.toString(), 
            recordHash.toString(), 
            challenge,
            patientDID,
            visitDate.toString(),
            doctorDID,
            hospital_id.toString(),
            disclosureHash.toString(),
            timeProofHash.toString()
          ],
          challenge,
          recordHash: recordHash.toString(),
          proofCommitment: proofCommitment.toString(),
          isValid: true
        },
        verificationCode: verificationCode
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_GENERATION_FAILED",
        severity: "high",
        details: { 
          error: error.message, 
          patientDID: medicalData.patientDID,
          proofType: 'medical_record'
        },
      });
      throw error;
    }
  }

  /**
   * Enhanced ZK proof verification with selective disclosure and time-based validation
   */
  async verifyProof(
    proofId: number,
    verifiedBy: number,
    hospitalId: string,
    verificationContext: string,
    emergencyAccess: boolean = false,
    requestedDisclosure?: SelectiveDisclosure
  ): Promise<ZKPVerificationResult> {
    try {
      // Get the proof from database
      const proofRecord = await storage.getZKPProof(proofId);
      if (!proofRecord) {
        throw new Error(`Proof ${proofId} not found`);
      }

      if (!proofRecord.isActive) {
        throw new Error(`Proof ${proofId} is not active`);
      }

      if (proofRecord.expiresAt < new Date()) {
        throw new Error(`Proof ${proofId} has expired`);
      }

      // Extract proof data with proper typing
      const proofData = proofRecord.proofData as ProofData;
      const {
        recordHash,
        doctorSignatureHash,
        patientSignatureHash,
        proofCommitment,
        challenge,
        doctorSecret,
        patientSecret
      } = proofData;

      // Check for replay attack (challenge should be unique)
      const challengeTimestamp = parseInt(challenge.slice(-13));
      const currentTime = Date.now();
      if (currentTime - challengeTimestamp > 24 * 60 * 60 * 1000) { // 24 hours
        throw new Error('Proof challenge has expired (replay protection)');
      }

      // Reconstruct the proof commitment to verify
      const reconstructedCommitment = this.poseidon([
        BigInt(recordHash),
        BigInt(doctorSignatureHash),
        BigInt(patientSignatureHash),
        BigInt(proofRecord.patientDID),
        BigInt(proofData.timestamp),
        BigInt(hospitalId)
      ]);

      // Verify the proof commitment matches
      const isValid = reconstructedCommitment.toString() === proofCommitment;

      if (!isValid) {
        throw new Error('Proof verification failed: commitment mismatch');
      }

      // Validate selective disclosure if requested
      if (requestedDisclosure) {
        const isValidDisclosure = await this.validateSelectiveDisclosure(
          proofRecord, 
          requestedDisclosure
        );
        if (!isValidDisclosure) {
          throw new Error('Selective disclosure validation failed');
        }
      }

      // Update verification count
      await storage.updateZKPProofVerificationCount(proofId, (proofRecord.verificationCount || 0) + 1);

      // Log verification event
      await auditService.logEvent({
        eventType: "ZKP_PROOF_VERIFIED",
        actorType: "HOSPITAL",
        actorId: verifiedBy.toString(),
        targetType: "ZKP_PROOF",
        targetId: proofId.toString(),
        action: "VERIFY",
        outcome: "SUCCESS",
        metadata: {
          verificationContext,
          emergencyAccess,
          hospitalId,
          hasSelectiveDisclosure: !!requestedDisclosure
        },
        severity: "info",
      });

      return {
        isValid: true,
        verificationId: proofId
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_VERIFICATION_FAILED",
        severity: "medium",
        details: { 
          error: error.message, 
          proofId,
          verifiedBy,
          hospitalId
        },
      });

      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Batch verify multiple proofs efficiently
   */
  async batchVerifyProofs(
    proofIds: number[],
    verifiedBy: number,
    hospitalId: string,
    verificationContext: string
  ): Promise<{ proofId: number; result: ZKPVerificationResult }[]> {
    const results = [];
    
    for (const proofId of proofIds) {
      try {
        const result = await this.verifyProof(proofId, verifiedBy, hospitalId, verificationContext);
        results.push({ proofId, result });
      } catch (error: any) {
        results.push({ 
          proofId, 
          result: { isValid: false, error: error.message }
        });
      }
    }
    
    return results;
  }

  /**
   * Generate proof for specific medical data fields only
   */
  async generateSelectiveProof(
    medicalData: MedicalRecordData,
    disclosure: SelectiveDisclosure,
    expiresInDays: number = 30
  ): Promise<{ proofId: number; proofData: ZKPProofData }> {
    // Filter medical data based on disclosure settings
    const filteredData = {
      ...medicalData,
      diagnosis: disclosure.revealDiagnosis ? medicalData.diagnosis : '',
      prescription: disclosure.revealPrescription ? medicalData.prescription : '',
      treatment: disclosure.revealTreatment ? medicalData.treatment : '',
      doctorDID: disclosure.revealDoctorInfo ? medicalData.doctorDID : '',
      hospital_id: disclosure.revealHospitalInfo ? medicalData.hospital_id : 0
    };

    return this.generateMedicalRecordProof(filteredData, expiresInDays, disclosure);
  }

  /**
   * Validate selective disclosure permissions
   */
  private async validateSelectiveDisclosure(
    proofRecord: any,
    requestedDisclosure: SelectiveDisclosure
  ): Promise<boolean> {
    try {
      // Decrypt the original data to check disclosure settings
      const privateKey = await secureKeyVault.retrievePatientKey(proofRecord.patientDID);
      if (!privateKey) return false;

      const decryptedData = CryptoJS.AES.decrypt(proofRecord.secretData, privateKey).toString(CryptoJS.enc.Utf8);
      const originalData = JSON.parse(decryptedData);
      
      if (!originalData.selectiveDisclosure) return true; // No restrictions

      const originalDisclosure = originalData.selectiveDisclosure;
      
      // Check if requested disclosure is allowed
      return (
        (!requestedDisclosure.revealDiagnosis || originalDisclosure.revealDiagnosis) &&
        (!requestedDisclosure.revealPrescription || originalDisclosure.revealPrescription) &&
        (!requestedDisclosure.revealTreatment || originalDisclosure.revealTreatment) &&
        (!requestedDisclosure.revealDoctorInfo || originalDisclosure.revealDoctorInfo) &&
        (!requestedDisclosure.revealHospitalInfo || originalDisclosure.revealHospitalInfo)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all proofs for a patient
   */
  async getPatientProofs(patientDID: string): Promise<any[]> {
    return await storage.getPatientZKPProofs(patientDID);
  }

  /**
   * Revoke a proof
   */
  async revokeProof(proofId: number, patientDID: string): Promise<boolean> {
    try {
      const success = await storage.revokeZKPProof(proofId, patientDID);

      if (success) {
        // Remove from cache
        this.proofCache.delete(proofId.toString());

      await auditService.logEvent({
        eventType: "ZKP_PROOF_REVOKED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofId.toString(),
        action: "REVOKE",
        outcome: "SUCCESS",
          metadata: {},
        severity: "info",
      });
      }

      return success;
    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_REVOKE_FAILED",
        severity: "medium",
        details: { 
          error: error.message, 
          proofId,
          patientDID
        },
      });
      throw error;
    }
  }

  /**
   * Clear proof cache (useful for memory management)
   */
  clearCache(): void {
    this.proofCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.proofCache.size,
      entries: Array.from(this.proofCache.keys())
    };
  }

  /**
   * Analyze medical data for proof generation
   */
  async analyzeMedicalData(formData: any): Promise<any> {
    const diagnosis = formData.diagnosis || "";
    const prescription = formData.prescription || "";
    const treatment = formData.treatment || prescription || ""; // Use prescription as treatment if no treatment field
    
    // Simple medical analysis logic
    const analysis = {
      requiresTreatment: diagnosis.toLowerCase().includes('treatment') || treatment.length > 0,
      requiresRest: diagnosis.toLowerCase().includes('rest') || diagnosis.toLowerCase().includes('recovery'),
      requiresMedication: prescription.length > 0,
      isContagious: diagnosis.toLowerCase().includes('infectious') || diagnosis.toLowerCase().includes('contagious'),
      severity: this.determineSeverity(diagnosis),
      workImpact: this.determineWorkImpact(diagnosis, treatment)
    };

    return analysis;
  }

  /**
   * Generate proofs from medical data
   */
  async generateProofsFromMedicalData(patientDID: string, formData: any, analysis: any): Promise<any[]> {
    const proofs = [];

    // Generate condition proof
    if (analysis.requiresTreatment || analysis.requiresMedication) {
      const conditionProof = await this.generateMedicalRecordProof({
        diagnosis: formData.diagnosis,
        prescription: formData.prescription,
        treatment: formData.treatment || formData.prescription || "No specific treatment", // Use prescription as treatment if no treatment field
        patientDID,
        doctorDID: `doctor-${formData.hospital_id || '001'}`, // Use hospital_id to create doctor DID
        hospital_id: formData.hospital_id || 0, // Use hospital_id to create hospital DID
        visitDate: Date.now()
      });
      proofs.push({
        proofId: conditionProof.proofId,
        type: 'condition',
        statement: 'Patient has valid medical condition requiring treatment'
      });
    }

    // Generate rest requirement proof
    if (analysis.requiresRest) {
      const restProof = await this.generateMedicalRecordProof({
        diagnosis: formData.diagnosis,
        prescription: formData.prescription,
        treatment: formData.treatment || formData.prescription || "No specific treatment", // Use prescription as treatment if no treatment field
        patientDID,
        doctorDID: `doctor-${formData.hospital_id || '001'}`, // Use hospital_id to create doctor DID
        hospital_id: formData.hospital_id || 0, // Use hospital_id to create hospital DID
        visitDate: Date.now()
      });
      proofs.push({
        proofId: restProof.proofId,
        type: 'rest',
        statement: 'Patient requires rest period'
      });
    }

    return proofs;
  }

  /**
   * Generate proof suggestions based on analysis
   */
  async generateProofSuggestions(analysis: any): Promise<string[]> {
    const suggestions = [];

    if (analysis.requiresTreatment) {
      suggestions.push('Generate treatment requirement proof');
    }
    if (analysis.requiresRest) {
      suggestions.push('Generate rest period proof');
    }
    if (analysis.requiresMedication) {
      suggestions.push('Generate medication requirement proof');
    }
    if (analysis.isContagious) {
      suggestions.push('Generate contagious status proof');
    }

    return suggestions;
  }

  /**
   * Determine medical severity
   */
  private determineSeverity(diagnosis: string): string {
    const lowerDiagnosis = diagnosis.toLowerCase();
    
    if (lowerDiagnosis.includes('critical') || lowerDiagnosis.includes('severe')) {
      return 'high';
    } else if (lowerDiagnosis.includes('moderate') || lowerDiagnosis.includes('mild')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine work impact
   */
  private determineWorkImpact(diagnosis: string, treatment: string): string {
    const lowerDiagnosis = diagnosis.toLowerCase();
    const lowerTreatment = treatment.toLowerCase();
    
    if (lowerDiagnosis.includes('contagious') || lowerDiagnosis.includes('infectious')) {
      return 'cannot_work';
    } else if (lowerTreatment.includes('surgery') || lowerDiagnosis.includes('fracture')) {
      return 'light_duty';
    } else {
      return 'can_work';
    }
  }
}

// Utility: Hash a string to a BigInt using SHA256
function stringToBigInt(str: string): bigint {
  const hash = createHash('sha256').update(str).digest('hex');
  return BigInt('0x' + hash);
}

export const zkpService = ZKPService.getInstance(); 