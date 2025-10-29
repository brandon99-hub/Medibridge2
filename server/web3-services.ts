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
import { 
  Client, 
  TokenMintTransaction, 
  TokenId, 
  PrivateKey,
  TransferTransaction,
  TokenFreezeTransaction,
  TokenUnfreezeTransaction,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  ContractId,
  FileCreateTransaction,
  FileContentsQuery,
  FileId,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  ScheduleInfoQuery,
  ScheduleId,
  Timestamp
} from "@hashgraph/sdk";

// Pinata Configuration
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataJWT = process.env.PINATA_JWT;

const pinata = pinataJWT
  ? new PinataClient({ pinataJWTKey: pinataJWT })
  : new PinataClient(pinataApiKey!, pinataSecretApiKey!);

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// DID Service for managing decentralized identities (did:key + did:hedera)
export class DIDService {
  private static instance: DIDService;
  private resolver: Resolver;
  private hederaClient?: Client;
  private hederaEnabled: boolean = false;

  private constructor() {
    this.resolver = new Resolver({});
    this.initializeHedera();
  }

  static getInstance(): DIDService {
    if (!DIDService.instance) {
      DIDService.instance = new DIDService();
    }
    return DIDService.instance;
  }

  /**
   * Initialize Hedera client for DID operations
   */
  private initializeHedera(): void {
    try {
      if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
        this.hederaClient = Client.forTestnet();
        this.hederaClient.setOperator(
          process.env.HEDERA_OPERATOR_ID,
          process.env.HEDERA_OPERATOR_KEY
        );
        this.hederaEnabled = true;
        console.log('[HEDERA] DID service initialized');
      }
    } catch (error) {
      console.warn('[HEDERA] Failed to initialize DID service:', error);
      this.hederaEnabled = false;
    }
  }

  /**
   * Generate DID (supports both did:key and did:hedera)
   * @param publicKey Public key for the DID
   * @param useHedera If true, generates did:hedera; otherwise did:key
   * @param hederaAccountId Optional Hedera account ID for did:hedera
   */
  generateDID(publicKey: string, useHedera: boolean = false, hederaAccountId?: string): string {
    if (useHedera && this.hederaEnabled) {
      // Generate did:hedera format
      // Format: did:hedera:testnet:{accountId}_{publicKeyPrefix}
      const accountId = hederaAccountId || process.env.HEDERA_OPERATOR_ID || '0.0.0';
      const keyPrefix = publicKey.substring(0, 16);
      return `did:hedera:testnet:${accountId}_${keyPrefix}`;
    } else {
      // Generate did:key format (existing)
      const hash = createHash('sha256').update(publicKey).digest('hex');
      return `did:key:z${hash.substring(0, 32)}`;
    }
  }

  /**
   * Create DID Document (supports both formats)
   * @param did The DID identifier
   * @param publicKey Public key
   * @param hederaAccountId Optional Hedera account ID
   * @param hederaFileId Optional Hedera File ID where document is stored
   */
  createDIDDocument(did: string, publicKey: string, hederaAccountId?: string, hederaFileId?: string) {
    const baseDoc = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1"
      ],
      "id": did,
      "verificationMethod": [{
        "id": `${did}#key-1`,
        "type": "Ed25519VerificationKey2020",
        "controller": did,
        "publicKeyBase58": publicKey
      }],
      "authentication": [`${did}#key-1`],
      "assertionMethod": [`${did}#key-1`]
    };

    // Add Hedera-specific fields if it's a did:hedera
    if (did.startsWith('did:hedera:')) {
      return {
        ...baseDoc,
        "service": [
          {
            "id": `${did}#hedera-account`,
            "type": "HederaAccount",
            "serviceEndpoint": `https://testnet.mirrornode.hedera.com/api/v1/accounts/${hederaAccountId}`
          },
          ...(hederaFileId ? [{
            "id": `${did}#hedera-file`,
            "type": "HederaFile",
            "serviceEndpoint": `https://testnet.mirrornode.hedera.com/api/v1/files/${hederaFileId}`
          }] : [])
        ]
      };
    }

    return baseDoc;
  }

  /**
   * Anchor DID document on Hedera File Service (HFS)
   * @param did The DID identifier
   * @param didDocument The DID document to anchor
   * @returns Hedera File ID
   */
  async anchorDIDOnHedera(did: string, didDocument: any): Promise<string | null> {
    if (!this.hederaEnabled || !this.hederaClient) {
      console.warn('[HEDERA] Cannot anchor DID: Hedera not enabled');
      return null;
    }

    try {
      const documentJson = JSON.stringify(didDocument, null, 2);
      
      const transaction = new FileCreateTransaction()
        .setContents(documentJson)
        .setKeys([this.hederaClient.operatorPublicKey!])
        .setMaxTransactionFee(2); // 2 HBAR max

      const response = await transaction.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);
      const fileId = receipt.fileId!.toString();

      console.log(`[HEDERA] DID document anchored: ${fileId}`);
      return fileId;
    } catch (error) {
      console.error('[HEDERA] Failed to anchor DID document:', error);
      return null;
    }
  }

  /**
   * Retrieve DID document from Hedera File Service
   * @param fileId Hedera File ID
   * @returns DID document
   */
  async retrieveDIDFromHedera(fileId: string): Promise<any | null> {
    if (!this.hederaEnabled || !this.hederaClient) {
      return null;
    }

    try {
      const query = new FileContentsQuery()
        .setFileId(FileId.fromString(fileId));

      const contents = await query.execute(this.hederaClient);
      const documentJson = new TextDecoder().decode(contents);
      return JSON.parse(documentJson);
    } catch (error) {
      console.error('[HEDERA] Failed to retrieve DID document:', error);
      return null;
    }
  }

  /**
   * Resolve DID to get DID Document (supports both did:key and did:hedera)
   */
  async resolveDID(did: string) {
    try {
      // If it's a did:hedera, try to resolve from Hedera first
      if (did.startsWith('did:hedera:') && this.hederaEnabled) {
        // Extract file ID from service endpoint if available
        // For now, use standard resolver
        const result = await this.resolver.resolve(did);
        return result.didDocument;
      }
      
      // Standard resolution for did:key and other methods
      const result = await this.resolver.resolve(did);
      return result.didDocument;
    } catch (error) {
      console.error("Failed to resolve DID:", error);
      return null;
    }
  }

  /**
   * Check if DID is a Hedera DID
   */
  isHederaDID(did: string): boolean {
    return did.startsWith('did:hedera:');
  }

  /**
   * Check if DID is a key DID
   */
  isKeyDID(did: string): boolean {
    return did.startsWith('did:key:');
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

// Patient Consent Service using Verifiable Credentials + Smart Contracts
export class ConsentService {
  private vcService: VCService;
  private didService: DIDService;
  private hederaClient?: Client;
  private consentContractId?: ContractId;
  private hederaEnabled: boolean = false;

  constructor() {
    this.vcService = new VCService();
    this.didService = DIDService.getInstance();
    this.initializeHedera();
  }

  /**
   * Initialize Hedera client and smart contract
   */
  private initializeHedera(): void {
    try {
      if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
        this.hederaClient = Client.forTestnet();
        this.hederaClient.setOperator(
          process.env.HEDERA_OPERATOR_ID,
          process.env.HEDERA_OPERATOR_KEY
        );

        // Load consent contract ID if deployed
        if (process.env.HEDERA_CONSENT_CONTRACT_ID) {
          this.consentContractId = ContractId.fromString(process.env.HEDERA_CONSENT_CONTRACT_ID);
        }

        this.hederaEnabled = true;
        console.log('[HEDERA] Consent service initialized with smart contract');
      }
    } catch (error) {
      console.warn('[HEDERA] Failed to initialize consent smart contract:', error);
      this.hederaEnabled = false;
    }
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

    // Issue verifiable credential (off-chain)
    const jwtVc = await this.vcService.issueCredential(
      patientDID,         // issuer: patient's DID
      requesterId,       // subject: hospital's DID (who is granted access)
      "HealthcareConsent",// credentialType
      credentialSubject,  // claims
      patientPrivateKeyHex, // patient's private key from vault
      30 * 24             // expiresInHours (e.g., 30 days)
    );

    // Also record on smart contract (on-chain)
    if (this.hederaEnabled && this.consentContractId) {
      try {
        await this.grantConsentOnChain(
          patientDID,
          requesterId,
          contentHash,
          30 * 24 * 3600 // 30 days in seconds
        );
      } catch (error) {
        console.error('[HEDERA] Failed to record consent on-chain:', error);
        // Don't fail the whole operation if on-chain fails
      }
    }

    return jwtVc;
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

  /**
   * Grant consent on smart contract (on-chain)
   */
  private async grantConsentOnChain(
    patientDID: string,
    hospitalDID: string,
    recordHash: string,
    durationSeconds: number
  ): Promise<string> {
    if (!this.hederaClient || !this.consentContractId) {
      throw new Error('Smart contract not initialized');
    }

    try {
      const transaction = new ContractExecuteTransaction()
        .setContractId(this.consentContractId)
        .setGas(300000)
        .setFunction(
          "grantConsent",
          new ContractFunctionParameters()
            .addString(patientDID)
            .addString(hospitalDID)
            .addString(recordHash)
            .addUint256(durationSeconds)
        );

      const response = await transaction.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);

      console.log(`[HEDERA] Consent granted on-chain: ${response.transactionId.toString()}`);
      return response.transactionId.toString();
    } catch (error) {
      console.error('[HEDERA] Failed to grant consent on-chain:', error);
      throw error;
    }
  }

  /**
   * Revoke consent on smart contract (on-chain)
   */
  async revokeConsentOnChain(
    patientDID: string,
    hospitalDID: string,
    recordHash: string
  ): Promise<string> {
    if (!this.hederaClient || !this.consentContractId) {
      throw new Error('Smart contract not initialized');
    }

    try {
      const transaction = new ContractExecuteTransaction()
        .setContractId(this.consentContractId)
        .setGas(200000)
        .setFunction(
          "revokeConsent",
          new ContractFunctionParameters()
            .addString(patientDID)
            .addString(hospitalDID)
            .addString(recordHash)
        );

      const response = await transaction.execute(this.hederaClient);
      await response.getReceipt(this.hederaClient);

      console.log(`[HEDERA] Consent revoked on-chain: ${response.transactionId.toString()}`);
      return response.transactionId.toString();
    } catch (error) {
      console.error('[HEDERA] Failed to revoke consent on-chain:', error);
      throw error;
    }
  }

  /**
   * Check consent on smart contract (trustless verification)
   */
  async checkConsentOnChain(
    patientDID: string,
    hospitalDID: string,
    recordHash: string
  ): Promise<boolean> {
    if (!this.hederaClient || !this.consentContractId) {
      return false; // Fallback to off-chain check
    }

    try {
      const query = new ContractCallQuery()
        .setContractId(this.consentContractId)
        .setGas(100000)
        .setFunction(
          "hasValidConsent",
          new ContractFunctionParameters()
            .addString(patientDID)
            .addString(hospitalDID)
            .addString(recordHash)
        );

      const result = await query.execute(this.hederaClient);
      const hasConsent = result.getBool(0);

      console.log(`[HEDERA] On-chain consent check: ${hasConsent}`);
      return hasConsent;
    } catch (error) {
      console.error('[HEDERA] Failed to check consent on-chain:', error);
      return false;
    }
  }

  /**
   * Batch check multiple consents on smart contract
   */
  async batchCheckConsentOnChain(
    patientDID: string,
    hospitalDID: string,
    recordHashes: string[]
  ): Promise<boolean[]> {
    if (!this.hederaClient || !this.consentContractId) {
      return recordHashes.map(() => false);
    }

    try {
      const params = new ContractFunctionParameters()
        .addString(patientDID)
        .addString(hospitalDID)
        .addStringArray(recordHashes);

      const query = new ContractCallQuery()
        .setContractId(this.consentContractId)
        .setGas(200000)
        .setFunction("batchCheckConsent", params);

      const result = await query.execute(this.hederaClient);
      
      // Parse boolean array result
      const results: boolean[] = [];
      for (let i = 0; i < recordHashes.length; i++) {
        results.push(result.getBool(i));
      }

      console.log(`[HEDERA] Batch consent check: ${results.filter(r => r).length}/${recordHashes.length} valid`);
      return results;
    } catch (error) {
      console.error('[HEDERA] Failed to batch check consents:', error);
      return recordHashes.map(() => false);
    }
  }

  /**
   * Schedule automatic consent revocation (Hedera Scheduled Transactions)
   * @param patientDID Patient's DID
   * @param hospitalDID Hospital's DID
   * @param recordHash Record hash
   * @param expiryDate When to automatically revoke
   * @returns Schedule ID
   */
  async scheduleConsentRevocation(
    patientDID: string,
    hospitalDID: string,
    recordHash: string,
    expiryDate: Date
  ): Promise<string | null> {
    if (!this.hederaClient || !this.consentContractId) {
      console.warn('[HEDERA] Cannot schedule revocation: smart contract not initialized');
      return null;
    }

    try {
      // Create the revocation transaction (but don't execute yet)
      const revokeTransaction = new ContractExecuteTransaction()
        .setContractId(this.consentContractId)
        .setGas(200000)
        .setFunction(
          "revokeConsent",
          new ContractFunctionParameters()
            .addString(patientDID)
            .addString(hospitalDID)
            .addString(recordHash)
        );

      // Schedule it to execute at expiry date
      const scheduleTransaction = new ScheduleCreateTransaction()
        .setScheduledTransaction(revokeTransaction)
        .setScheduleMemo(`Auto-revoke consent: ${patientDID} -> ${hospitalDID}`)
        .setExpirationTime(Timestamp.fromDate(new Date(expiryDate.getTime() + 24 * 60 * 60 * 1000))); // Schedule expires 24h after execution time

      const response = await scheduleTransaction.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);
      const scheduleId = receipt.scheduleId!.toString();

      console.log(`[HEDERA] Scheduled consent revocation: ${scheduleId} at ${expiryDate.toISOString()}`);
      return scheduleId;
    } catch (error) {
      console.error('[HEDERA] Failed to schedule consent revocation:', error);
      return null;
    }
  }

  /**
   * Cancel scheduled consent revocation
   * @param scheduleId Schedule ID to cancel
   */
  async cancelScheduledRevocation(scheduleId: string): Promise<boolean> {
    if (!this.hederaClient) {
      return false;
    }

    try {
      // Note: Hedera doesn't support direct schedule deletion
      // Instead, we can check if it's already executed or expired
      const query = new ScheduleInfoQuery()
        .setScheduleId(ScheduleId.fromString(scheduleId));

      const info = await query.execute(this.hederaClient);
      
      if (info.executed) {
        console.log(`[HEDERA] Schedule ${scheduleId} already executed`);
        return false;
      }

      // To "cancel", we'd need to revoke consent manually before the schedule executes
      console.log(`[HEDERA] Schedule ${scheduleId} is pending. Revoke consent manually to prevent execution.`);
      return true;
    } catch (error) {
      console.error('[HEDERA] Failed to check schedule status:', error);
      return false;
    }
  }

  /**
   * Get scheduled transaction status
   * @param scheduleId Schedule ID
   */
  async getScheduleStatus(scheduleId: string): Promise<{
    executed: boolean;
    executedAt?: Date;
    expirationTime?: Date;
    memo?: string;
  } | null> {
    if (!this.hederaClient) {
      return null;
    }

    try {
      const query = new ScheduleInfoQuery()
        .setScheduleId(ScheduleId.fromString(scheduleId));

      const info = await query.execute(this.hederaClient);

      return {
        executed: !!info.executed,
        executedAt: info.executed ? new Date() : undefined,
        expirationTime: info.expirationTime ? new Date(info.expirationTime.toDate()) : undefined,
        memo: info.scheduleMemo || undefined
      };
    } catch (error) {
      console.error('[HEDERA] Failed to get schedule status:', error);
      return null;
    }
  }

  /**
   * Issue consent with automatic scheduled revocation
   * @param patientDID Patient's DID
   * @param requesterId Hospital's DID
   * @param contentHash Record hash
   * @param consentType Type of consent
   * @param expiryDate When consent should auto-expire
   */
  async issueConsentWithScheduledRevocation(
    patientDID: string,
    requesterId: string,
    contentHash: string,
    consentType: string,
    expiryDate: Date
  ): Promise<{ jwtVc: string; scheduleId: string | null }> {
    // Issue consent credential normally
    const jwtVc = await this.issueConsentCredential(
      patientDID,
      requesterId,
      contentHash,
      consentType
    );

    // Schedule automatic revocation
    const scheduleId = await this.scheduleConsentRevocation(
      patientDID,
      requesterId,
      contentHash,
      expiryDate
    );

    if (scheduleId) {
      console.log(`[HEDERA] Consent issued with scheduled revocation at ${expiryDate.toISOString()}`);
    }

    return { jwtVc, scheduleId };
  }
}

