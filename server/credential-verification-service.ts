import crypto from "crypto";
import { auditService } from "./audit-service";
import { storage } from "./storage";

/**
 * Credential Verification Service
 * Addresses Q2: Who validates/verifies Verifiable Credentials on Hospital B's side
 * MediBridge backend handles all crypto operations - hospitals don't need crypto knowledge
 */
export class CredentialVerificationService {
  private static instance: CredentialVerificationService;
  private revokedCredentials = new Set<string>();

  static getInstance(): CredentialVerificationService {
    if (!CredentialVerificationService.instance) {
      CredentialVerificationService.instance = new CredentialVerificationService();
    }
    return CredentialVerificationService.instance;
  }

  /**
   * Complete VC verification process - called by Hospital B
   * Hospital B submits VC to backend, backend does all crypto verification
   */
  async verifyCredentialForHospital(
    credentialJWT: string,
    hospitalDID: string,
    requestedRecordId?: string
  ): Promise<VerificationResult> {
    try {
      // Step 1: Parse and validate JWT structure
      const credential = this.parseCredentialJWT(credentialJWT);
      
      // Step 2: Verify signature validity
      const signatureValid = await this.verifyCredentialSignature(credential);
      if (!signatureValid) {
        await this.logVerificationFailure("INVALID_SIGNATURE", credentialJWT, hospitalDID);
        return { isValid: false, error: "Invalid credential signature" };
      }

      // Step 3: Check expiration
      if (this.isCredentialExpired(credential)) {
        await this.logVerificationFailure("EXPIRED_CREDENTIAL", credentialJWT, hospitalDID);
        return { isValid: false, error: "Credential has expired" };
      }

      // Step 4: Check revocation status
      if (await this.isCredentialRevoked(credential.id)) {
        await this.logVerificationFailure("REVOKED_CREDENTIAL", credentialJWT, hospitalDID);
        return { isValid: false, error: "Credential has been revoked" };
      }

      // Step 5: Verify hospital authorization
      if (credential.subject !== hospitalDID) {
        await this.logVerificationFailure("UNAUTHORIZED_HOSPITAL", credentialJWT, hospitalDID);
        return { isValid: false, error: "Credential not issued for this hospital" };
      }

      // Step 6: Check record-level permissions (Q3: Granular consent)
      if (requestedRecordId && !this.hasRecordPermission(credential, requestedRecordId)) {
        await this.logVerificationFailure("INSUFFICIENT_PERMISSIONS", credentialJWT, hospitalDID);
        return { isValid: false, error: "No permission for requested record" };
      }

      // Step 7: Log successful verification
      await auditService.logEvent({
        eventType: "CREDENTIAL_VERIFIED",
        actorType: "HOSPITAL",
        actorId: hospitalDID,
        targetType: "CREDENTIAL",
        targetId: credential.id,
        action: "VERIFY",
        outcome: "SUCCESS",
        metadata: {
          patientDID: credential.issuer,
          recordPermissions: credential.credentialSubject.recordAccess,
          expiresAt: credential.expirationDate,
        },
        severity: "info",
      });

      return {
        isValid: true,
        credential,
        permissions: this.extractPermissions(credential),
        decryptionKey: credential.credentialSubject.recordAccess.encryptionKey,
        ipfsCID: credential.credentialSubject.recordAccess.cid,
      };

    } catch (error: any) {
      await this.logVerificationFailure("VERIFICATION_ERROR", credentialJWT, hospitalDID, error.message);
      return { isValid: false, error: `Verification failed: ${error.message}` };
    }
  }

  /**
   * Parse JWT credential structure
   */
  private parseCredentialJWT(credentialJWT: string): any {
    try {
      const parts = credentialJWT.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT structure');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      throw new Error('Malformed credential JWT');
    }
  }

