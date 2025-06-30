import type { Express, Request } from "express"; // Added Request
import { storage } from "./storage";
import { didService, vcService, ipfsService, consentService, WalletService } from "./web3-services";
import { secureKeyVault } from "./secure-key-vault"; // Import SecureKeyVault
import { z } from "zod";
import CryptoJS from "crypto-js";
import Hex from "crypto-js/enc-hex.js";
import { requirePatientAuth } from "./patient-auth-middleware"; // Import the middleware

export function registerWeb3Routes(app: Express): void {
  
  // Generate Patient DID and Identity
  app.post("/api/web3/generate-patient-identity", async (req, res, next) => {
    try {
      const { walletAddress } = z.object({
        walletAddress: z.string().optional(),
      }).parse(req.body);

      // Generate wallet if not provided
      let wallet = null;
      if (!walletAddress) {
        wallet = WalletService.generateWallet();
      }

      const publicKey = wallet ? wallet.publicKey : `pub_${Date.now()}`;
      const did = didService.generateDID(publicKey);
      const didDocument = didService.createDIDDocument(did, publicKey);

      // Store patient identity
      const patientIdentity = await storage.createPatientIdentity({
        did,
        walletAddress: walletAddress || wallet?.address,
        publicKey,
        didDocument,
      });

      res.json({
        success: true,
        identity: patientIdentity,
        wallet: wallet ? {
          address: wallet.address,
          mnemonic: wallet.mnemonic
        } : null
      });
    } catch (error) {
      next(error);
    }
  });

  // Submit Medical Record to IPFS with Phone Number
  app.post("/api/web3/submit-record", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "A") {
        return res.status(403).json({ message: "Only Hospital A can submit records" });
      }

      const recordData = z.object({
        phoneNumber: z.string(),
        patientName: z.string(),
        nationalId: z.string(),
        visitDate: z.string(),
        visitType: z.string().optional(),
        diagnosis: z.string(),
        prescription: z.string().optional(),
        physician: z.string().optional(),
        department: z.string().optional(),
      }).parse(req.body);

      // Find patient profile by phone or email
      let patientProfile = await storage.findPatientProfileByEmailOrPhone(
        recordData.phoneNumber.includes('@') ? recordData.phoneNumber : undefined,
        !recordData.phoneNumber.includes('@') ? recordData.phoneNumber : undefined
      );
      if (patientProfile) {
        // If the profile is missing this identifier, update it
        if (!patientProfile.phoneNumber && !recordData.phoneNumber.includes('@')) {
          await storage.updatePatientProfileIdentifiers(patientProfile.patientDID, { phoneNumber: recordData.phoneNumber });
        }
        if (!patientProfile.email && recordData.phoneNumber.includes('@')) {
          await storage.updatePatientProfileIdentifiers(patientProfile.patientDID, { email: recordData.phoneNumber });
        }
        // Re-fetch updated profile
        patientProfile = await storage.getPatientProfileByDID(patientProfile.patientDID);
      } else {
        // Check by nationalId
        patientProfile = await storage.getPatientProfileByNationalId(recordData.nationalId);
        if (!patientProfile) {
          // Auto-generate DID for patient using phone number
          const publicKey = `pub_${recordData.phoneNumber}_${Date.now()}`;
          const did = didService.generateDID(publicKey);
          const didDocument = didService.createDIDDocument(did, publicKey);

          // Create patient identity and profile
          await storage.createPatientIdentity({
            did,
            phoneNumber: recordData.phoneNumber,
            walletAddress: null,
            publicKey,
            didDocument,
          });
          patientProfile = await storage.createPatientProfile({
            patientDID: did,
            nationalId: recordData.nationalId,
            phoneNumber: recordData.phoneNumber.includes('@') ? "" : recordData.phoneNumber,
            email: recordData.phoneNumber.includes('@') ? recordData.phoneNumber : null,
            fullName: recordData.patientName,
            isProfileComplete: false,
          });
        }
      }

      const patientDID = patientProfile.patientDID;

      // Prepare medical record for IPFS storage
      const medicalRecord = {
        patientDID,
        patientName: recordData.patientName,
        visitDate: recordData.visitDate,
        visitType: recordData.visitType,
        diagnosis: recordData.diagnosis,
        prescription: recordData.prescription,
        physician: recordData.physician,
        department: recordData.department,
        submittedBy: user.hospitalName,
        submittedAt: new Date().toISOString(),
      };

      // Store encrypted record on IPFS
      const plaintextEncryptionKey = CryptoJS.lib.WordArray.random(256/8).toString(Hex); // Generate as hex
      const ipfsHash = await ipfsService.storeContent(medicalRecord, plaintextEncryptionKey);
      await ipfsService.pinContent(ipfsHash);

      // Encrypt the plaintextEncryptionKey using SecureKeyVault
      const encryptedDekString = await secureKeyVault.encryptDataKey(plaintextEncryptionKey);

      // Store IPFS content reference
      const ipfsContentRecord = await storage.createIpfsContent({
        contentHash: ipfsHash,
        patientDID,
        contentType: "medical_record",
        encryptionMethod: "AES-256-GCM",
        size: JSON.stringify(medicalRecord).length,
        accessControlList: {
          owner: patientDID,
          authorizedHospitals: [user.hospitalName]
        }
      });

      // Store traditional record with IPFS reference
      const patientRecord = await storage.createPatientRecord({
        patientName: recordData.patientName,
        nationalId: recordData.nationalId,
        visitDate: recordData.visitDate,
        visitType: recordData.visitType,
        diagnosis: recordData.diagnosis,
        prescription: recordData.prescription,
        physician: recordData.physician,
        department: recordData.department,
        patientDID,
        submittedBy: user.id,
      });

      // Update the record with ipfsHash and encryptionKey
      await storage.updateRecordIPFS(patientRecord.id, ipfsHash, encryptedDekString);

      res.status(201).json({
        success: true,
        message: "Medical record stored on IPFS with patient phone lookup",
        recordId: patientRecord.id,
        ipfsHash,
        patientDID,
        phoneNumber: recordData.phoneNumber
      });
    } catch (error) {
      next(error);
    }
  });

  // Request Access to Patient Records via DID
  app.post("/api/web3/request-access", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can request access" });
      }

      const { patientDID } = z.object({
        patientDID: z.string(),
      }).parse(req.body);

      // Verify patient identity exists
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity) {
        return res.status(404).json({ message: "Patient DID not found" });
      }

      // Get patient's IPFS content
      const patientContent = await storage.getContentByPatientDID(patientDID);
      
      if (patientContent.length === 0) {
        return res.status(404).json({ message: "No medical records found for this patient" });
      }

      // Return metadata for consent process (without actual content)
      const recordMetadata = patientContent.map(content => ({
        contentHash: content.contentHash,
        contentType: content.contentType,
        size: content.size,
        createdAt: content.createdAt,
      }));

      res.json({
        success: true,
        patientDID,
        patientIdentity: {
          did: patientIdentity.did,
          walletAddress: patientIdentity.walletAddress,
        },
        recordCount: patientContent.length,
        recordMetadata,
        message: "Patient consent required to access medical records"
      });
    } catch (error) {
      next(error);
    }
  });

  // Grant Consent via Verifiable Credential
  // This route is now intended for wallet-based signature authorization
  app.post("/api/web3/grant-consent", async (req: Request, res, next) => {
    try {
      const { patientDID, requesterId, contentHashes, consentType, patientSignature } = z.object({
        patientDID: z.string(),
        requesterId: z.string(),
        contentHashes: z.array(z.string()),
        consentType: z.string(),
        patientSignature: z.string(), // Signature from patient's wallet
      }).parse(req.body);

      // Verify patient identity
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity || !patientIdentity.walletAddress) {
        return res.status(404).json({ message: "Patient DID not found or no wallet address associated." });
      }

      // Construct the message that was signed on the frontend
      // IMPORTANT: This must exactly match the message signed on the frontend.
      // OMITTING TIMESTAMP for now for simplicity, but this is a security weakness.
      const messageToVerify = `I, ${patientDID}, authorize granting ${consentType} consent to ${requesterId} for the following content hashes: ${contentHashes.join(', ')}.`;
      // const messageToVerify = `I, ${patientDID}, authorize granting ${consentType} consent to ${requesterId} for the following content hashes: ${contentHashes.join(', ')}. Timestamp: ${SOME_TIMESTAMP_IF_PASSED_FROM_CLIENT}`;


      const isValidSignature = WalletService.verifySignature(
        messageToVerify,
        patientSignature,
        patientIdentity.walletAddress
      );

      if (!isValidSignature) {
        return res.status(401).json({ message: "Invalid patient signature." });
      }

      // Issue consent credential for each content hash
      const issuedJwtVCs = [];
      for (const contentHash of contentHashes) {
        // `consentService.issueConsentCredential` now retrieves the private key from SecureKeyVault
        const jwtVc = await consentService.issueConsentCredential(
          patientDID,     // Patient (issuer)
          requesterId,   // Hospital (subject of consent)
          contentHash,
          consentType
          // Private key is handled internally by consentService via SecureKeyVault
        );

        // Store credential JWT
        // We need to parse the JWT to get exp and iat if we want to store them separately.
        // For now, storage.createVerifiableCredential can take them as optional.
        // The `verifiableCredentials` table now has `jwtVc` instead of `proof` and `credentialSubject`.
        const storedCredential = await storage.createVerifiableCredential({
          patientDID,
          issuerDID: patientDID, // Patient is the issuer of their consent
          credentialType: "HealthcareConsent",
          jwtVc: jwtVc,
          // expirationDate can be parsed from JWT if needed for the DB column
        });

        // Create consent management record
        await storage.createConsentManagement({
          patientDID,
          requesterId,
          contentHash,
          consentType,
          consentGiven: true,
          consentCredentialId: storedCredential.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        issuedJwtVCs.push(storedCredential);
      }

      res.json({
        success: true,
        message: "Consent granted via verifiable credentials",
        consentCredentials: issuedJwtVCs.length,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Access Patient Records with Consent Verification
  app.post("/api/web3/access-records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { patientDID, requesterId } = z.object({
        patientDID: z.string(),
        requesterId: z.string(),
      }).parse(req.body);

      // Verify consent exists and is valid
      const consents = await storage.getConsentByPatientAndRequester(patientDID, requesterId);
      const validConsents = consents.filter(consent => 
        consent.consentGiven && 
        (!consent.revokedAt) &&
        (!consent.expiresAt || new Date() < consent.expiresAt)
      );

      if (validConsents.length === 0) {
        return res.status(403).json({ message: "No valid consent found for accessing patient records" });
      }

      // Get patient's records from IPFS
      const patientRecords = await storage.getPatientRecordsByDID(patientDID);
      const accessibleRecords = [];

      for (const record of patientRecords) {
        if (record.ipfsHash && record.encryptionKey) {
          try {
            // Decrypt the DEK from the record using SecureKeyVault
            const plaintextEncryptionKey = await secureKeyVault.decryptDataKey(record.encryptionKey);

            // Retrieve and decrypt content from IPFS using the plaintext DEK
            const decryptedContent = await ipfsService.retrieveContent(
              record.ipfsHash, 
              plaintextEncryptionKey
            );
            
            accessibleRecords.push({
              id: record.id,
              recordData: decryptedContent,
              ipfsHash: record.ipfsHash,
              submittedAt: record.submittedAt,
            });
          } catch (error) {
            console.error(`Failed to retrieve record ${record.id} from IPFS:`, error);
          }
        }
      }

      res.json({
        success: true,
        patientDID,
        recordCount: accessibleRecords.length,
        records: accessibleRecords,
        consentVerified: true,
        accessedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Revoke Patient Consent
  app.post("/api/web3/revoke-consent", async (req, res, next) => {
    try {
      const { patientDID, requesterId, patientSignature } = z.object({
        patientDID: z.string(),
        requesterId: z.string(),
        patientSignature: z.string(),
      }).parse(req.body);

      // Verify patient identity and signature
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity || !patientIdentity.walletAddress) {
        return res.status(404).json({ message: "Patient DID not found or no wallet address associated." });
      }

      // Construct the message that was signed on the frontend
      // IMPORTANT: This must exactly match the message signed on the frontend.
      // OMITTING TIMESTAMP for now for simplicity.
      const messageToVerify = `I, ${patientDID}, authorize revoking any consent previously granted to ${requesterId}.`;
      // const messageToVerify = `I, ${patientDID}, authorize revoking any consent previously granted to ${requesterId}. Timestamp: ${SOME_TIMESTAMP_IF_PASSED_FROM_CLIENT}`;

      const isValidSignature = WalletService.verifySignature(
        messageToVerify,
        patientSignature,
        patientIdentity.walletAddress
      );

      if (!isValidSignature) {
        return res.status(401).json({ message: "Invalid patient signature for revocation." });
      }

      // Get and revoke all consents
      const consents = await storage.getConsentByPatientAndRequester(patientDID, requesterId);
      for (const consent of consents) {
        await storage.revokeConsent(consent.id);
        if (consent.consentCredentialId) {
          await storage.revokeCredential(consent.consentCredentialId);
        }
      }

      res.json({
        success: true,
        message: "Consent revoked successfully",
        revokedConsents: consents.length,
        revokedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Get Patient's Web3 Dashboard
  app.get("/api/web3/patient-dashboard/:did", async (req, res, next) => {
    try {
      const { did } = req.params;

      const patientIdentity = await storage.getPatientIdentityByDID(did);
      if (!patientIdentity) {
        return res.status(404).json({ message: "Patient DID not found" });
      }

      const [content, credentials, consents] = await Promise.all([
        storage.getContentByPatientDID(did),
        storage.getCredentialsByPatientDID(did),
        storage.getConsentByPatientAndRequester(did, ""),
      ]);

      res.json({
        success: true,
        patientIdentity,
        medicalRecords: content.length,
        verifiableCredentials: credentials.length,
        activeConsents: consents.filter(c => c.consentGiven && !c.revokedAt).length,
        totalConsents: consents.length,
      });
    } catch (error) {
      next(error);
    }
  });
}