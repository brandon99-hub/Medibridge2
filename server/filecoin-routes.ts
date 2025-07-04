import type { Express } from "express";
import { z } from "zod";
import { enhancedStorageService } from "./enhanced-storage-service";
import { filecoinService } from "./filecoin-service";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import { requireAdminAuth } from "./admin-auth-middleware";

export function registerFilecoinRoutes(app: Express): void {
  // Store medical record with Filecoin integration
  app.post("/api/filecoin/store-record", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "A") {
        return res.status(403).json({ error: "Only Hospital A can submit records" });
      }

      const schema = z.object({
        patientDID: z.string(),
        recordData: z.object({
          patientName: z.string(),
          nationalId: z.string(),
          visitDate: z.string(),
          visitType: z.string().optional(),
          diagnosis: z.string(),
          prescription: z.string().optional(),
          physician: z.string().optional(),
          department: z.string().optional(),
        }),
        accessPattern: z.enum(['frequent', 'rare', 'emergency']).default('frequent'),
      });

      const { patientDID, recordData, accessPattern } = schema.parse(req.body);

      // Store with triple redundancy (IPFS + Filecoin + Local)
      const storageResult = await enhancedStorageService.storeWithTripleRedundancy(
        recordData,
        { 
          recordType: 'medical_record',
          accessPattern,
          hospitalId: user.id,
          hospitalName: user.hospitalName
        },
        patientDID
      );

      // Create traditional record with Filecoin references
      const patientRecord = await storage.createPatientRecord({
        ...recordData,
        patientDID,
        submittedBy: user.id,
        recordType: 'web3',
      });

      // Update record with storage metadata
      await storage.updateRecordFilecoin(
        patientRecord.id,
        storageResult.filecoinCid,
        storageResult.storageCost,
        {
          ipfsCid: storageResult.ipfsCid,
          localPath: storageResult.localPath,
          redundancyLevel: storageResult.redundancyLevel,
          encryptionMethod: 'AES-256-GCM',
          accessPattern,
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
        message: "Record stored with Filecoin integration",
        recordId: patientRecord.id,
        storage: {
          ipfsCid: storageResult.ipfsCid,
          filecoinCid: storageResult.filecoinCid,
          localPath: storageResult.localPath,
          redundancyLevel: storageResult.redundancyLevel,
          cost: storageResult.storageCost
        }
      });

    } catch (error: any) {
      return res.status(400).json({ error: `Failed to store record with Filecoin: ${error.message}` });
    }
  });

  // Retrieve medical record with Filecoin failover
  app.post("/api/filecoin/retrieve-record", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ error: "Only Hospital B can retrieve records" });
      }

      const schema = z.object({
        recordId: z.number(),
        encryptionKey: z.string(),
      });

      const { recordId, encryptionKey } = schema.parse(req.body);

      // Get record metadata
      const record = await storage.getPatientRecordById(recordId);
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }

      if (!record.ipfsHash || !record.filecoinCid) {
        return res.status(400).json({ error: "Record not stored with Filecoin integration" });
      }

      // Retrieve with failover
      const recordData = await enhancedStorageService.retrieveWithFailover(
        record.ipfsHash,
        record.filecoinCid,
        encryptionKey,
        record.storageMetadata?.localPath
      );

      // Log access
      await auditService.logEvent({
        eventType: "FILECOIN_RECORD_ACCESS",
        actorType: "USER",
        actorId: user.id.toString(),
        targetType: "RECORD",
        targetId: recordId.toString(),
        action: "RETRIEVE",
        outcome: "SUCCESS",
        metadata: {
          patientDID: record.patientDID,
          hospitalId: user.id,
          hospitalName: user.hospitalName
        },
        severity: "info",
      });

      res.json({
        message: "Record retrieved successfully",
        record: recordData,
        metadata: {
          recordId: record.id,
          patientName: record.patientName,
          visitDate: record.visitDate,
          storedAt: record.storageMetadata?.storedAt
        }
      });

    } catch (error: any) {
      return res.status(400).json({ error: `Failed to retrieve record: ${error.message}` });
    }
  });

  // Get storage health metrics
  app.get("/api/filecoin/storage-health", requireAdminAuth, async (req, res) => {
    try {
      const health = await enhancedStorageService.getStorageHealth();
      
      res.json({
        message: "Storage health retrieved",
        health
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get storage health: ${error.message}` });
    }
  });

  // Get Filecoin CID status
  app.get("/api/filecoin/status", async (req, res) => {
    try {
      const { cid } = req.query;
      
      if (!cid || typeof cid !== 'string') {
        return res.status(400).json({ error: "CID is required" });
      }

      // Get status from Filecoin service
      const status = await filecoinService.getDealStatus(cid);
      
      res.json({
        message: "Filecoin status retrieved",
        status: status.status,
        provider: status.provider,
        dealId: cid, // For nft.storage, the CID serves as the deal ID
        cost: 0, // nft.storage is free up to 5GB
        duration: null, // Not available via nft.storage
        lastChecked: status.lastChecked
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get Filecoin status: ${error.message}` });
    }
  });

  // Get storage costs for a patient
  app.get("/api/filecoin/storage-costs/:patientDID", requireAdminAuth, async (req, res) => {
    try {
      const { patientDID } = req.params;

      const costs = await storage.getStorageCostsByPatientDID(patientDID);
      const totalCost = await storage.getTotalStorageCostsByPatientDID(patientDID);

      res.json({
        message: "Storage costs retrieved",
        costs,
        totalCost
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get storage costs: ${error.message}` });
    }
  });

  // Get expiring Filecoin deals
  app.get("/api/filecoin/expiring-deals", requireAdminAuth, async (req, res) => {
    try {
      const daysUntilExpiry = parseInt(req.query.days as string) || 30;
      const expiringDeals = await storage.getExpiringFilecoinDeals(daysUntilExpiry);

      res.json({
        message: "Expiring deals retrieved",
        expiringDeals,
        daysUntilExpiry
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get expiring deals: ${error.message}` });
    }
  });

  // Get storage locations for a content hash
  app.get("/api/filecoin/storage-locations/:contentHash", requireAdminAuth, async (req, res) => {
    try {
      const { contentHash } = req.params;
      const locations = await storage.getStorageLocationsByContentHash(contentHash);

      res.json({
        message: "Storage locations retrieved",
        contentHash,
        locations
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get storage locations: ${error.message}` });
    }
  });

  // Update storage location status
  app.put("/api/filecoin/storage-location/:id/status", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = z.object({
        status: z.enum(['active', 'archived', 'failed'])
      }).parse(req.body);

      await storage.updateStorageLocationStatus(parseInt(id), status);

      res.json({
        message: "Storage location status updated",
        id,
        status
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to update storage location status: ${error.message}` });
    }
  });

  // Get storage strategy recommendation
  app.post("/api/filecoin/storage-strategy", async (req, res) => {
    try {
      const schema = z.object({
        recordSize: z.number(),
        accessPattern: z.enum(['frequent', 'rare', 'emergency'])
      });

      const { recordSize, accessPattern } = schema.parse(req.body);

      const strategy = await enhancedStorageService.optimizeStorageStrategy(recordSize, accessPattern);

      res.json({
        message: "Storage strategy recommended",
        strategy
      });

    } catch (error: any) {
      return res.status(500).json({ error: `Failed to get storage strategy: ${error.message}` });
    }
  });
}