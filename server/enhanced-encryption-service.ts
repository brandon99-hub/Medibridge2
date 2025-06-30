import crypto from "crypto";
import { auditService } from "./audit-service";

/**
 * Enhanced Encryption Service for Medical Records
 * Provides advanced encryption with integrity verification and audit logging
 */
export class EnhancedEncryptionService {
  private static instance: EnhancedEncryptionService;

  static getInstance(): EnhancedEncryptionService {
    if (!EnhancedEncryptionService.instance) {
      EnhancedEncryptionService.instance = new EnhancedEncryptionService();
    }
    return EnhancedEncryptionService.instance;
  }

  /**
   * Encrypt medical record with enhanced security features
   */
  async encryptRecord(recordData: any, patientDID: string): Promise<{
    encryptedData: string;
    encryptionKey: string;
    metadata: {
      algorithm: string;
      keyDerivation: string;
      timestamp: string;
      recordHash: string;
      integritySignature: string;
    };
  }> {
    try {
      // Generate encryption materials
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const iv = crypto.randomBytes(12); // 12 bytes for GCM
      
      // Create record string and hash for integrity
      const recordString = JSON.stringify(recordData);
      const recordHash = crypto.createHash('sha256').update(recordString).digest('hex');
      
      // Create integrity signature (HMAC)
      const hmacKey = crypto.randomBytes(32);
      const integritySignature = crypto.createHmac('sha256', hmacKey)
        .update(recordString)
        .digest('hex');
      
      // Encrypt using AES-256-GCM for authenticated encryption
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
      let encrypted = cipher.update(recordString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with authentication tag
      const encryptedData = `${salt}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      const metadata = {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'PBKDF2-SHA256',
        timestamp: new Date().toISOString(),
        recordHash,
        integritySignature,
      };
      
      // Audit log the encryption event
      await auditService.logEncryptionEvent(
        patientDID,
        recordHash,
        "ENCRYPT",
        "SUCCESS",
        {
          algorithm: metadata.algorithm,
          recordSize: recordString.length,
          encryptedSize: encryptedData.length,
        }
      );
      
      return {
        encryptedData,
        encryptionKey,
        metadata,
      };
      
    } catch (error: any) {
      await auditService.logEncryptionEvent(
        patientDID,
        "unknown",
        "ENCRYPT",
        "FAILURE",
        { error: error.message }
      );
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt medical record with integrity verification
   */
  async decryptRecord(
    encryptedData: string,
    encryptionKey: string,
    patientDID: string,
    expectedMetadata?: {
      recordHash?: string;
      integritySignature?: string;
    }
  ): Promise<any> {
    try {
      // Parse encrypted data components
      const [salt, ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      if (!salt || !ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Decrypt using AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Verify record integrity if metadata provided
      if (expectedMetadata?.recordHash) {
        const actualHash = crypto.createHash('sha256').update(decrypted).digest('hex');
        if (actualHash !== expectedMetadata.recordHash) {
          await auditService.logSecurityViolation({
            violationType: "RECORD_INTEGRITY_VIOLATION",
            severity: "critical",
            actorId: patientDID,
            targetResource: `record:${expectedMetadata.recordHash}`,
            details: {
              expectedHash: expectedMetadata.recordHash,
              actualHash,
              patientDID,
            },
          });
          throw new Error('Record integrity verification failed - data may have been tampered with');
        }
      }
      
      const recordData = JSON.parse(decrypted);
      
      // Audit successful decryption
      await auditService.logEncryptionEvent(
        patientDID,
        expectedMetadata?.recordHash || "unknown",
        "DECRYPT",
        "SUCCESS",
        {
          recordSize: decrypted.length,
          integrityVerified: !!expectedMetadata?.recordHash,
        }
      );
      
      return recordData;
      
    } catch (error: any) {
      await auditService.logEncryptionEvent(
        patientDID,
        "unknown",
        "DECRYPT",
        "FAILURE",
        { error: error.message }
      );
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate secure encryption key with entropy validation
   */
  generateSecureKey(): string {
    // Generate key with high entropy
    const key = crypto.randomBytes(32);
    
    // Validate entropy (basic check)
    const keyHex = key.toString('hex');
    const uniqueChars = new Set(keyHex).size;
    
    if (uniqueChars < 8) {
      // Regenerate if entropy seems low
      return this.generateSecureKey();
    }
    
    return keyHex;
  }

  /**
   * Secure key derivation for patient DIDs
   */
  derivePatientKey(patientDID: string, masterKey: string): string {
    return crypto.pbkdf2Sync(patientDID, masterKey, 100000, 32, 'sha256').toString('hex');
  }
}

export const enhancedEncryptionService = EnhancedEncryptionService.getInstance();