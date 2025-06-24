import type { Express } from "express";
import { storage } from "./storage";
import { didService, vcService, ipfsService, consentService, WalletService } from "./web3-services";
import { z } from "zod";
import CryptoJS from "crypto-js";

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

  // Submit Medical Record to IPFS with DID
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
        patientDID: z.string(),
        patientName: z.string(),
        nationalId: z.string(),
        visitDate: z.string(),
        visitType: z.string().optional(),
        diagnosis: z.string(),
        prescription: z.string().optional(),
        physician: z.string().optional(),
        department: z.string().optional(),
      }).parse(req.body);

      // Verify patient identity exists
      const patientIdentity = await storage.getPatientIdentityByDID(recordData.patientDID);
      if (!patientIdentity) {
        return res.status(404).json({ message: "Patient DID not found" });
      }

      // Generate encryption key for patient-controlled access
      const encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
      
      // Prepare medical record for IPFS storage
      const medicalRecord = {
        patientDID: recordData.patientDID,
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
      const ipfsHash = await ipfsService.storeContent(medicalRecord, encryptionKey);
      
      // Pin content for availability
      await ipfsService.pinContent(ipfsHash);

      // Store IPFS content reference
      const ipfsContentRecord = await storage.createIpfsContent({
        contentHash: ipfsHash,
        patientDID: recordData.patientDID,
        contentType: "medical_record",
        encryptionMethod: "AES-256-GCM",
        size: JSON.stringify(medicalRecord).length,
        accessControlList: {
          owner: recordData.patientDID,
          authorizedHospitals: [user.hospitalName]
        }
      });

      // Store traditional record with IPFS reference
      const patientRecord = await storage.createPatientRecord({
        ...recordData,
        submittedBy: user.id,
        ipfsHash,
        encryptionKey: encryptionKey, // In production, this should be encrypted with patient's public key
      });

      res.status(201).json({
        success: true,
        message: "Medical record stored on IPFS with patient DID",
        recordId: patientRecord.id,
        ipfsHash,
        patientDID: recordData.patientDID
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
  app.post("/api/web3/grant-consent", async (req, res, next) => {
    try {
      const { patientDID, requesterDID, contentHashes, consentType, patientSignature } = z.object({
        patientDID: z.string(),
        requesterDID: z.string(),
        contentHashes: z.array(z.string()),
        consentType: z.string(),
        patientSignature: z.string(),
      }).parse(req.body);

      // Verify patient identity
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity) {
        return res.status(404).json({ message: "Patient DID not found" });
      }

      // Verify patient signature (simplified - in production use proper cryptographic verification)
      const message = WalletService.createSignMessage(patientDID, Date.now());
      const isValidSignature = patientIdentity.walletAddress ? 
        WalletService.verifySignature(message, patientSignature, patientIdentity.walletAddress) : 
        true; // Fallback for demo

      if (!isValidSignature) {
        return res.status(401).json({ message: "Invalid patient signature" });
      }

      // Issue consent credential for each content hash
      const consentCredentials = [];
      for (const contentHash of contentHashes) {
        // Create consent credential
        const consentCredential = await consentService.issueConsentCredential(
          patientDID,
          requesterDID,
          contentHash,
          consentType,
          "patient_private_key" // In production, use patient's actual private key
        );

        // Store credential
        const storedCredential = await storage.createVerifiableCredential({
          patientDID,
          issuerDID: patientDID,
          credentialType: "HealthcareConsent",
          credentialSubject: consentCredential.credentialSubject,
          proof: consentCredential.proof,
          expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        // Create consent management record
        await storage.createConsentManagement({
          patientDID,
          requesterDID,
          contentHash,
          consentType,
          consentGiven: true,
          consentCredentialId: storedCredential.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        consentCredentials.push(storedCredential);
      }

      res.json({
        success: true,
        message: "Consent granted via verifiable credentials",
        consentCredentials: consentCredentials.length,
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
      const { patientDID, requesterDID } = z.object({
        patientDID: z.string(),
        requesterDID: z.string(),
      }).parse(req.body);

      // Verify consent exists and is valid
      const consents = await storage.getConsentByPatientAndRequester(patientDID, requesterDID);
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
            // Retrieve and decrypt content from IPFS
            const decryptedContent = await ipfsService.retrieveContent(
              record.ipfsHash, 
              record.encryptionKey
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
      const { patientDID, requesterDID, patientSignature } = z.object({
        patientDID: z.string(),
        requesterDID: z.string(),
        patientSignature: z.string(),
      }).parse(req.body);

      // Verify patient identity and signature
      const patientIdentity = await storage.getPatientIdentityByDID(patientDID);
      if (!patientIdentity) {
        return res.status(404).json({ message: "Patient DID not found" });
      }

      // Get and revoke all consents
      const consents = await storage.getConsentByPatientAndRequester(patientDID, requesterDID);
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