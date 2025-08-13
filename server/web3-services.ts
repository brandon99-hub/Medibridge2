import { ethers } from "ethers";
import { Resolver } from "did-resolver";
import { createHash } from "crypto";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import PinataClient from '@pinata/sdk';
import fetch from 'node-fetch';
import { createJWT, verifyJWT, ES256KSigner } from 'did-jwt';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { secureKeyVault } from "./secure-key-vault"; // Import SecureKeyVault

// Pinata Configuration
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataJWT = process.env.PINATA_JWT;

const pinata = pinataJWT
  ? new PinataClient({ pinataJWTKey: pinataJWT })
  : new PinataClient(pinataApiKey!, pinataSecretApiKey!);

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// DID Service for managing decentralized identities
export class DIDService {
  private static instance: DIDService;
  private resolver: Resolver;

  private constructor() {
    this.resolver = new Resolver({});
  }

  static getInstance(): DIDService {
    if (!DIDService.instance) {
      DIDService.instance = new DIDService();
    }
    return DIDService.instance;
  }

  // Generate a new DID:key identifier
  generateDID(publicKey: string): string {
    const hash = createHash('sha256').update(publicKey).digest('hex');
    return `did:key:z${hash.substring(0, 32)}`;
  }

  // Create DID Document
  createDIDDocument(did: string, publicKey: string) {
    return {
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": did,
      "verificationMethod": [{
        "id": `${did}#key-1`,
        "type": "Ed25519VerificationKey2018",
        "controller": did,
        "publicKeyBase58": publicKey
      }],
      "authentication": [`${did}#key-1`],
      "assertionMethod": [`${did}#key-1`]
    };
  }

  // Resolve DID to get DID Document
  async resolveDID(did: string) {
    try {
      const result = await this.resolver.resolve(did);
      return result.didDocument;
    } catch (error) {
      console.error("Failed to resolve DID:", error);
      return null;
    }
  }
}

// Verifiable Credentials Service
export class VCService {
  // Issue a verifiable credential
  async issueCredential(
    issuerDID: string,
    subjectDID: string, // The DID of the subject of the credential
    credentialType: string, // A specific type for the credential, e.g., "MediBridgePatientRecord"
    credentialSubject: any, // The actual claims/data of the credential
    privateKeyHex: string, // Issuer's private key in hex format
    expiresInHours?: number // Optional expiration in hours
  ): Promise<string> { // Returns the JWT string
    const signer = ES256KSigner(Buffer.from(privateKeyHex, 'hex'));

    const vcPayload = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        // Add any other relevant contexts, e.g., for specific credential types
      ],
      id: `urn:uuid:${uuidv4()}`,
      type: ['VerifiableCredential', credentialType],
      issuer: issuerDID,
      // issuanceDate will be set by createJWT
      credentialSubject: {
        id: subjectDID,
        ...credentialSubject,
      },
    };

    const jwtOptions: any = {
      alg: 'ES256K',
      issuer: issuerDID,
    };

    if (expiresInHours) {
      jwtOptions.expiresIn = `${expiresInHours}h`;
    }

    // The JWT payload will contain the VC under the 'vc' claim.
    // 'sub' (subject) of the JWT will be the subject's DID.
    // 'iss' (issuer) of the JWT will be the issuer's DID.
    const jwt = await createJWT(
      { vc: vcPayload, sub: subjectDID },
      { signer, issuer: issuerDID },
      { ...jwtOptions, header: { alg: 'ES256K', typ: 'JWT' } }
    );

    return jwt;
  }

  // Verify a verifiable credential (JWT format)
  async verifyCredential(
    jwt: string,
    expectedIssuer?: string, // Optional: verify against a specific issuer DID
    expectedSubject?: string // Optional: verify against a specific subject DID
  ): Promise<{ isValid: boolean; verifiedJwt?: any; error?: string }> {
    try {
      const keyResolver = getKeyResolver();
      const resolver = new Resolver({ ...keyResolver });

      const verifiedJwt = await verifyJWT(jwt, { resolver });

      if (!verifiedJwt.payload || !verifiedJwt.payload.vc) {
        return { isValid: false, error: 'Invalid VC structure in JWT payload' };
      }

      // Optional: Check if the issuer in the JWT matches the issuer of the VC
      if (verifiedJwt.payload.iss !== verifiedJwt.payload.vc.issuer) {
        return { isValid: false, error: 'JWT issuer does not match VC issuer' };
      }

      // Optional: Check specific issuer if provided
      if (expectedIssuer && verifiedJwt.payload.iss !== expectedIssuer) {
        return { isValid: false, error: `JWT issuer ${verifiedJwt.payload.iss} does not match expected issuer ${expectedIssuer}` };
      }

      // Optional: Check specific subject if provided
      if (expectedSubject && verifiedJwt.payload.sub !== expectedSubject) {
        return { isValid: false, error: `JWT subject ${verifiedJwt.payload.sub} does not match expected subject ${expectedSubject}` };
      }

      // Add any other domain-specific checks on verifiedJwt.payload.vc if needed

      return { isValid: true, verifiedJwt };
    } catch (error: any) {
      return { isValid: false, error: `JWT verification failed: ${error.message}` };
    }
  }
}

