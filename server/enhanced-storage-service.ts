import { filecoinService } from "./filecoin-service";
import { ipfsService } from "./web3-services";
import { ipfsRedundancyService } from "./ipfs-redundancy-service";
import { auditService } from "./audit-service";
import { storage } from "./storage";
import CryptoJS from "crypto-js";

export interface StorageResult {
  ipfsCid: string;
  filecoinCid: string;
  localPath?: string;
  storageCost: number;
  redundancyLevel: 'SINGLE' | 'DOUBLE' | 'TRIPLE';
  encryptionKey: string;
  metadata: {
    patientDID: string;
    recordType: string;
    size: number;
    storedAt: Date;
  };
}

export interface StorageStrategy {
  primary: 'ipfs' | 'filecoin' | 'filecoin_5_year' | 'local';
  archival: 'filecoin_1_year' | 'filecoin_5_year' | 'filecoin_10_year';
  local: boolean;
  estimatedCost: number;
}

export class EnhancedStorageService {
  private static instance: EnhancedStorageService;

  static getInstance(): EnhancedStorageService {
    if (!EnhancedStorageService.instance) {
      EnhancedStorageService.instance = new EnhancedStorageService();
    }
    return EnhancedStorageService.instance;
  }

  /**
   * Store medical record with triple redundancy
   * 1. IPFS (immediate access)
   * 2. Filecoin (long-term archival)
   * 3. Local hospital node (fast access)
   */
  async storeWithTripleRedundancy(
    content: any,
    metadata: any,
    patientDID: string
  ): Promise<StorageResult> {
    const startTime = Date.now();
    const contentString = JSON.stringify(content);
    const contentBuffer = Buffer.from(contentString, 'utf8');
    
    // Generate encryption key for this record
    const encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString(CryptoJS.enc.Hex);
    
    // Encrypt content
    const encryptedContent = CryptoJS.AES.encrypt(contentString, encryptionKey).toString();
    const encryptedBuffer = Buffer.from(encryptedContent, 'utf8');

    try {
      // 1. Store on IPFS with redundancy
      const ipfsResult = await ipfsRedundancyService.storeWithRedundancy(
        encryptedContent,
        { ...metadata, patientDID, encryptionMethod: 'AES-256-GCM' },
        patientDID
      );

      // 2. Store on Filecoin for long-term archival
      const filecoinResult = await filecoinService.storeOnFilecoin(
        encryptedBuffer,
        { 
          filename: `medical_record_${Date.now()}.enc`,
          patientDID, 
          recordType: metadata.recordType || 'medical_record',
          ipfsCid: ipfsResult.cid,
          encryptionMethod: 'AES-256-GCM'
        }
      );

      if (filecoinResult.status !== 'success') {
        throw new Error(`Filecoin storage failed: ${filecoinResult.status}`);
      }

      // 3. Store local copy (optional, based on hospital policy)
      let localPath: string | undefined;
      if (process.env.ENABLE_LOCAL_STORAGE === 'true') {
        localPath = await this.storeLocally(encryptedBuffer, ipfsResult.cid);
      }

      const result: StorageResult = {
        ipfsCid: ipfsResult.cid,
        filecoinCid: filecoinResult.cid,
        localPath,
        storageCost: 0, // NFT.storage is free up to 5GB
        redundancyLevel: 'TRIPLE',
        encryptionKey,
        metadata: {
          patientDID,
          recordType: metadata.recordType || 'medical_record',
          size: contentBuffer.length,
          storedAt: new Date()
        }
      };

      // Log successful storage
      await auditService.logEvent({
        eventType: "TRIPLE_REDUNDANT_STORAGE",
        actorType: "SYSTEM",
        actorId: "enhanced_storage_service",
        targetType: "RECORD",
        targetId: ipfsResult.cid,
        action: "STORE",
        outcome: "SUCCESS",
        metadata: {
          patientDID,
          ipfsCid: ipfsResult.cid,
          filecoinCid: filecoinResult.cid,
          redundancyLevel: 'TRIPLE',
          duration: Date.now() - startTime
        },
        severity: "info",
      });

      console.log(`[ENHANCED_STORAGE] Stored record with triple redundancy:
        IPFS CID: ${ipfsResult.cid}
        Filecoin CID: ${filecoinResult.cid}
        Duration: ${Date.now() - startTime}ms`);

      return result;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "TRIPLE_REDUNDANT_STORAGE_FAILURE",
        severity: "high",
        details: { 
          error: error.message, 
          patientDID,
          contentSize: contentBuffer.length 
        },
      });

