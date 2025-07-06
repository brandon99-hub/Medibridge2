import type { Express, Request } from "express"; // Added Request
import { storage } from "./storage";
import { didService, vcService, ipfsService, consentService, WalletService } from "./web3-services";
import { secureKeyVault } from "./secure-key-vault"; // Import SecureKeyVault
import { enhancedStorageService } from "./enhanced-storage-service"; // Import EnhancedStorageService
import { z } from "zod";
import CryptoJS from "crypto-js";
import Hex from "crypto-js/enc-hex.js";
import { requirePatientAuth } from "./patient-auth-middleware"; // Import the middleware
import { InsertPatientRecord } from "@shared/schema";

export function registerWeb3Routes(app: Express): void {
  
  // Generate Patient DID and Identity
  app.post("/api/web3/generate-patient-identity", async (req, res) => {
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
    } catch (error: any) {
      return res.status(400).json({ error: `Failed to generate patient identity: ${error.message}` });
    }
  });

  // Submit Medical Record to IPFS with Phone Number
  app.post("/api/web3/submit-record", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required. Please log in to submit medical records." });
      }

      const user = req.user!;
      if (user.hospitalType !== "A") {
        return res.status(403).json({ error: "Only Hospital A can submit records. Your hospital type does not have permission for this action." });
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
        
        // CRITICAL FIX: Ensure patient identity exists and has phone number synced
        await storage.updatePatientIdentityPhoneNumber(patientProfile.patientDID, patientProfile.phoneNumber || recordData.phoneNumber);
        
        // Ensure private key exists for existing patients (for ZKP compatibility)
        try {
          await secureKeyVault.retrievePatientKey(patientProfile.patientDID);
          console.log('[DEBUG] Patient key found for existing patient:', patientProfile.patientDID);
        } catch (error) {
          console.log('[DEBUG] Patient key not found, generating for existing patient:', patientProfile.patientDID);
          // Generate and store private key for existing patient
          const wallet = WalletService.generateWallet();
          const privateKey = wallet.privateKey;
          const patientSalt = `patient_${recordData.phoneNumber}_${Date.now()}`;
          await secureKeyVault.storePatientKey(patientProfile.patientDID, privateKey, patientSalt);
          
          // Note: Patient identity wallet address update not implemented - not critical for ZKP
        }
      } else {
        // Check by nationalId
        patientProfile = await storage.getPatientProfileByNationalId(recordData.nationalId);
        if (!patientProfile) {
          return res.status(400).json({ 
            error: "Patient not found. Patient must be registered in the system before medical records can be submitted.",
            requiresRegistration: true,
            message: "Please ensure the patient has completed registration via phone/email before submitting medical records."
          });
        }
        
        // CRITICAL FIX: Ensure patient identity exists and has phone number synced
        await storage.updatePatientIdentityPhoneNumber(patientProfile.patientDID, patientProfile.phoneNumber || recordData.phoneNumber);
      }

      const patientDID = patientProfile.patientDID;

      // Prepare medical record for storage
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

      // Store with triple redundancy (IPFS + Filecoin + Local)
      const storageResult = await enhancedStorageService.storeWithTripleRedundancy(
        medicalRecord,
        { 
          recordType: 'medical_record',
          accessPattern: 'frequent',
          hospitalId: user.id,
          hospitalName: user.hospitalName
        },
        patientDID
      );

      // Store traditional record with storage references
      const recordToSave = {
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
        hospital_id: user.hospital_id || 1, // Ensure hospital_id is not null
        recordType: "web3",
      };
      console.log('[DEBUG] Creating Web3 record with data:', recordToSave);
      const patientRecord = await storage.createPatientRecord(recordToSave);
      console.log('[DEBUG] Web3 record created with ID:', patientRecord.id, 'recordType:', patientRecord.recordType);

      // Generate and store Medical Record VC
      try {
        const { VCService } = require("./web3-services");
        const vcService = new VCService();
        const issuer = user.hospital_id ? user.hospital_id.toString() : "medibridge";
        const subject = patientDID;
        const credentialType = "MedicalRecord";
        const credentialSubject = {
          recordId: patientRecord.id,
          patientDID,
          patientName: recordData.patientName,
          visitDate: recordData.visitDate,
          diagnosis: recordData.diagnosis,
          prescription: recordData.prescription,
          physician: recordData.physician,
          department: recordData.department,
          hospitalId: user.hospital_id,
          hospitalName: user.hospitalName,
        };
        // TODO: Use a real private key for signing (replace 'dummy_private_key')
        const privateKeyHex = process.env.HOSPITAL_VC_PRIVATE_KEY || "dummy_private_key";
        const medicalRecordVcJwt = await vcService.issueCredential(
          issuer,
          subject,
          credentialType,
          credentialSubject,
          privateKeyHex
        );
        await storage.createVerifiableCredential({
          patientDID: patientDID,
          issuerDID: user.hospital_id ? user.hospital_id.toString() : "medibridge",
          credentialType: credentialType,
          jwtVc: medicalRecordVcJwt,
          credentialSubject: credentialSubject,
          issuanceDate: new Date(),
        });
      } catch (vcErr) {
        console.error("[MedicalRecordVC] Failed to issue/store Medical Record VC:", vcErr);
      }

      // Update the record with storage metadata
      await storage.updateRecordFilecoin(
        patientRecord.id,
        storageResult.filecoinCid,
        storageResult.storageCost,
        {
          ipfsCid: storageResult.ipfsCid,
          localPath: storageResult.localPath,
          redundancyLevel: storageResult.redundancyLevel,
          encryptionMethod: 'AES-256-GCM',
          accessPattern: 'frequent',
          storedAt: storageResult.metadata.storedAt
        }
      );

      // Create storage location records
      await storage.createStorageLocation({
        contentHash: storageResult.ipfsCid,
        storageType: 'ipfs',
        locationId: storageResult.ipfsCid,
        status: 'active'
      });

      await storage.createStorageLocation({
        contentHash: storageResult.filecoinCid,
        storageType: 'filecoin',
        locationId: storageResult.filecoinCid,
        status: 'active'
      });

      if (storageResult.localPath) {
        await storage.createStorageLocation({
          contentHash: storageResult.ipfsCid,
          storageType: 'local',
          locationId: storageResult.localPath,
          status: 'active'
        });
      }

      res.status(201).json({
        success: true,
        message: "Medical record stored with triple redundancy (IPFS + Filecoin + Local)",
        recordId: patientRecord.id,
        patientDID,
        phoneNumber: recordData.phoneNumber,
        storage: {
          ipfsCid: storageResult.ipfsCid,
          filecoinCid: storageResult.filecoinCid,
          localPath: storageResult.localPath,
          redundancyLevel: storageResult.redundancyLevel,
          cost: storageResult.storageCost
        }
      });
    } catch (error: any) {
      return res.status(400).json({ error: `Failed to submit medical record: ${error.message}` });
    }
  });

  // Request Access to Patient Records via DID
  app.post("/api/web3/request-access", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required. Please log in to request access to patient records." });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ error: "Only Hospital B can request access. Your hospital type does not have permission for this action." });
      }

      const { patientDID } = z.object({
        patientDID: z.string(),
      }).parse(req.body);

      // Verify patient identity exists
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity) {
        return res.status(404).json({ error: "Patient DID not found. Please verify the patient identifier and try again." });
      }

      // Get patient's IPFS content
      const patientContent = await storage.getContentByPatientDID(patientDID);
      
      if (patientContent.length === 0) {
        return res.status(404).json({ error: "No medical records found for this patient. The patient may not have any records in the system." });
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
        message: "Access request submitted successfully",
        patientDID,
        patientIdentity: {
          did: patientIdentity.did,
          walletAddress: patientIdentity.walletAddress,
        },
        recordCount: patientContent.length,
        recordMetadata,
      });
    } catch (error: any) {
      return res.status(400).json({ error: `Failed to request access: ${error.message}` });
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
        return res.status(404).json({ error: "Patient DID not found or no wallet address associated. Please ensure the patient has a valid Web3 identity." });
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
        return res.status(401).json({ error: "Invalid patient signature. Please ensure you're signing with the correct wallet and try again." });
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
          patientDID: patientDID,
          issuerDID: patientDID, // Patient is the issuer of their consent
          credentialType: "HealthcareConsent",
          jwtVc: jwtVc,
          issuanceDate: new Date(),
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
        return res.status(401).json({ error: "Authentication required. Please log in to access patient records." });
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
        return res.status(403).json({ error: "No valid consent found for accessing patient records. Please ensure the patient has granted consent for your hospital." });
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
        return res.status(404).json({ error: "Patient DID not found or no wallet address associated. Please ensure the patient has a valid Web3 identity." });
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
        return res.status(401).json({ error: "Invalid patient signature for revocation. Please ensure you're signing with the correct wallet and try again." });
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
        return res.status(404).json({ error: "Patient DID not found. Please verify the patient identifier." });
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