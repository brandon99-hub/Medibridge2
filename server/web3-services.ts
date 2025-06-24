import { ethers } from "ethers";
import { Resolver } from "did-resolver";
import { createHash } from "crypto";
import { create } from "kubo-rpc-client";
import CryptoJS from "crypto-js";
import { v4 as uuidv4 } from "uuid";

// IPFS Configuration
const ipfs = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
});

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
    subjectDID: string,
    credentialType: string,
    credentialSubject: any,
    privateKey: string
  ) {
    const credential = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://www.w3.org/2018/credentials/examples/v1"
      ],
      "id": `urn:uuid:${uuidv4()}`,
      "type": ["VerifiableCredential", credentialType],
      "issuer": issuerDID,
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": subjectDID,
        ...credentialSubject
      }
    };

    // Create proof (simplified - in production use proper cryptographic signing)
    const proof = {
      "type": "Ed25519Signature2018",
      "created": new Date().toISOString(),
      "verificationMethod": `${issuerDID}#key-1`,
      "proofPurpose": "assertionMethod",
      "jws": this.createJWS(credential, privateKey)
    };

    return {
      ...credential,
      proof
    };
  }

  // Verify a verifiable credential
  async verifyCredential(credential: any): Promise<boolean> {
    try {
      // Simplified verification - in production use proper cryptographic verification
      return credential.proof && credential.proof.jws && credential.issuer;
    } catch (error) {
      console.error("Failed to verify credential:", error);
      return false;
    }
  }

  // Create JWT Web Signature (simplified)
  private createJWS(credential: any, privateKey: string): string {
    const header = { "alg": "EdDSA", "typ": "JWT" };
    const payload = credential;
    
    // Simplified signing - in production use proper EdDSA signing
    const data = JSON.stringify(header) + "." + JSON.stringify(payload);
    const signature = createHash('sha256').update(data + privateKey).digest('hex');
    
    return `${Buffer.from(JSON.stringify(header)).toString('base64')}.${Buffer.from(JSON.stringify(payload)).toString('base64')}.${signature}`;
  }
}

// IPFS Service for decentralized storage
export class IPFSService {
  // Store encrypted content on IPFS
  async storeContent(content: any, encryptionKey?: string): Promise<string> {
    try {
      let dataToStore = JSON.stringify(content);
      
      // Encrypt content if key provided
      if (encryptionKey) {
        dataToStore = CryptoJS.AES.encrypt(dataToStore, encryptionKey).toString();
      }

      const result = await ipfs.add(dataToStore);
      return result.cid.toString();
    } catch (error) {
      console.error("Failed to store content on IPFS:", error);
      throw new Error("IPFS storage failed");
    }
  }

  // Retrieve content from IPFS
  async retrieveContent(hash: string, encryptionKey?: string): Promise<any> {
    try {
      const chunks = [];
      for await (const chunk of ipfs.cat(hash)) {
        chunks.push(chunk);
      }
      
      let content = Buffer.concat(chunks).toString();
      
      // Decrypt content if key provided
      if (encryptionKey) {
        const bytes = CryptoJS.AES.decrypt(content, encryptionKey);
        content = bytes.toString(CryptoJS.enc.Utf8);
      }

      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to retrieve content from IPFS:", error);
      throw new Error("IPFS retrieval failed");
    }
  }

  // Pin content to ensure availability
  async pinContent(hash: string): Promise<void> {
    try {
      await ipfs.pin.add(hash);
    } catch (error) {
      console.error("Failed to pin content:", error);
    }
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
    patientDID: string,
    requesterDID: string,
    contentHash: string,
    consentType: string,
    patientPrivateKey: string
  ) {
    const credentialSubject = {
      requester: requesterDID,
      contentHash,
      consentType,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    return await this.vcService.issueCredential(
      patientDID,
      patientDID,
      "HealthcareConsent",
      credentialSubject,
      patientPrivateKey
    );
  }

  // Verify consent credential
  async verifyConsentCredential(credential: any): Promise<boolean> {
    return await this.vcService.verifyCredential(credential);
  }

  // Check if consent is still valid
  isConsentValid(credential: any): boolean {
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