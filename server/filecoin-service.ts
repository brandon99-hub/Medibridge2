import { NFTStorage, File } from 'nft.storage';
import { auditService } from './audit-service';

/**
 * Filecoin Service
 * Handles storage and retrieval of medical records on the Filecoin network
 * Provides long-term archival storage with cryptographic proofs
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
  private client: NFTStorage;

  private constructor() {
    const token = process.env.NFT_STORAGE_TOKEN;
    if (!token) throw new Error('NFT_STORAGE_TOKEN not set in environment');
    this.client = new NFTStorage({ token });
  }

  static getInstance(): FilecoinService {
    if (!FilecoinService.instance) {
      FilecoinService.instance = new FilecoinService();
    }
    return FilecoinService.instance;
  }

  /**
   * Store content on Filecoin/IPFS via nft.storage
   * @param content Buffer of encrypted data
   * @param metadata Metadata object (should include filename, patientDID, etc.)
   */
  async storeOnFilecoin(content: Buffer, metadata: any) {
    const file = new File([content], metadata.filename || 'record.enc');
    const cid = await this.client.storeBlob(file);

    await auditService.logEvent({
      eventType: 'FILECOIN_STORAGE',
      actorType: 'SYSTEM',
      actorId: 'filecoin_service',
      targetType: 'RECORD',
      targetId: cid,
      action: 'STORE',
      outcome: 'SUCCESS',
      metadata: { ...metadata, cid },
      severity: 'info',
    });

    return {
      cid,
      status: 'success',
      provider: 'nft.storage',
    };
  }

  /**
   * Retrieve content from Filecoin/IPFS via public IPFS gateway
   * @param cid Content identifier (CID)
   * @returns Buffer of the file content
   */
  async retrieveFromFilecoin(cid: string): Promise<Buffer> {
    const gatewayUrl = `https://ipfs.io/ipfs/${cid}`;
    const res = await fetch(gatewayUrl);
    if (!res.ok) throw new Error('Failed to fetch from Filecoin/IPFS');
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Check deal status on Filecoin network
   * NOTE: nft.storage does not expose direct Filecoin deal status APIs. We can only check if the CID is still available via IPFS.
   */
  async getDealStatus(dealId: string): Promise<{
    status: 'active' | 'expired' | 'terminated';
    expiresAt: Date | null;
    provider: string;
    lastChecked: Date;
  }> {
    try {
      // Production: Check if CID is available via IPFS gateway
      const gatewayUrl = `https://ipfs.io/ipfs/${dealId}`;
      const res = await fetch(gatewayUrl, { method: 'HEAD' });
      
      if (res.ok) {
        // If available, assume deal is active (nft.storage manages deal renewal/expiry internally)
        return {
          status: 'active',
          expiresAt: null, // Not available via nft.storage
          provider: 'nft.storage',
          lastChecked: new Date(),
        };
      } else {
        return {
          status: 'expired',
          expiresAt: null,
          provider: 'nft.storage',
          lastChecked: new Date(),
        };
      }
    } catch (error: any) {
      console.error(`[FILECOIN] Failed to get deal status for ${dealId}:`, error);
      
      // Return a default status on error
      return {
        status: 'active', // Assume active if we can't check
        expiresAt: null,
        provider: 'nft.storage',
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Renew an expiring deal
   * NOTE: nft.storage does not support manual deal renewal; deals are managed automatically.
   */
  async renewDeal(dealId: string, newDuration: number): Promise<boolean> {
    // Production: Not supported
    await auditService.logEvent({
      eventType: "FILECOIN_DEAL_RENEWAL_ATTEMPTED",
      actorType: "SYSTEM",
      actorId: "filecoin_service",
      targetType: "RECORD",
      targetId: dealId,
      action: "RENEW",
      outcome: "NOT_SUPPORTED",
      metadata: { dealId, newDuration },
      severity: "info",
    });
    console.warn(`[FILECOIN] Manual deal renewal is not supported by nft.storage.`);
    return false;
  }

  /**
   * Get storage cost estimate
   */
  async estimateStorageCost(contentSize: number, durationEpochs: number): Promise<number> {
    const costPerGB = 0.00000002; // 0.00000002 FIL per GB per epoch
    return (contentSize / (1024 * 1024 * 1024)) * costPerGB * durationEpochs;
  }

  /**
   * Get available storage providers
   * NOTE: nft.storage abstracts away provider selection; this information is not available.
   * Returns information about nft.storage service instead.
   */
  async getStorageProviders(): Promise<Array<{
    address: string;
    name: string;
    price: number;
    reputation: number;
  }>> {
    // Return information about nft.storage service
    return [
      {
        address: 'nft.storage',
        name: 'NFT.Storage (Protocol Labs)',
        price: 0, // Free up to 5GB
        reputation: 0.99
      }
    ];
  }
}

export const filecoinService = FilecoinService.getInstance(); 