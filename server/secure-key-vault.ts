import crypto from "crypto";
import { auditService } from "./audit-service";

/**
 * Secure Key Vault - Patient Private Key Management
 * Addresses Q1: Where and how are patient private keys stored and protected
 */
export class SecureKeyVault {
  private static instance: SecureKeyVault;
  private readonly masterKey: string;
  private readonly keyStore = new Map<string, EncryptedKeyData>();

  private constructor() {
    // In production, this would be loaded from a secure environment variable
    // or hardware security module (HSM)
    this.masterKey = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
  }

  static getInstance(): SecureKeyVault {
    if (!SecureKeyVault.instance) {
      SecureKeyVault.instance = new SecureKeyVault();
    }
    return SecureKeyVault.instance;
  }

  /**
   * Store patient private key securely
   * Uses AES-256-GCM with patient-specific salt and PBKDF2 key derivation
   */
  async storePatientKey(patientDID: string, privateKey: string, patientSalt: string): Promise<void> {
    try {
      // Derive encryption key using PBKDF2 with patient-specific salt
      const derivedKey = crypto.pbkdf2Sync(
        this.masterKey, 
        patientSalt, 
        100000, // 100k iterations
        32, 
        'sha256'
      );

      // Encrypt private key using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipher('aes-256-gcm', derivedKey);
      cipher.setAAD(Buffer.from(patientDID)); // Additional authenticated data

      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      const encryptedKeyData: EncryptedKeyData = {
        encryptedKey: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        patientSalt,
        createdAt: new Date().toISOString(),
        accessCount: 0,
      };

      // Store in secure memory (in production, use encrypted database or HSM)
      this.keyStore.set(patientDID, encryptedKeyData);

      // Audit log key storage
      await auditService.logEvent({
        eventType: "PRIVATE_KEY_STORED",
        actorType: "SYSTEM",
        actorId: "key_vault",
        targetType: "PATIENT_KEY",
        targetId: patientDID,
        action: "STORE",
        outcome: "SUCCESS",
        metadata: { keyLength: privateKey.length },
        severity: "info",
      });

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "KEY_STORAGE_FAILURE",
        severity: "critical",
        details: { error: error.message, patientDID },
      });
      throw new Error(`Failed to store patient key: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt patient private key
   */
  async retrievePatientKey(patientDID: string): Promise<string> {
    try {
      const encryptedData = this.keyStore.get(patientDID);
      if (!encryptedData) {
        throw new Error('Patient key not found');
      }

      // Derive decryption key
      const derivedKey = crypto.pbkdf2Sync(
        this.masterKey,
        encryptedData.patientSalt,
        100000,
        32,
        'sha256'
      );

      // Decrypt private key
      const decipher = crypto.createDecipher('aes-256-gcm', derivedKey);
      decipher.setAAD(Buffer.from(patientDID));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Update access count and audit
      encryptedData.accessCount++;
      encryptedData.lastAccessed = new Date().toISOString();

      await auditService.logEvent({
        eventType: "PRIVATE_KEY_ACCESSED",
        actorType: "SYSTEM",
        actorId: "key_vault",
        targetType: "PATIENT_KEY",
        targetId: patientDID,
        action: "RETRIEVE",
        outcome: "SUCCESS",
        metadata: { accessCount: encryptedData.accessCount },
        severity: "info",
      });

      return decrypted;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "KEY_RETRIEVAL_FAILURE",
        severity: "critical",
        details: { error: error.message, patientDID },
      });
      throw new Error(`Failed to retrieve patient key: ${error.message}`);
    }
  }

  /**
   * Generate patient recovery phrase (12-word mnemonic)
   * For optional patient export via QR or recovery phrase
   */
  generateRecoveryPhrase(): string {
    const wordList = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
      'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
      // ... abbreviated for example, use full BIP39 wordlist in production
    ];
    
    const phrase = Array.from({ length: 12 }, () => 
      wordList[Math.floor(Math.random() * wordList.length)]
    ).join(' ');
    
    return phrase;
  }

  /**
   * Export patient key as QR code data
   */
  async exportPatientKeyQR(patientDID: string): Promise<string> {
    try {
      const privateKey = await this.retrievePatientKey(patientDID);
      const recoveryData = {
        did: patientDID,
        key: privateKey,
        exported: new Date().toISOString(),
      };

      // In production, encrypt this export data
      const exportData = Buffer.from(JSON.stringify(recoveryData)).toString('base64');

      await auditService.logEvent({
        eventType: "KEY_EXPORT_QR",
        actorType: "PATIENT",
        actorId: patientDID,
        targetType: "PATIENT_KEY",
        targetId: patientDID,
        action: "EXPORT",
        outcome: "SUCCESS",
        metadata: { exportMethod: "QR" },
        severity: "warning", // Key export is sensitive
      });

      return exportData;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "KEY_EXPORT_FAILURE",
        severity: "high",
        details: { error: error.message, patientDID },
      });
      throw error;
    }
  }
}

interface EncryptedKeyData {
  encryptedKey: string;
  iv: string;
  authTag: string;
  patientSalt: string;
  createdAt: string;
  accessCount: number;
  lastAccessed?: string;
}

export const secureKeyVault = SecureKeyVault.getInstance();