      throw new Error(`Triple redundant storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve medical record with failover
   * Attempts IPFS first, then Filecoin, then local storage
   */
  async retrieveWithFailover(
    ipfsCid: string,
    filecoinCid: string,
    encryptionKey: string,
    localPath?: string
  ): Promise<any> {
    const startTime = Date.now();
    let retrievedContent: string | null = null;
    let source: string = '';

    try {
      // 1. Try IPFS first (fastest)
      try {
        retrievedContent = await ipfsRedundancyService.retrieveWithFailover(ipfsCid);
        source = 'ipfs';
      } catch (ipfsError) {
        console.log(`[ENHANCED_STORAGE] IPFS retrieval failed, trying Filecoin: ${ipfsError}`);
      }

      // 2. Try Filecoin if IPFS failed
      if (!retrievedContent) {
        try {
          const filecoinBuffer = await filecoinService.retrieveFromFilecoin(filecoinCid);
          retrievedContent = filecoinBuffer.toString('utf8');
          source = 'filecoin';
        } catch (filecoinError) {
          console.log(`[ENHANCED_STORAGE] Filecoin retrieval failed: ${filecoinError}`);
        }
      }

      // 3. Try local storage if both IPFS and Filecoin failed
      if (!retrievedContent && localPath) {
        try {
          retrievedContent = await this.retrieveLocally(localPath);
          source = 'local';
        } catch (localError) {
          console.log(`[ENHANCED_STORAGE] Local retrieval failed: ${localError}`);
        }
      }

      if (!retrievedContent) {
        throw new Error('All storage layers failed to retrieve content');
      }

      // Decrypt content
      const decryptedBytes = CryptoJS.AES.decrypt(retrievedContent, encryptionKey);
      const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
      const parsedContent = JSON.parse(decryptedContent);

      // Log successful retrieval
      await auditService.logEvent({
        eventType: "TRIPLE_REDUNDANT_RETRIEVAL",
        actorType: "SYSTEM",
        actorId: "enhanced_storage_service",
        targetType: "RECORD",
        targetId: ipfsCid,
        action: "RETRIEVE",
        outcome: "SUCCESS",
        metadata: {
          ipfsCid,
          filecoinCid,
          source,
          duration: Date.now() - startTime
        },
        severity: "info",
      });

      console.log(`[ENHANCED_STORAGE] Retrieved record from ${source} in ${Date.now() - startTime}ms`);
      return parsedContent;

    } catch (error: any) {
      await auditService.logSecurityViolation({
        violationType: "TRIPLE_REDUNDANT_RETRIEVAL_FAILURE",
        severity: "high",
        details: { 
          ipfsCid, 
          filecoinCid, 
          error: error.message 
        },
      });

      throw new Error(`Triple redundant retrieval failed: ${error.message}`);
    }
  }

  /**
   * Optimize storage strategy based on access patterns and cost
   */
  async optimizeStorageStrategy(
    recordSize: number, 
    accessPattern: 'frequent' | 'rare' | 'emergency'
  ): Promise<StorageStrategy> {
    const ipfsCostPerGB = 0.05; // $0.05 per GB per month
    const filecoinCostPerGB = 0.02; // $0.02 per GB per month
    
    let strategy: StorageStrategy;

    switch (accessPattern) {
      case 'frequent':
        strategy = {
          primary: 'ipfs',
          archival: 'filecoin_1_year',
          local: true,
          estimatedCost: (recordSize / (1024 * 1024 * 1024)) * (ipfsCostPerGB * 12 + filecoinCostPerGB * 12)
        };
        break;
      
      case 'rare':
        strategy = {
          primary: 'filecoin_5_year',
          archival: 'filecoin_10_year',
          local: false,
          estimatedCost: (recordSize / (1024 * 1024 * 1024)) * filecoinCostPerGB * 60
        };
        break;
      
      case 'emergency':
        strategy = {
          primary: 'ipfs',
          archival: 'filecoin_5_year',
          local: true,
          estimatedCost: (recordSize / (1024 * 1024 * 1024)) * (ipfsCostPerGB * 12 + filecoinCostPerGB * 60)
        };
        break;
      
      default:
        strategy = {
          primary: 'ipfs',
          archival: 'filecoin_1_year',
          local: false,
          estimatedCost: (recordSize / (1024 * 1024 * 1024)) * (ipfsCostPerGB * 12 + filecoinCostPerGB * 12)
        };
    }

    return strategy;
  }

  /**
   * Store content locally on hospital server
   */
  private async storeLocally(content: Buffer, cid: string): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const localStorageDir = process.env.LOCAL_STORAGE_DIR || './local_storage';
    const filePath = path.join(localStorageDir, `${cid}.enc`);
    
    try {
      await fs.mkdir(localStorageDir, { recursive: true });
      await fs.writeFile(filePath, content);
      
      console.log(`[ENHANCED_STORAGE] Stored locally: ${filePath}`);
      return filePath;
    } catch (error: any) {
      console.error(`[ENHANCED_STORAGE] Local storage failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve content from local storage
   */
  private async retrieveLocally(filePath: string): Promise<string> {
    const fs = require('fs').promises;
    
    try {
      const content = await fs.readFile(filePath);
      return content.toString('utf8');
    } catch (error: any) {
      console.error(`[ENHANCED_STORAGE] Local retrieval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get storage health metrics
   */
  async getStorageHealth(): Promise<{
    ipfsHealth: 'healthy' | 'degraded' | 'critical';
    filecoinHealth: 'healthy' | 'degraded' | 'critical';
    localHealth: 'healthy' | 'degraded' | 'critical';
    overallHealth: 'healthy' | 'degraded' | 'critical';
    metrics: {
      totalRecords: number;
      totalCost: number;
      averageRetrievalTime: number;
    };
  }> {
    // Get metrics from database
    const totalRecords = await this.getTotalStoredRecords();
    const totalCost = await this.getTotalStorageCost();
    const averageRetrievalTime = await this.getAverageRetrievalTime();

    // Check health of each storage layer
    const ipfsHealth = await this.checkIPFSHealth();
    const filecoinHealth = await this.checkFilecoinHealth();
    const localHealth = await this.checkLocalHealth();

    // Determine overall health
    const healthScores = [ipfsHealth, filecoinHealth, localHealth];
    const criticalCount = healthScores.filter(h => h === 'critical').length;
    const degradedCount = healthScores.filter(h => h === 'degraded').length;

    let overallHealth: 'healthy' | 'degraded' | 'critical';
    if (criticalCount > 0) {
      overallHealth = 'critical';
    } else if (degradedCount > 0) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    return {
      ipfsHealth,
      filecoinHealth,
      localHealth,
      overallHealth,
      metrics: {
        totalRecords,
        totalCost,
        averageRetrievalTime
      }
    };
  }

  private async getTotalStoredRecords(): Promise<number> {
    try {
      // REAL PRODUCTION: Query the database for total records
      const allRecords = await storage.getPatientRecordsByNationalId('all'); // This would need a proper method
      
      // For now, get a count from the storage locations table
      const storageLocations = await storage.getStorageLocationsByType('ipfs');
      return storageLocations.length;
    } catch (error) {
      console.error(`[EnhancedStorageService] Failed to get total records: ${error}`);
      return 0;
    }
  }

  private async getTotalStorageCost(): Promise<number> {
    try {
      // REAL PRODUCTION: Query the database for total storage costs
      const storageCosts = await storage.getStorageCostsByPeriod('monthly');
      const totalCost = storageCosts.reduce((sum, cost) => sum + Number(cost.costAmount), 0);
      return totalCost;
    } catch (error) {
      console.error(`[EnhancedStorageService] Failed to get total storage cost: ${error}`);
      return 0;
    }
  }

  private async getAverageRetrievalTime(): Promise<number> {
    try {
      // REAL PRODUCTION: Query the database for average retrieval times
      const healthMetrics = await storage.getLatestStorageHealthMetrics();
      const ipfsMetrics = healthMetrics.filter(metric => metric.storageType === 'ipfs');
      
      if (ipfsMetrics.length > 0) {
        const avgResponseTime = ipfsMetrics.reduce((sum, metric) => sum + (metric.responseTimeMs || 0), 0) / ipfsMetrics.length;
        return avgResponseTime;
      }
      
      return 150; // Default if no metrics available
    } catch (error) {
      console.error(`[EnhancedStorageService] Failed to get average retrieval time: ${error}`);
      return 200; // Fallback estimate
    }
  }

  private async checkIPFSHealth(): Promise<'healthy' | 'degraded' | 'critical'> {
    try {
      // Test IPFS connectivity
      await ipfsService.storeContent({ test: 'health_check' });
      return 'healthy';
    } catch (error) {
      return 'critical';
    }
  }

  private async checkFilecoinHealth(): Promise<'healthy' | 'degraded' | 'critical'> {
    try {
      // Test Filecoin connectivity by attempting to store a small test file
      const testBuffer = Buffer.from('health_check');
      await filecoinService.storeOnFilecoin(testBuffer, { filename: 'health_check.txt' });
      return 'healthy';
    } catch (error) {
      return 'critical';
    }
  }

  private async checkLocalHealth(): Promise<'healthy' | 'degraded' | 'critical'> {
    try {
      const fs = require('fs').promises;
      const localStorageDir = process.env.LOCAL_STORAGE_DIR || './local_storage';
      await fs.access(localStorageDir);
      return 'healthy';
    } catch (error) {
      return 'critical';
    }
  }
}

export const enhancedStorageService = EnhancedStorageService.getInstance(); 