// Medical Record NFT Service using Hedera Token Service (HTS)
export class MedicalRecordNFTService {
  private static instance: MedicalRecordNFTService;
  private hederaClient?: Client;
  private nftTokenId?: TokenId;
  private supplyKey?: PrivateKey;
  private freezeKey?: PrivateKey;
  private hederaEnabled: boolean = false;

  private constructor() {
    this.initializeHedera();
  }

  static getInstance(): MedicalRecordNFTService {
    if (!MedicalRecordNFTService.instance) {
      MedicalRecordNFTService.instance = new MedicalRecordNFTService();
    }
    return MedicalRecordNFTService.instance;
  }

  /**
   * Initialize Hedera client and load NFT token
   */
  private initializeHedera(): void {
    try {
      if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
        this.hederaClient = Client.forTestnet();
        this.hederaClient.setOperator(
          process.env.HEDERA_OPERATOR_ID,
          process.env.HEDERA_OPERATOR_KEY
        );

        // Load NFT token ID
        if (process.env.HEDERA_MEDICAL_NFT_TOKEN_ID) {
          this.nftTokenId = TokenId.fromString(process.env.HEDERA_MEDICAL_NFT_TOKEN_ID);
        }

        // Load keys
        if (process.env.HEDERA_NFT_SUPPLY_KEY) {
          this.supplyKey = PrivateKey.fromString(process.env.HEDERA_NFT_SUPPLY_KEY);
        }
        if (process.env.HEDERA_NFT_FREEZE_KEY) {
          this.freezeKey = PrivateKey.fromString(process.env.HEDERA_NFT_FREEZE_KEY);
        }

        this.hederaEnabled = true;
        console.log('[HEDERA] Medical Record NFT service initialized');
      }
    } catch (error) {
      console.warn('[HEDERA] Failed to initialize NFT service:', error);
      this.hederaEnabled = false;
    }
  }

  /**
   * Mint NFT for medical record (NFT = pointer, not duplicate storage)
   * Returns NFT serial number and token ID
   */
  async mintMedicalRecordNFT(metadata: {
    patientDID: string;
    recordId: number;
    ipfsCID: string;
    encryptionKeyHash: string;
    hospitalDID: string;
    recordType: string;
  }): Promise<{ tokenId: string; serialNumber: number } | null> {
    if (!this.hederaEnabled || !this.hederaClient || !this.nftTokenId || !this.supplyKey) {
      console.warn('[HEDERA] NFT service not enabled, skipping mint');
      return null;
    }

    try {
      // Create minimal metadata (NFT as pointer, not storage)
      const nftMetadata = JSON.stringify({
        recordId: metadata.recordId,          // Reference to PostgreSQL
        ipfsCID: metadata.ipfsCID,            // Reference to IPFS
        encryptionKeyHash: metadata.encryptionKeyHash, // Hash only, not key
        patientDID: metadata.patientDID,
        hospitalDID: metadata.hospitalDID,
        recordType: metadata.recordType,
        createdAt: new Date().toISOString(),
        version: '1.0'
      });

      const transaction = new TokenMintTransaction()
        .setTokenId(this.nftTokenId)
        .setMetadata([Buffer.from(nftMetadata)])
        .freezeWith(this.hederaClient);

      const signedTx = await transaction.sign(this.supplyKey);
      const response = await signedTx.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);

      const serialNumber = receipt.serials[0].toNumber();

      console.log(`[HEDERA] Minted NFT: ${this.nftTokenId.toString()}/${serialNumber} for record ${metadata.recordId}`);

      return {
        tokenId: this.nftTokenId.toString(),
        serialNumber
      };
    } catch (error) {
      console.error('[HEDERA] Failed to mint NFT:', error);
      return null;
    }
  }

  /**
   * Transfer NFT to grant consent (NFT transfer = access grant)
   */
  async transferNFT(
    serialNumber: number,
    fromAccountId: string,
    toAccountId: string
  ): Promise<boolean> {
    if (!this.hederaEnabled || !this.hederaClient || !this.nftTokenId) {
      return false;
    }

    try {
      const transaction = new TransferTransaction()
        .addNftTransfer(
          this.nftTokenId,
          serialNumber,
          AccountId.fromString(fromAccountId),
          AccountId.fromString(toAccountId)
        );

      const response = await transaction.execute(this.hederaClient);
      await response.getReceipt(this.hederaClient);

      console.log(`[HEDERA] Transferred NFT ${serialNumber} from ${fromAccountId} to ${toAccountId}`);
      return true;
    } catch (error) {
      console.error('[HEDERA] Failed to transfer NFT:', error);
      return false;
    }
  }

  /**
   * Freeze NFT to revoke consent
   */
  async freezeNFT(accountId: string): Promise<boolean> {
    if (!this.hederaEnabled || !this.hederaClient || !this.nftTokenId || !this.freezeKey) {
      return false;
    }

    try {
      const transaction = new TokenFreezeTransaction()
        .setTokenId(this.nftTokenId)
        .setAccountId(AccountId.fromString(accountId))
        .freezeWith(this.hederaClient);

      const signedTx = await transaction.sign(this.freezeKey);
      const response = await signedTx.execute(this.hederaClient);
      await response.getReceipt(this.hederaClient);

      console.log(`[HEDERA] Froze NFT for account ${accountId}`);
      return true;
    } catch (error) {
      console.error('[HEDERA] Failed to freeze NFT:', error);
      return false;
    }
  }

  /**
   * Unfreeze NFT to restore consent
   */
  async unfreezeNFT(accountId: string): Promise<boolean> {
    if (!this.hederaEnabled || !this.hederaClient || !this.nftTokenId || !this.freezeKey) {
      return false;
    }

    try {
      const transaction = new TokenUnfreezeTransaction()
        .setTokenId(this.nftTokenId)
        .setAccountId(AccountId.fromString(accountId))
        .freezeWith(this.hederaClient);

      const signedTx = await transaction.sign(this.freezeKey);
      const response = await signedTx.execute(this.hederaClient);
      await response.getReceipt(this.hederaClient);

      console.log(`[HEDERA] Unfroze NFT for account ${accountId}`);
      return true;
    } catch (error) {
      console.error('[HEDERA] Failed to unfreeze NFT:', error);
      return false;
    }
  }

  /**
   * Query NFT metadata from Hedera Mirror Node
   */
  async getNFTMetadata(serialNumber: number): Promise<any | null> {
    if (!this.nftTokenId) return null;

    try {
      const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';
      const response = await fetch(
        `${mirrorNodeUrl}/api/v1/tokens/${this.nftTokenId.toString()}/nfts/${serialNumber}`
      );

      if (!response.ok) return null;

      const data: any = await response.json();
      const metadata = Buffer.from(data.metadata, 'base64').toString();
      return JSON.parse(metadata);
    } catch (error) {
      console.error('[HEDERA] Failed to query NFT metadata:', error);
      return null;
    }
  }
}

// Export service instances
export const didService = DIDService.getInstance();
export const vcService = new VCService();
export const ipfsService = new IPFSService();
export const consentService = new ConsentService();
export const medicalRecordNFTService = MedicalRecordNFTService.getInstance();