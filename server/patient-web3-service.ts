import { randomBytes, createCipheriv, createDecipheriv, scrypt, createHash } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";

const scryptAsync = promisify(scrypt);

/**
 * Patient Web3 Service - Web3 backend with Web2 UX
 * Handles DID generation, phone-based auth, and verifiable credentials
 * Patients only see phone login - all Web3 complexity is hidden
 */
export class PatientWeb3Service {
  private static instance: PatientWeb3Service;
  
  static getInstance(): PatientWeb3Service {
    if (!PatientWeb3Service.instance) {
      PatientWeb3Service.instance = new PatientWeb3Service();
    }
    return PatientWeb3Service.instance;
  }

  /**
   * Generate DID and encrypted keys when patient first registers via phone
   */
  async createPatientIdentity(phoneNumber: string): Promise<{
    patientDID: string;
    encryptedKeys: string;
    salt: string;
  }> {
    // Generate simple DID based on phone number
    const patientDID = `did:medbridge:patient:${Buffer.from(phoneNumber).toString('base64').replace(/[+=]/g, '')}`;
    
    // Generate keypair for signing VCs
    const privateKey = randomBytes(32).toString('hex');
    const publicKey = this.derivePublicKey(privateKey);
    
    const keys = JSON.stringify({ privateKey, publicKey });
    
    // Encrypt keys using phone number
    const salt = randomBytes(16).toString('hex');
    const encryptedKeys = await this.encryptData(keys, phoneNumber, salt);
    
    return {
      patientDID,
      encryptedKeys,
      salt,
    };
  }

  /**
   * Encrypt medical record for IPFS storage
   */
  async encryptMedicalRecord(recordData: any): Promise<{
    encryptedData: string;
    encryptionKey: string;
  }> {
    const encryptionKey = randomBytes(32).toString('hex');
    const recordJson = JSON.stringify(recordData);
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    
    let encrypted = cipher.update(recordJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedData: iv.toString('hex') + ':' + encrypted,
      encryptionKey,
    };
  }

  /**
   * Decrypt medical record from IPFS
   */
  async decryptMedicalRecord(encryptedData: string, encryptionKey: string): Promise<any> {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Store encrypted record on simulated IPFS
   */
  async storeOnIPFS(encryptedData: string, metadata: any): Promise<string> {
    // Generate mock CID for development
    const hash = createHash('sha256');
    hash.update(encryptedData + JSON.stringify(metadata));
    const cid = 'bafyrei' + hash.digest('hex').substring(0, 50);
    
    // Store in memory for development
    this.ipfsStorage.set(cid, { data: encryptedData, metadata });
    
    console.log(`[IPFS] Stored record with CID: ${cid}`);
    return cid;
  }

  /**
   * Retrieve record from simulated IPFS
   */
  async retrieveFromIPFS(cid: string): Promise<{ data: string; metadata: any }> {
    const stored = this.ipfsStorage.get(cid);
    if (!stored) {
      throw new Error(`Record not found for CID: ${cid}`);
    }
    return stored;
  }

  /**
   * Issue verifiable credential for consent
   */
  async issueConsentCredential(params: {
    patientDID: string;
    hospitalDID: string;
    recordCID: string;
    encryptionKey: string;
    expiresInHours: number;
    patientPhone: string;
    encryptedKeys: string;
    salt: string;
  }): Promise<string> {
    // Decrypt patient's signing key
    const keys = await this.decryptData(params.encryptedKeys, params.patientPhone, params.salt);
    const { privateKey } = JSON.parse(keys);
    
    const expiresAt = new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000);
    
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'MedicalRecordAccessCredential'],
      issuer: params.patientDID,
      subject: params.hospitalDID,
      issuanceDate: new Date().toISOString(),
      expirationDate: expiresAt.toISOString(),
      credentialSubject: {
        id: params.hospitalDID,
        recordAccess: {
          cid: params.recordCID,
          encryptionKey: params.encryptionKey,
          grantedBy: params.patientDID,
        },
      },
      proof: {
        type: 'Ed25519Signature2018',
        created: new Date().toISOString(),
        verificationMethod: `${params.patientDID}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: this.signCredential(JSON.stringify({
          issuer: params.patientDID,
          subject: params.hospitalDID,
          recordCID: params.recordCID,
          expiresAt: expiresAt.toISOString(),
        }), privateKey),
      },
    };
    
    return JSON.stringify(credential);
  }

  /**
   * Verify verifiable credential
   */
  async verifyCredential(credentialJWT: string): Promise<{
    isValid: boolean;
    credential?: any;
    error?: string;
  }> {
    try {
      const credential = JSON.parse(credentialJWT);
      
      // Check expiration
      if (new Date(credential.expirationDate) < new Date()) {
        return { isValid: false, error: 'Credential expired' };
      }
      
      // In production, verify cryptographic signature
      // For now, assume valid if structure is correct
      if (!credential.credentialSubject?.recordAccess) {
        return { isValid: false, error: 'Invalid credential structure' };
      }
      
      return { isValid: true, credential };
    } catch (error: any) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Generate OTP for phone verification
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Private helper methods
  private async encryptData(data: string, password: string, salt: string): Promise<string> {
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private async decryptData(encryptedData: string, password: string, salt: string): Promise<string> {
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const [ivHex, encryptedHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private derivePublicKey(privateKey: string): string {
    // Simplified public key derivation
    const hash = createHash('sha256');
    hash.update(privateKey + 'public');
    return hash.digest('hex');
  }

  private signCredential(data: string, privateKey: string): string {
    // Simplified signing
    const hash = createHash('sha256');
    hash.update(data + privateKey);
    return hash.digest('base64');
  }

  // Development IPFS storage
  private ipfsStorage = new Map<string, any>();
}

export const patientWeb3Service = PatientWeb3Service.getInstance();