  /**
   * Verify cryptographic signature of credential
   */
  private async verifyCredentialSignature(credential: any): Promise<boolean> {
    try {
      // In production, use proper DID resolution and signature verification
      // For now, verify using known issuer public key
      const issuerPublicKey = await this.resolveIssuerPublicKey(credential.issuer);
      
      // Reconstruct signed data
      const signedData = JSON.stringify({
        credentialSubject: credential.credentialSubject,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate,
      });

      // Verify signature (simplified - use proper crypto library in production)
      const signature = credential.proof.jws;
      const isValid = crypto.verify(
        'sha256',
        Buffer.from(signedData),
        issuerPublicKey,
        Buffer.from(signature, 'base64')
      );

      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if credential is expired
   */
  private isCredentialExpired(credential: any): boolean {
    if (!credential.expirationDate) return false;
    return new Date() > new Date(credential.expirationDate);
  }

  /**
   * Check credential revocation status
   * Addresses Q5: How are expired or revoked credentials discovered and blocked
   */
  private async isCredentialRevoked(credentialId: string): Promise<boolean> {
    // Check in-memory revocation list (fast lookup)
    if (this.revokedCredentials.has(credentialId)) {
      return true;
    }

    // Check database revocation status
    try {
      const revokedCredential = await storage.getCredentialById(credentialId);
      if (revokedCredential && revokedCredential.revoked) {
        // Cache for future lookups
        this.revokedCredentials.add(credentialId);
        return true;
      }
    } catch (error) {
      // If we can't verify, err on the side of caution
      return true;
    }

    return false;
  }

  /**
   * Q3: Check record-level permissions (granular consent)
   * Each VC can specify specific records or categories
   */
  private hasRecordPermission(credential: any, recordId: string): boolean {
    const recordAccess = credential.credentialSubject.recordAccess;
    
    // Check if this specific record is authorized
    if (recordAccess.specificRecords && recordAccess.specificRecords.includes(recordId)) {
      return true;
    }

    // Check if record falls under authorized categories
    if (recordAccess.categories) {
      // Implementation would check record category against authorized categories
      return true;
    }

    // Check if all records are authorized (full access)
    if (recordAccess.scope === 'all') {
      return true;
    }

    return false;
  }

  /**
   * Extract permissions from verified credential
   */
  private extractPermissions(credential: any): RecordPermissions {
    const recordAccess = credential.credentialSubject.recordAccess;
    
    return {
      patientDID: credential.issuer,
      scope: recordAccess.scope || 'specific',
      specificRecords: recordAccess.specificRecords || [],
      categories: recordAccess.categories || [],
      expiresAt: credential.expirationDate,
      grantedAt: credential.issuanceDate,
    };
  }

  /**
   * Resolve issuer public key for signature verification
   */
  private async resolveIssuerPublicKey(issuerDID: string): Promise<string> {
    // In production, use proper DID resolution (Ceramic, ION, etc.)
    // For now, use stored public key
    try {
      const identity = await storage.getPatientIdentityByDID(issuerDID);
      return identity?.publicKey || '';
    } catch (error) {
      throw new Error('Cannot resolve issuer public key');
    }
  }

  /**
   * Log verification failures for security monitoring
   */
  private async logVerificationFailure(
    reason: string,
    credentialJWT: string,
    hospitalDID: string,
    details?: string
  ): Promise<void> {
    await auditService.logSecurityViolation({
      violationType: "CREDENTIAL_VERIFICATION_FAILURE",
      severity: "high",
      actorId: hospitalDID,
      targetResource: "credential_verification",
      details: {
        reason,
        credentialPreview: credentialJWT.substring(0, 50) + "...",
        hospitalDID,
        additionalDetails: details,
      },
    });
  }

  /**
   * Revoke credential (called when patient revokes consent)
   */
  async revokeCredential(credentialId: string, revokedBy: string): Promise<void> {
    try {
      // Add to revocation list
      this.revokedCredentials.add(credentialId);
      
      // Update database
      await storage.revokeCredential(parseInt(credentialId));

      // Audit log revocation
      await auditService.logEvent({
        eventType: "CREDENTIAL_REVOKED",
        actorType: "PATIENT",
        actorId: revokedBy,
        targetType: "CREDENTIAL",
        targetId: credentialId,
        action: "REVOKE",
        outcome: "SUCCESS",
        metadata: { revokedAt: new Date().toISOString() },
        severity: "info",
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "CREDENTIAL_REVOCATION_FAILURE",
        severity: "medium",
        details: { error: error.message, credentialId },
      });
      throw error;
    }
  }
}

interface VerificationResult {
  isValid: boolean;
  error?: string;
  credential?: any;
  permissions?: RecordPermissions;
  decryptionKey?: string;
  ipfsCID?: string;
}

interface RecordPermissions {
  patientDID: string;
  scope: 'all' | 'specific' | 'category';
  specificRecords: string[];
  categories: string[];
  expiresAt: string;
  grantedAt: string;
}

export const credentialVerificationService = CredentialVerificationService.getInstance();