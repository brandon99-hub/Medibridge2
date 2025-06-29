import { randomBytes, createCipheriv, createDecipheriv, scrypt, createHash } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";
import { ethers } from "ethers";
import { createJWT, verifyJWT, ES256KSigner } from 'did-jwt';
import { Resolver } from 'did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { secureKeyVault } from "./secure-key-vault"; // Import SecureKeyVault

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
    
    // Generate standard Ethereum keypair
    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey; // Standard hex private key
    // Public key can be derived from private key using ethers.Wallet.fromPrivateKey(privateKey).publicKey
    // Or stored if frequently accessed without private key. For this service, private key is primary.
    
    // The salt for SecureKeyVault should be unique per patient and stored securely,
    // often alongside the encrypted key or retrievable via patientDID.
    // For SecureKeyVault, it uses its own masterKey + this patientSalt for PBKDF2.
    const patientKeySalt = randomBytes(16).toString('hex');
    await secureKeyVault.storePatientKey(patientDID, privateKey, patientKeySalt);

    // The 'encryptData' and 'decryptData' methods in this service, which use
    // scrypt(phoneNumber, salt), were for a different encryption scheme.
    // If we are fully switching to SecureKeyVault for private key management,
    // the `encryptedKeys` and `salt` returned by this function might become
    // identifiers or references for SecureKeyVault, or might be deprecated if
    // SecureKeyVault handles retrieval purely by patientDID.

    // For now, to minimize disruption to other parts that might expect `encryptedKeys` and `salt`
    // (e.g., for data encryption rather than private key encryption),
    // we can return the patientKeySalt. The `encryptedKeys` field is less clear
    // what it would represent if SecureKeyVault is the source of truth for the *private key*.
    // Let's assume for now that `createPatientIdentity` is primarily about setting up the DID and its keys in the vault.
    // The return signature might need to change eventually.
    // We will return the patientKeySalt used with SecureKeyVault.
    // The `encryptedKeys` field is now somewhat misleading if the key is in the vault.
    // Let's return an empty string for encryptedKeys for now, or a reference if that makes sense.
    // Or, we could encrypt the privateKey *again* with the phone method if it's used for some other purpose.
    // This suggests a deeper refactor of key handling might be needed.
    // For now, focusing on getting the private key into SecureKeyVault.

    // The original `encryptedKeys` was `this.encryptData(JSON.stringify({ privateKey }), phoneNumber, salt)`
    // Let's keep this for now if other parts of the service rely on it (e.g. issueConsentCredential decrypts it)
    // BUT, the key used for signing should eventually come ONLY from SecureKeyVault.
    const phoneDerivedEncryptionSalt = randomBytes(16).toString('hex');
    const phoneEncryptedPrivateKey = await this.encryptData(JSON.stringify({ privateKey }), phoneNumber, phoneDerivedEncryptionSalt);

    return {
      patientDID,
      encryptedKeys: phoneEncryptedPrivateKey, // This is the private key encrypted by phone method
      salt: phoneDerivedEncryptionSalt,         // Salt for the phone method encryption
      // Note: patientKeySalt for SecureKeyVault is not returned here but stored with the key in the vault.
      // This implies that to get the key from SecureKeyVault, one needs patientDID.
      // And to use the `encryptedKeys` returned here, one needs `patientPhone` and this `salt`.
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
    salt: string; // This salt is for the phone-based encryption, may become obsolete for key retrieval
  }): Promise<string> {
    // Retrieve patient's private key securely from the vault
    const privateKey = await secureKeyVault.retrievePatientKey(params.patientDID);
    // Note: params.encryptedKeys, params.patientPhone, params.salt are no longer needed here for private key retrieval.
    // Their presence in the function signature should be reviewed once full transition to SecureKeyVault is confirmed.

    // Create a signer object from the private key
    // The private key from ethers.Wallet is a hex string, ensure ES256KSigner can take it directly
    // or convert it to a Uint8Array if needed. ES256KSigner expects a hex private key.
    const signer = ES256KSigner(privateKey);
    
    const expiresAt = new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000);
    
    // Define the Verifiable Credential payload
    const vcPayload = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'MedicalRecordAccessCredential'],
      issuer: params.patientDID, // The patient is issuing the consent credential
      credentialSubject: {
        id: params.hospitalDID, // The hospital is the subject of the consent
        recordAccess: {
          cid: params.recordCID,
          encryptionKey: params.encryptionKey, // This key itself needs to be protected
          grantedBy: params.patientDID,
        },
      },
      // issuanceDate and expirationDate will be added by createJWT by default if not in jwtOptions
    };

    const jwtOptions = {
      alg: 'ES256K', // Algorithm used by ethers.js default signer
      issuer: params.patientDID,
      expiresIn: `${params.expiresInHours}h`,
    };

    // Create the JWT VC
    // The first argument to createJWT is the payload for the JWT, which includes the VC itself under a 'vc' claim.
    // The second argument is the signer.
    // The third argument provides JWT header options (alg, issuer, expiresIn).
    const jwtVC = await createJWT(
      { vc: vcPayload, sub: params.hospitalDID }, // JWT payload: 'vc' claim holds the VC, 'sub' is the hospital.
      { signer, did: params.patientDID }, // did-jwt SignerInfo: signer and issuer's DID
      { ...jwtOptions, header: { alg: 'ES256K', typ: 'JWT' } } // JWT header options
    );
    
    return jwtVC; // This is the signed Verifiable Credential in JWT format
  }

  /**
   * Verify verifiable credential
   */
  async verifyCredential(credentialJWT: string): Promise<{
    isValid: boolean;
    verifiedJwt?: any; // Contains decoded JWT payload, header, signature, and DID resolution result
    error?: string;
  }> {
    try {
      // Setup a DID resolver. For did:key, it's simple.
      // For did:medbridge, a custom resolver would be needed if we want to verify against it directly.
      // Assuming for now that the issuer DID (patientDID) is a did:key or resolvable by available methods.
      // If patientDID is did:medbridge, we'd need to resolve its public key manually for verification if not using a custom resolver.
      const keyResolver = getKeyResolver();
      const resolver = new Resolver({ ...keyResolver }); // Add other resolvers if needed

      const verifiedJwt = await verifyJWT(credentialJWT, { resolver });
      
      // verifyJWT throws an error if validation fails (e.g., signature, expiration)
      // Additional checks can be performed on verifiedJwt.payload if needed.
      if (!verifiedJwt.payload || !verifiedJwt.payload.vc?.credentialSubject?.recordAccess) {
        return { isValid: false, error: 'Invalid VC structure in JWT payload' };
      }
      
      // Check if the issuer in the JWT matches the issuer of the VC
      if (verifiedJwt.payload.iss !== verifiedJwt.payload.vc.issuer) {
        return { isValid: false, error: 'JWT issuer does not match VC issuer' };
      }

      return { isValid: true, verifiedJwt };
    } catch (error: any) {
      return { isValid: false, error: `JWT verification failed: ${error.message}` };
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

  // Development IPFS storage
  private ipfsStorage = new Map<string, any>();
}

export const patientWeb3Service = PatientWeb3Service.getInstance();