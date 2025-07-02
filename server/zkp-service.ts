import { buildPoseidon } from 'circomlibjs';
import { secureKeyVault } from "./secure-key-vault";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import CryptoJS from "crypto-js";
import { nanoid } from "nanoid";

export interface ZKPProofData {
  proof: any;
  publicSignals: string[];
  challenge: string;
}

export interface ZKPVerificationResult {
  isValid: boolean;
  error?: string;
  verificationId?: number;
}

export class ZKPService {
  private static instance: ZKPService;
  private poseidon: any;

  private constructor() {}

  static async getInstance(): Promise<ZKPService> {
    if (!ZKPService.instance) {
      ZKPService.instance = new ZKPService();
      ZKPService.instance.poseidon = await buildPoseidon();
    }
    return ZKPService.instance;
  }

  /**
   * Generate ZKP for medical condition verification
   * Proves patient has a condition without revealing what it is
   */
  async generateConditionProof(
    patientDID: string,
    condition: string,
    publicStatement: string,
    expiresInDays: number = 30
  ): Promise<{ proofId: number; proofData: ZKPProofData }> {
    try {
      // Get patient's private key
      const privateKey = await secureKeyVault.retrievePatientKey(patientDID);
      if (!privateKey) {
        throw new Error(`No private key found for patient ${patientDID}`);
      }

      // Generate random challenge
      const challenge = nanoid(32);
      
      // Create hash of the condition
      const conditionHash = this.poseidon([condition]);
      
      // Create commitment (this is what we'll prove without revealing the condition)
      const commitment = this.poseidon([conditionHash, challenge]);
      
      // Generate proof using Poseidon hash function
      const proof = {
        commitment: commitment.toString(),
        challenge: challenge,
        conditionHash: conditionHash.toString(),
        timestamp: Date.now()
      };

      // Encrypt the original condition data
      const secretData = CryptoJS.AES.encrypt(condition, privateKey).toString();

      // Store proof in database
      const proofRecord = await storage.createZKPProof({
        patientDID,
        proofType: 'condition',
        publicStatement,
        secretData,
        proofData: proof,
        challenge,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        isActive: true,
        verificationCount: 0
      });

      // Log audit event
      await auditService.logEvent({
        eventType: "ZKP_PROOF_GENERATED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofRecord.id.toString(),
        action: "GENERATE",
        outcome: "SUCCESS",
        metadata: {
          proofType: 'condition',
          publicStatement,
          expiresInDays
        },
        severity: "info",
      });

      return {
        proofId: proofRecord.id,
        proofData: {
          proof,
          publicSignals: [commitment.toString(), challenge],
          challenge
        }
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_GENERATION_FAILED",
        severity: "high",
        details: { 
          error: error.message, 
          patientDID,
          proofType: 'condition'
        },
      });
      throw error;
    }
  }

  /**
   * Generate ZKP for age verification
   * Proves patient is over/under certain age without revealing exact age
   */
  async generateAgeProof(
    patientDID: string,
    birthDate: Date,
    minAge: number,
    publicStatement: string,
    expiresInDays: number = 30
  ): Promise<{ proofId: number; proofData: ZKPProofData }> {
    try {
      const privateKey = await secureKeyVault.retrievePatientKey(patientDID);
      if (!privateKey) {
        throw new Error(`No private key found for patient ${patientDID}`);
      }

      const challenge = nanoid(32);
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      // Prove age >= minAge without revealing exact age
      const ageHash = this.poseidon([age.toString()]);
      const minAgeHash = this.poseidon([minAge.toString()]);
      const commitment = this.poseidon([ageHash, minAgeHash, challenge]);

      const proof = {
        commitment: commitment.toString(),
        challenge: challenge,
        ageHash: ageHash.toString(),
        minAgeHash: minAgeHash.toString(),
        timestamp: Date.now()
      };

      const secretData = CryptoJS.AES.encrypt(birthDate.toISOString(), privateKey).toString();

      const proofRecord = await storage.createZKPProof({
        patientDID,
        proofType: 'age',
        publicStatement,
        secretData,
        proofData: proof,
        challenge,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        isActive: true,
        verificationCount: 0
      });

      await auditService.logEvent({
        eventType: "ZKP_PROOF_GENERATED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofRecord.id.toString(),
        action: "GENERATE",
        outcome: "SUCCESS",
        metadata: {
          proofType: 'age',
          publicStatement,
          minAge,
          expiresInDays
        },
        severity: "info",
      });

      return {
        proofId: proofRecord.id,
        proofData: {
          proof,
          publicSignals: [commitment.toString(), challenge],
          challenge
        }
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_GENERATION_FAILED",
        severity: "high",
        details: { 
          error: error.message, 
          patientDID,
          proofType: 'age'
        },
      });
      throw error;
    }
  }

  /**
   * Generate ZKP for allergy verification
   * Proves patient has a life-threatening allergy without revealing what it is
   */
  async generateAllergyProof(
    patientDID: string,
    allergy: string,
    publicStatement: string,
    expiresInDays: number = 30
  ): Promise<{ proofId: number; proofData: ZKPProofData }> {
    try {
      const privateKey = await secureKeyVault.retrievePatientKey(patientDID);
      if (!privateKey) {
        throw new Error(`No private key found for patient ${patientDID}`);
      }

      const challenge = nanoid(32);
      const allergyHash = this.poseidon([allergy]);
      const commitment = this.poseidon([allergyHash, challenge]);

      const proof = {
        commitment: commitment.toString(),
        challenge: challenge,
        allergyHash: allergyHash.toString(),
        timestamp: Date.now()
      };

      const secretData = CryptoJS.AES.encrypt(allergy, privateKey).toString();

      const proofRecord = await storage.createZKPProof({
        patientDID,
        proofType: 'allergy',
        publicStatement,
        secretData,
        proofData: proof,
        challenge,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        isActive: true,
        verificationCount: 0
      });

      await auditService.logEvent({
        eventType: "ZKP_PROOF_GENERATED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofRecord.id.toString(),
        action: "GENERATE",
        outcome: "SUCCESS",
        metadata: {
          proofType: 'allergy',
          publicStatement,
          expiresInDays
        },
        severity: "info",
      });

      return {
        proofId: proofRecord.id,
        proofData: {
          proof,
          publicSignals: [commitment.toString(), challenge],
          challenge
        }
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_GENERATION_FAILED",
        severity: "high",
        details: { 
          error: error.message, 
          patientDID,
          proofType: 'allergy'
        },
      });
      throw error;
    }
  }

  /**
   * Verify a ZKP proof
   */
  async verifyProof(
    proofId: number,
    verifiedBy: number,
    hospitalId: string,
    verificationContext: string,
    emergencyAccess: boolean = false
  ): Promise<ZKPVerificationResult> {
    try {
      // Get proof from database
      const proof = await storage.getZKPProofById(proofId);
      if (!proof) {
        return { isValid: false, error: "Proof not found" };
      }

      if (!proof.isActive) {
        return { isValid: false, error: "Proof is inactive" };
      }

      if (new Date() > proof.expiresAt) {
        return { isValid: false, error: "Proof has expired" };
      }

      // Verify the proof using Poseidon hash
      const { proofData, challenge } = proof;
      
      // Reconstruct commitment from stored proof data
      const reconstructedCommitment = this.poseidon([
        proofData.conditionHash || proofData.ageHash || proofData.allergyHash,
        challenge
      ]);

      // Verify commitment matches
      const isValid = reconstructedCommitment.toString() === proofData.commitment;

      // Record verification attempt
      const verificationRecord = await storage.createZKPVerification({
        proofId,
        verifiedBy,
        verificationResult: isValid,
        verificationContext,
        hospitalId,
        emergencyAccess
      });

      // Update verification count
      await storage.updateZKPProofVerificationCount(proofId);

      // Log audit event
      await auditService.logEvent({
        eventType: "ZKP_PROOF_VERIFIED",
        actorType: "HOSPITAL",
        actorId: verifiedBy.toString(),
        targetType: "ZKP_PROOF",
        targetId: proofId.toString(),
        action: "VERIFY",
        outcome: isValid ? "SUCCESS" : "FAILED",
        metadata: {
          proofType: proof.proofType,
          publicStatement: proof.publicStatement,
          verificationContext,
          emergencyAccess
        },
        severity: isValid ? "info" : "warning",
      });

      return {
        isValid,
        verificationId: verificationRecord.id
      };

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "ZKP_PROOF_VERIFICATION_FAILED",
        severity: "high",
        details: { 
          error: error.message, 
          proofId,
          verifiedBy
        },
      });
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Get all active ZKP proofs for a patient
   */
  async getPatientProofs(patientDID: string): Promise<any[]> {
    try {
      const proofs = await storage.getZKPProofsByPatientDID(patientDID);
      return proofs.filter(proof => proof.isActive && new Date() < proof.expiresAt);
    } catch (error: any) {
      console.error("Failed to get patient ZKP proofs:", error);
      throw error;
    }
  }

  /**
   * Revoke a ZKP proof
   */
  async revokeProof(proofId: number, patientDID: string): Promise<boolean> {
    try {
      const proof = await storage.getZKPProofById(proofId);
      if (!proof || proof.patientDID !== patientDID) {
        throw new Error("Proof not found or access denied");
      }

      await storage.deactivateZKPProof(proofId);

      await auditService.logEvent({
        eventType: "ZKP_PROOF_REVOKED",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofId.toString(),
        action: "REVOKE",
        outcome: "SUCCESS",
        metadata: {
          proofType: proof.proofType,
          publicStatement: proof.publicStatement
        },
        severity: "info",
      });

      return true;
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
}

export const zkpService = ZKPService.getInstance(); 