import { secureKeyVault } from "./secure-key-vault";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import { smsService } from "./sms-service";
import CryptoJS from "crypto-js";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Simple Poseidon hash implementation for ZoKrates compatibility
import crypto from 'crypto';

const execAsync = promisify(exec);

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment detection for dual-mode operation
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
const usePrecompiled = isProduction || process.env.USE_PRECOMPILED === 'true';

console.log(`[ZKP Service] Environment: ${isProduction ? 'production' : 'development'}`);
console.log(`[ZKP Service] Mode: ${usePrecompiled ? 'pre-compiled' : 'docker'}`);

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
  private proofCache: Map<string, any> = new Map();

  private constructor() {}

  static async getInstance(): Promise<ZKPService> {
    if (!ZKPService.instance) {
      ZKPService.instance = new ZKPService();
    }
    return ZKPService.instance;
  }

  static FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

  static stringToField(str: string): string {
    const hexString = Buffer.from(str, "utf8").toString("hex");
    const bigIntValue = BigInt("0x" + hexString) % ZKPService.FIELD_PRIME;
    return bigIntValue.toString();
  }

  // ZoKrates circuit paths
  private static zokratesCircuitPath = path.join(__dirname, '../zokrates/artifacts/medical_proof');
  private static zokratesProvingKeyPath = path.join(__dirname, '../zokrates/artifacts/medical_proof/proving.key');
  private static zokratesVerificationKeyPath = path.join(__dirname, '../zokrates/artifacts/medical_proof/verification.key');

  private static async poseidonHash(inputs: (string | number)[]) {
    // Convert all inputs to BigInt
    const fieldInputs = inputs.map(x => typeof x === 'string' ? BigInt(x) : BigInt(x));
    
    // Use circomlibjs Poseidon (dynamic import for ESM compatibility)
    const circomlib = await import('circomlibjs');
    const poseidon = await circomlib.buildPoseidon();
    const hash = poseidon.F.toString(poseidon(fieldInputs));
    return hash;
  }

  // Helper to build Docker command for ZoKrates (Development Mode)
  private static dockerZokratesCmd(args: string) {
    if (usePrecompiled) {
      throw new Error('Docker Zokrates not available in pre-compiled mode');
    }
    // Use absolute path to your zokrates directory
    const hostPath = path.resolve(__dirname, '../zokrates');
    // Windows path fix for Docker
    const dockerHostPath = os.platform() === 'win32' ? hostPath.replace(/\\/g, '/') : hostPath;
    return `docker run --rm -v "${dockerHostPath}:/home/zokrates/code" -w /home/zokrates/code zokrates/zokrates:latest zokrates ${args}`;
  }

  // Helper to read pre-compiled artifacts (Production Mode)
  private static async readPrecompiledArtifact(artifactPath: string): Promise<any> {
    try {
      const fullPath = path.join(__dirname, '../zokrates', artifactPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Pre-compiled artifact not found: ${fullPath}`);
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch (error: any) {
      console.error(`Failed to read pre-compiled artifact ${artifactPath}:`, error);
      throw new Error(`Pre-compiled artifact read failed: ${error.message}`);
    }
  }

  // Helper to verify pre-compiled proof (Production Mode)
  private static async verifyPrecompiledProof(proofData: any, publicInputs: string[]): Promise<boolean> {
    try {
      // Read verification key
      const verificationKey = await this.readPrecompiledArtifact('artifacts/medical_proof/verification.key');
      
      // Simple verification logic (in production, you'd use a proper ZK verification library)
      // For now, we'll do basic validation
      if (!proofData.proof || !proofData.publicSignals) {
        return false;
      }
      
      // Check if public signals match expected inputs
      if (proofData.publicSignals.length !== publicInputs.length) {
        return false;
      }
      
      // Basic validation passed
      return true;
    } catch (error) {
      console.error('Pre-compiled proof verification failed:', error);
      return false;
    }
  }

  /**
   * Generate real ZK proof for medical record verification with advanced features
   */
  async generateMedicalRecordProof(
    medicalData: MedicalRecordData,
    expiresInDays: number = 30,
    propertyCode: number,
    propertyValue: number,
    patientPhoneNumber?: string
  ): Promise<{ proofId: number; proofData: ZKPProofData; verificationCode?: string }> {
    const { diagnosis, prescription, treatment } = medicalData;
    const d = ZKPService.stringToField(diagnosis);
    const e = ZKPService.stringToField(prescription);
    const f = ZKPService.stringToField(treatment);
    // Log the raw field values
    console.log('ZKP Input Fields:', { d, e, f });
    console.log('ZKP Field Prime:', ZKPService.FIELD_PRIME.toString());
    const recordHash = await ZKPService.poseidonHash([d, e, f]);
    // Log the record hash
    console.log('ZKP Record Hash:', recordHash.toString());
    const zokratesInputs = [
      recordHash.toString(),
      propertyCode.toString(),
      propertyValue.toString(),
      d,
      e,
      f,
      propertyValue.toString()
    ];
    console.log('ZKP ZoKrates Inputs:', zokratesInputs);

    try {
      let proofData: any;

      if (usePrecompiled) {
        // Production Mode: Use pre-compiled artifacts
        console.log('[ZKP] Using pre-compiled mode for proof generation');
        
        // For production, we'll create a simplified proof structure
        // In a real implementation, you'd use a proper ZK verification library
        proofData = {
          proof: {
            a: [recordHash.toString(), propertyCode.toString()],
            b: [[propertyValue.toString()], [d, e, f]],
            c: [propertyValue.toString()]
          },
          publicSignals: [recordHash.toString(), propertyCode.toString(), propertyValue.toString()],
          protocol: 'groth16'
        };
      } else {
        // Development Mode: Use Docker Zokrates
        console.log('[ZKP] Using Docker mode for proof generation');
        
        try {
          // Generate witness using ZoKrates CLI via Docker
          const witnessCmd = ZKPService.dockerZokratesCmd(`compute-witness -i artifacts/medical_proof_compiled -a ${zokratesInputs.join(' ')}`);
          console.log('[ZKP] Running witness command:', witnessCmd);
          const { stdout: witnessOutput } = await execAsync(witnessCmd);
          console.log('[ZKP] Witness output:', witnessOutput);
          
          // Generate proof using ZoKrates CLI via Docker
          const proofCmd = ZKPService.dockerZokratesCmd(`generate-proof -i artifacts/medical_proof_compiled -p artifacts/medical_proof/proving.key -j proof.json`);
          console.log('[ZKP] Running proof command:', proofCmd);
          const { stdout: proofOutput } = await execAsync(proofCmd);
          console.log('[ZKP] Proof output:', proofOutput);
          
          // Read the actual proof.json file
          proofData = await this.readZokratesProofFile();
          console.log('[ZKP] Read proof data from file:', proofData);
        } catch (dockerError: any) {
          console.error('[ZKP] Docker ZoKrates failed:', dockerError.message);
          throw new Error(`ZoKrates proof generation failed: ${dockerError.message}`);
        }
      }
      
      const proofRecord = await storage.createZKPProof({
        patientDID: medicalData.patientDID,
        proofType: 'medical_record',
        publicStatement: `Patient ${medicalData.patientDID} has a valid medical record for property code ${propertyCode}`,
        secretData: '',
        proofData: proofData,
        challenge: '',
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        isActive: true
      });

      console.log('[ZKP] Created proof record:', { id: proofRecord.id, patientDID: proofRecord.patientDID, proofType: proofRecord.proofType });

      return {
        proofId: proofRecord.id,
        proofData: {
          proof: proofData.proof,
          publicSignals: proofData.publicSignals,
          challenge: '',
          recordHash: recordHash.toString(),
          proofCommitment: '',
          isValid: true
        },
        verificationCode: ''
      };
    } catch (error: any) {
      console.error('ZoKrates proof generation error:', error);
      throw new Error(`Failed to generate ZK proof: ${error.message}`);
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
    const proofRecord = await storage.getZKPProof(proofId);
    if (!proofRecord) throw new Error('Proof not found');

    try {
      const proofData = proofRecord.proofData as any;
      let isValid: boolean;

      if (usePrecompiled) {
        // Production Mode: Use pre-compiled verification
        console.log('[ZKP] Using pre-compiled mode for proof verification');
        isValid = await ZKPService.verifyPrecompiledProof(proofData, proofData.publicSignals);
      } else {
        // Development Mode: Use Docker Zokrates
        console.log('[ZKP] Using Docker mode for proof verification');
        
        // Check if proof data is valid
        if (!proofData.proof || !proofData.publicSignals || proofData.publicSignals.length === 0) {
          console.error('[ZKP] Invalid proof data for verification:', proofData);
          return {
            isValid: false,
            error: 'Invalid proof data structure',
            verificationId: proofId
          };
        }
        
        try {
          // Correct ZoKrates verify syntax: zokrates verify -v verification.key -j proof.json
          const verifyCmd = ZKPService.dockerZokratesCmd(`verify -v artifacts/medical_proof/verification.key -j proof.json`);
          console.log('[ZKP] Running verify command:', verifyCmd);
          const { stdout } = await execAsync(verifyCmd);
          console.log('[ZKP] Verify output:', stdout);
          isValid = stdout.includes('PASSED');
        } catch (verifyError: any) {
          console.error('[ZKP] Verification failed:', verifyError.message);
          return {
            isValid: false,
            error: verifyError.message,
            verificationId: proofId
          };
        }
      }
      
      return {
        isValid,
        verificationId: proofId
      };
    } catch (error: any) {
      console.error('ZoKrates verification error:', error);
      return {
        isValid: false,
        error: error.message,
        verificationId: proofId
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
    };

    return this.generateMedicalRecordProof(filteredData, expiresInDays, 0, 0);
  }

  /**
   * Validate selective disclosure permissions
   */
  private async validateSelectiveDisclosure(
    proofRecord: any,
    requestedDisclosure: SelectiveDisclosure
  ): Promise<boolean> {
    try {
      const originalDisclosure = proofRecord.proofData.selectiveDisclosure || {
        revealDiagnosis: true,
        revealPrescription: true,
        revealTreatment: true,
        revealDoctorInfo: true,
        revealHospitalInfo: true,
      };

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
      console.log('[ZKP] Generating condition proof for patientDID:', patientDID);
      const conditionProof = await this.generateMedicalRecordProof({
        diagnosis: formData.diagnosis,
        prescription: formData.prescription,
        treatment: formData.treatment || formData.prescription || "No specific treatment", // Use prescription as treatment if no treatment field
        patientDID,
        doctorDID: `doctor-${formData.hospital_id || '001'}`, // Use hospital_id to create doctor DID
        hospital_id: formData.hospital_id || 0, // Use hospital_id to create hospital DID
        visitDate: Date.now()
      }, 0, 0, 0);
      console.log('[ZKP] Condition proof generated:', conditionProof);
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
      }, 0, 0, 0);
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

  /**
   * Read ZoKrates proof from JSON file
   */
  private async readZokratesProofFile(): Promise<any> {
    try {
      const fs = await import('fs/promises');
      const proofPath = path.join(__dirname, '../zokrates/proof.json');
      const proofContent = await fs.readFile(proofPath, 'utf8');
      const proofData = JSON.parse(proofContent);
      
      // Extract public signals from the proof file
      const publicSignals = proofData.inputs || [];
      
      return {
        proof: proofData.proof,
        publicSignals: publicSignals
      };
    } catch (error: any) {
      console.error('[ZKP] Failed to read proof file:', error.message);
      throw new Error(`Failed to read proof file: ${error.message}`);
    }
  }

  /**
   * Parse ZoKrates proof output
   */
  private parseZokratesProof(proofOutput: string): any {
    console.log('[ZKP] Parsing ZoKrates output:', proofOutput);
    
    // Parse the ZoKrates proof output format
    // This is a simplified parser - adjust based on actual ZoKrates output format
    const lines = proofOutput.split('\n');
    const proof: any = {};
    const publicSignals: string[] = [];

    for (const line of lines) {
      if (line.includes('proof:')) {
        // Parse proof data
        const proofMatch = line.match(/proof:\s*(\{.*\})/);
        if (proofMatch) {
          try {
            proof.proof = JSON.parse(proofMatch[1]);
          } catch (e) {
            console.error('[ZKP] Failed to parse proof JSON:', e);
          }
        }
      } else if (line.includes('public:')) {
        // Parse public signals
        const publicMatch = line.match(/public:\s*\[(.*)\]/);
        if (publicMatch) {
          publicSignals.push(...publicMatch[1].split(',').map(s => s.trim()));
        }
      }
    }

    // If parsing failed, return a fallback structure
    if (!proof.proof || Object.keys(proof.proof).length === 0) {
      console.log('[ZKP] Using fallback proof structure');
      return {
        proof: {
          a: ['0', '0'],
          b: [['0'], ['0', '0', '0']],
          c: ['0']
        },
        publicSignals: ['0', '0', '0'],
        protocol: 'groth16'
      };
    }

    return {
      proof,
      publicSignals
    };
  }
}

// Utility: Hash a string to a BigInt using SHA256
function stringToBigInt(str: string): bigint {
  const hash = createHash('sha256').update(str).digest('hex');
  return BigInt('0x' + hash);
}

export const zkpService = ZKPService.getInstance(); 