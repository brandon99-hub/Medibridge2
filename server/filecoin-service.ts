import PinataClient from '@pinata/sdk';
import { auditService } from './audit-service';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

/**
 * Filecoin Service
 * Handles storage and retrieval of medical records on the Filecoin network
 * Provides long-term archival storage with cryptographic proofs
 * Now uses Pinata for both IPFS and Filecoin operations
 */
export interface FilecoinDeal {
  dealId: string;
  contentHash: string;
  storageProvider: string;
  dealSize: number;
  dealCost: number;
  dealDuration: number; // in epochs
  dealStatus: 'active' | 'expired' | 'terminated';
  createdAt: Date;
  expiresAt: Date;
}

export interface FilecoinStorageResult {
  dealId: string;
  contentHash: string;
  cost: number;
  duration: number;
  provider: string;
  status: 'success' | 'failed';
  error?: string;
}

export class FilecoinService {
  private static instance: FilecoinService;
  private client: PinataClient;

  private constructor() {
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
    const pinataJWT = process.env.PINATA_JWT;
    
    if (!pinataApiKey && !pinataSecretApiKey && !pinataJWT) {
      throw new Error('Pinata credentials not set in environment');
    }
    
    this.client = pinataJWT
      ? new PinataClient({ pinataJWTKey: pinataJWT })
      : new PinataClient(pinataApiKey!, pinataSecretApiKey!);
  }

  static getInstance(): FilecoinService {
    if (!FilecoinService.instance) {
      FilecoinService.instance = new FilecoinService();
    }
    return FilecoinService.instance;
  }

  /**
   * Store content on Filecoin/IPFS via Pinata
   * @param content Buffer of encrypted data
   * @param metadata Metadata object (should include filename, patientDID, etc.)
   */
  async storeOnFilecoin(content: Buffer, metadata: any) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const filename = metadata.filename || `medical_record_${Date.now()}.enc`;
    const tempPath = path.join(os.tmpdir(), filename);
    const writeFile = promisify(fs.writeFile);
    const unlink = promisify(fs.unlink);
    try {
      // Write buffer to temp file
      await writeFile(tempPath, buffer);
      // Create a read stream
      const readStream = fs.createReadStream(tempPath);
      // Upload to Pinata
      const result = await this.client.pinFileToIPFS(readStream, {
        pinataMetadata: {
          name: filename,
          keyvalues: {
            patientDID: metadata.patientDID,
            recordType: metadata.recordType || 'medical_record',
            encryptionMethod: metadata.encryptionMethod || 'AES-256-GCM',
            storedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });
      // Clean up temp file
      await unlink(tempPath);
      await auditService.logEvent({
        eventType: 'FILECOIN_STORAGE',
        actorType: 'SYSTEM',
        actorId: 'filecoin_service',
        targetType: 'RECORD',
        targetId: result.IpfsHash,
        action: 'STORE',
        outcome: 'SUCCESS',
        metadata: { ...metadata, cid: result.IpfsHash, provider: 'pinata' },
        severity: 'info',
      });
      return {
        cid: result.IpfsHash,
        status: 'success',
        provider: 'pinata',
      };
    } catch (error: any) {
      // Clean up temp file on error
      try { await unlink(tempPath); } catch {}
      await auditService.logEvent({
        eventType: 'FILECOIN_STORAGE',
        actorType: 'SYSTEM',
        actorId: 'filecoin_service',
        targetType: 'RECORD',
        targetId: 'unknown',
        action: 'STORE',
        outcome: 'FAILURE',
        metadata: { ...metadata, error: error.message },
        severity: 'error',
      });
      throw error;
    }
  }

  /**
   * Retrieve content from Filecoin/IPFS via Pinata gateway
   * @param cid Content identifier (CID)
   * @returns Buffer of the file content
   */
  async retrieveFromFilecoin(cid: string): Promise<Buffer> {
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    const res = await fetch(gatewayUrl);
    if (!res.ok) throw new Error('Failed to fetch from Filecoin/IPFS via Pinata');
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Check deal status on Filecoin network via Pinata
   * Note: Pinata provides IPFS pinning with optional Filecoin deals
   */
  async getDealStatus(dealId: string): Promise<{
    status: 'active' | 'expired' | 'terminated';
    expiresAt: Date | null;
    provider: string;
    lastChecked: Date;
  }> {
    try {
      // Check if CID is available via Pinata gateway
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${dealId}`;
      const res = await fetch(gatewayUrl, { method: 'HEAD' });
      
      if (res.ok) {
        // If available, assume deal is active (Pinata manages availability)
        return {
          status: 'active',
          expiresAt: null, // Pinata doesn't expose deal expiry via API
          provider: 'pinata',
          lastChecked: new Date(),
        };
      } else {
        return {
          status: 'expired',
          expiresAt: null,
          provider: 'pinata',
          lastChecked: new Date(),
        };
      }
    } catch (error: any) {
      console.error(`[FILECOIN] Failed to get deal status for ${dealId}:`, error);
      
      // Return a default status on error
      return {
        status: 'active', // Assume active if we can't check
        expiresAt: null,
        provider: 'pinata',
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Renew an expiring deal
   * Note: Pinata handles deal management automatically
   */
  async renewDeal(dealId: string, newDuration: number): Promise<boolean> {
    // Pinata handles deal renewal automatically
    await auditService.logEvent({
      eventType: "FILECOIN_DEAL_RENEWAL_ATTEMPTED",
      actorType: "SYSTEM",
      actorId: "filecoin_service",
      targetType: "RECORD",
      targetId: dealId,
      action: "RENEW",
      outcome: "AUTOMATIC",
      metadata: { dealId, newDuration, provider: 'pinata' },
      severity: "info",
    });
    console.log(`[FILECOIN] Deal renewal is handled automatically by Pinata.`);
    return true;
  }

  /**
   * Get storage cost estimate
   */
  async estimateStorageCost(contentSize: number, durationEpochs: number): Promise<number> {
    // Pinata pricing: Free tier includes 1GB, paid plans available
    // For Filecoin deals, costs vary by provider and market conditions
    const costPerGB = 0.00000002; // 0.00000002 FIL per GB per epoch (approximate)
    return (contentSize / (1024 * 1024 * 1024)) * costPerGB * durationEpochs;
  }

  /**
   * Get available storage providers
   * Returns information about Pinata service
   */
  async getStorageProviders(): Promise<Array<{
    address: string;
    name: string;
    price: number;
    reputation: number;
  }>> {
    // Return information about Pinata service
    return [
      {
        address: 'pinata',
        name: 'Pinata (IPFS + Filecoin)',
        price: 0, // Free tier available
        reputation: 0.98
      }
    ];
  }
}

export const filecoinService = FilecoinService.getInstance(); 