// IPFS Service for decentralized storage
export class IPFSService {
  // Store encrypted content on IPFS
  async storeContent(content: any, encryptionKey?: string): Promise<string> {
    try {
      const plaintext = Buffer.from(JSON.stringify(content), 'utf8');
      let dataToStore: string;
      if (encryptionKey) {
        // AES-256-GCM with IV + authTag prefix, base64 payload
        const keyBuf = Buffer.from(encryptionKey, 'hex');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();
        dataToStore = Buffer.concat([iv, authTag, ciphertext]).toString('base64');
      } else {
        dataToStore = plaintext.toString('base64');
      }
      // Pin JSON to IPFS via Pinata
      const result = await pinata.pinJSONToIPFS({ pinataContent: dataToStore });
      return result.IpfsHash;
    } catch (error) {
      console.error("Failed to store content on IPFS (Pinata):", error);
      throw new Error("IPFS storage failed");
    }
  }

  // Retrieve content from IPFS
  async retrieveContent(hash: string, encryptionKey?: string): Promise<any> {
    try {
      // Fetch from Pinata public gateway
      const response = await fetch(`${PINATA_GATEWAY}${hash}`);
      if (!response.ok) throw new Error(`Failed to fetch from IPFS gateway: ${response.statusText}`);
      const b64 = await response.text();
      const buf = Buffer.from(b64, 'base64');
      let plaintext: Buffer;
      if (encryptionKey) {
        const keyBuf = Buffer.from(encryptionKey, 'hex');
        const iv = buf.subarray(0, 12);
        const authTag = buf.subarray(12, 28);
        const ciphertext = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
        decipher.setAuthTag(authTag);
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } else {
        plaintext = buf;
      }
      return JSON.parse(plaintext.toString('utf8'));
    } catch (error) {
      console.error("Failed to retrieve content from IPFS (Pinata):", error);
      throw new Error("IPFS retrieval failed");
    }
  }

  // Pin content to ensure availability (no-op for Pinata, already pinned)
  async pinContent(hash: string): Promise<void> {
    // Pinata pins automatically on upload
    return;
  }
}

// Web3 Wallet Service
export class WalletService {
  // Generate a new wallet
  static generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic?.phrase
    };
  }

  // Verify wallet signature
  static verifySignature(message: string, signature: string, address: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error("Failed to verify signature:", error);
      return false;
    }
  }

  // Create a message for wallet signing
  static createSignMessage(did: string, timestamp: number): string {
    return `Authenticate with DID: ${did}\nTimestamp: ${timestamp}`;
  }
}

// Patient Consent Service using Verifiable Credentials
export class ConsentService {
  private vcService: VCService;
  private didService: DIDService;

  constructor() {
    this.vcService = new VCService();
    this.didService = DIDService.getInstance();
  }

