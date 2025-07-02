import crypto from "crypto";
import { auditService } from "./audit-service";

/**
 * Secure Key Vault - Patient Private Key Management
 * Addresses Q1: Where and how are patient private keys stored and protected
 */
export class SecureKeyVault {
  private static instance: SecureKeyVault;
  private readonly masterKey: Buffer; // Store as Buffer
  private readonly keyStore = new Map<string, EncryptedKeyData>();
  private readonly DEK_ENCRYPTION_SALT = "medbridge-dek-salt"; // Salt for KEK derivation for DEKs
  private dekKek: Buffer | null = null; // Cache for the DEK's Key Encryption Key

  private constructor() {
    // In production, this would be loaded from a secure environment variable
    // or hardware security module (HSM)
    const masterKeyString = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
    this.masterKey = Buffer.from(masterKeyString, 'hex');
    this.deriveDekKek();
  }

  private async deriveDekKek() {
    // Derive the KEK for DEKs once and cache it
    this.dekKek = crypto.pbkdf2Sync(
      this.masterKey,
      this.DEK_ENCRYPTION_SALT,
      100000, // Iterations
      32,     // Key length in bytes (AES-256)
      'sha256'
    );
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
      const iv = crypto.randomBytes(12); // 12 bytes for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
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
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(encryptedData.iv, 'hex'));
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
   * Now uses BIP39 standard for production-grade security.
   */
  generateRecoveryPhrase(): string {
    // Use bip39 for secure, standard-compliant mnemonic generation
    const bip39 = require('bip39');
    return bip39.generateMnemonic(128); // 12 words (128 bits entropy)
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

  /**
   * Encrypts a Data Encryption Key (DEK) using a derived Key Encryption Key (KEK).
   * @param dataKey Plaintext Data Encryption Key (hex string).
   * @returns A string combining IV:Ciphertext:AuthTag (all hex encoded).
   */
  async encryptDataKey(dataKey: string): Promise<string> {
    if (!this.dekKek) {
      // Should have been initialized in constructor
      await this.deriveDekKek();
    }
    try {
      const iv = crypto.randomBytes(12); // Recommended for AES-GCM
      // Using a fixed AAD for all DEKs encrypted with this KEK, or could be context-specific
      const aad = Buffer.from("dek-encryption-context");
      const cipher = crypto.createCipheriv('aes-256-gcm', this.dekKek!, iv);
      cipher.setAAD(aad);

      let encrypted = cipher.update(dataKey, 'hex', 'hex'); // Assuming DEK is hex
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
    } catch (error: any) {
      // Log this critical failure with auditService
      await auditService.logSecurityViolation({
        violationType: "DEK_ENCRYPTION_FAILURE",
        severity: "critical",
        details: { error: error.message },
      });
      console.error("Failed to encrypt DEK:", error);
      throw new Error(`Failed to encrypt Data Key: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted Data Encryption Key (DEK).
   * @param encryptedDekString The "IV:Ciphertext:AuthTag" string.
   * @returns The plaintext Data Encryption Key (hex string).
   */
  async decryptDataKey(encryptedDekString: string): Promise<string> {
    if (!this.dekKek) {
      await this.deriveDekKek();
    }
    try {
      const parts = encryptedDekString.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted DEK format. Expected IV:Ciphertext:AuthTag.');
      }
      const [ivHex, encryptedHex, authTagHex] = parts;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const aad = Buffer.from("dek-encryption-context"); // Must match AAD used during encryption

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.dekKek!, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(aad);

      let decrypted = decipher.update(encryptedHex, 'hex', 'hex'); // Outputting hex
      decrypted += decipher.final('hex');

      return decrypted;
    } catch (error: any) {
      // Log this critical failure with auditService
      await auditService.logSecurityViolation({
        violationType: "DEK_DECRYPTION_FAILURE",
        severity: "critical",
        details: { error: error.message },
      });
      console.error("Failed to decrypt DEK:", error);
      throw new Error(`Failed to decrypt Data Key: ${error.message}`);
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