  // Issue consent credential
  async issueConsentCredential(
    patientDID: string, // Issuer of the consent (patient)
    requesterId: string, // Who is being granted consent (hospital)
    contentHash: string,  // Specific record/content hash
    consentType: string   // Type of consent (e.g., "read")
    // patientPrivateKey is no longer passed directly; it will be retrieved from SecureKeyVault
  ) {
    // Retrieve patient's private key using SecureKeyVault
    const patientPrivateKeyHex = await secureKeyVault.retrievePatientKey(patientDID);
    if (!patientPrivateKeyHex) {
      throw new Error(`Could not retrieve private key for patient DID: ${patientDID}`);
    }

    const credentialSubject = {
      // id: requesterId, // The subject of VC is requesterId, id in credentialSubject is for that subject
      requester: requesterId, // Keeping this for clarity if needed by consumers
      contentHash,
      consentType,
      grantedAt: new Date().toISOString(),
      // expiration will be handled by JWT 'exp' claim through vcService.issueCredential
    };

    // vcService.issueCredential now takes subjectDID as the second param
    // For a consent VC, the patient (issuerDID) issues a credential where the
    // hospital (requesterId which becomes subjectDID of VC) is the subject.
    return await this.vcService.issueCredential(
      patientDID,         // issuer: patient's DID
      requesterId,       // subject: hospital's DID (who is granted access)
      "HealthcareConsent",// credentialType
      credentialSubject,  // claims
      patientPrivateKeyHex, // patient's private key from vault
      30 * 24             // expiresInHours (e.g., 30 days)
    );
  }

  // Verify consent credential (JWT string)
  async verifyConsentCredential(
    jwtVc: string,
    expectedPatientDID?: string, // Optional: verify if this patient issued it (issuer of JWT/VC)
    expectedRequesterId?: string // Optional: verify if this hospital was the subject of JWT/VC
  ): Promise<{ isValid: boolean; verifiedJwt?: any; error?: string }> {
    // vcService.verifyCredential now returns an object { isValid, verifiedJwt, error }
    const verificationResult = await this.vcService.verifyCredential(jwtVc, expectedPatientDID, expectedRequesterId);

    if (!verificationResult.isValid || !verificationResult.verifiedJwt) {
      return verificationResult;
    }

    // Additional domain-specific checks for consent VCs
    const vcPayload = verificationResult.verifiedJwt.payload.vc;
    if (!vcPayload.type?.includes("HealthcareConsent")) {
      return { isValid: false, error: "VC is not of type HealthcareConsent" };
    }
    if (!vcPayload.credentialSubject?.requester || !vcPayload.credentialSubject?.contentHash) {
      return { isValid: false, error: "HealthcareConsent VC is missing required subject fields (requester, contentHash)" };
    }
     // Check if the VC subject matches the expected requester DID, if provided
    if (expectedRequesterId && vcPayload.credentialSubject?.id !== expectedRequesterId) {
        return { isValid: false, error: `VC subject ${vcPayload.credentialSubject?.id} does not match expected requester ${expectedRequesterId}` };
    }


    return verificationResult;
  }

  // Check if consent is still valid (assumes JWT VC with 'exp' claim)
  isConsentValid(credential: any): boolean {
    // This method might need to be re-evaluated if 'credential' is now a JWT string
    // or a decoded JWT object.
    // If it's a decoded JWT (from verifiedJwt.payload.vc), then it might have an expirationDate field.
    // If it's a JWT string, it needs to be verified first.
    // For now, let's assume this check is done after verifyConsentCredential.
    // did-jwt's verifyJWT already checks 'exp' and 'nbf' claims.
    if (credential && credential.verifiedJwt && credential.verifiedJwt.payload) {
        // If 'exp' is present, verifyJWT would have already checked it.
        // If 'expirationDate' is explicitly in the VC payload, check that.
        const vcExpDate = credential.verifiedJwt.payload.vc?.expirationDate;
        if (vcExpDate) {
            return new Date() < new Date(vcExpDate);
        }
        return true; // If no explicit expirationDate in VC and JWT exp passed, consider valid.
    }
    // Legacy check if an old format object is passed, though this should be phased out.
    const now = new Date();
    const expiresAt = new Date(credential.credentialSubject.expiresAt);
    return now < expiresAt;
  }
}

// Export service instances
export const didService = DIDService.getInstance();
export const vcService = new VCService();
export const ipfsService = new IPFSService();
export const consentService = new ConsentService();