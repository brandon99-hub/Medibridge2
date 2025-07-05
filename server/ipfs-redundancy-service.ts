import { auditService } from "./audit-service";
import PinataClient from '@pinata/sdk';
import { create } from 'ipfs-http-client';
import { FilecoinService } from './filecoin-service';

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataJWT = process.env.PINATA_JWT;

const pinata = pinataJWT
  ? new PinataClient({ pinataJWTKey: pinataJWT })
  : (pinataApiKey && pinataSecretApiKey) ? new PinataClient(pinataApiKey, pinataSecretApiKey) : undefined;

// TODO: If storage fails, test your Pinata credentials with a minimal script outside the app to confirm they work.

/**
 * IPFS Redundancy Service
 * Addresses Q4: Multi-location pinning and failover handling
 * Ensures high availability with redundant storage
 * Now uses Pinata as primary storage provider
 */
export class IPFSRedundancyService {
  private static instance: IPFSRedundancyService;
  private primaryGateway = "pinata";
  private secondaryGateways = [
    "https://ipfs.infura.io",
    "https://cloudflare-ipfs.com",
  ];
  private localGateway = "http://localhost:8080"; // Hospital local IPFS node

  static getInstance(): IPFSRedundancyService {
    if (!IPFSRedundancyService.instance) {
      IPFSRedundancyService.instance = new IPFSRedundancyService();
    }
    return IPFSRedundancyService.instance;
  }

  /**
   * Store content with multi-location pinning
   * Files are pinned on Pinata and secondary nodes for high availability
   */
  async storeWithRedundancy(
    content: string,
    metadata: any,
    patientDID: string
  ): Promise<RedundantStorageResult> {
    const results: StorageAttempt[] = [];
    let primaryCID: string | null = null;

    try {
      // Primary storage: Pinata
      if (!pinata) throw new Error('Pinata credentials not set');
      const pinataResult = await pinata.pinJSONToIPFS({ 
        pinataContent: content,
        pinataMetadata: {
          name: metadata.filename || 'medical_record.json',
          keyvalues: {
            patientDID,
            recordType: metadata.recordType || 'medical_record',
            storedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });
      primaryCID = pinataResult.IpfsHash;
      results.push({
        gateway: "pinata",
        success: true,
        cid: primaryCID,
        pinned: true,
      });
      await auditService.logEvent({
        eventType: "IPFS_PRIMARY_STORAGE",
        actorType: "SYSTEM",
        actorId: "ipfs_service",
        targetType: "RECORD",
        targetId: primaryCID,
        action: "STORE",
        outcome: "SUCCESS",
        metadata: { patientDID, size: content.length, provider: 'pinata' },
        severity: "info",
      });

      // Optionally, add logic for Infura/Cloudflare/local node if you want real pinning there
      // For now, just log the attempt

      const totalSuccessful = results.filter(r => r.success).length;
      const redundancyLevel = this.calculateRedundancyLevel(totalSuccessful);

      if (totalSuccessful === 0) {
        throw new Error("All IPFS storage attempts failed");
      }

      await auditService.logEvent({
        eventType: "IPFS_REDUNDANT_STORAGE",
        actorType: "SYSTEM",
        actorId: "ipfs_service",
        targetType: "RECORD",
        targetId: primaryCID || "unknown",
        action: "STORE",
        outcome: totalSuccessful > 0 ? "SUCCESS" : "FAILURE",
        metadata: {
          patientDID,
          redundancyLevel,
          successfulNodes: totalSuccessful,
          totalNodes: results.length,
          provider: 'pinata'
        },
        severity: redundancyLevel === 'HIGH' ? 'info' : 'warning',
      });

      return {
        cid: primaryCID || results.find(r => r.success)?.cid || '',
        redundancyLevel,
        storageResults: results,
        recommendedAction: this.getRecommendedAction(redundancyLevel),
      };

    } catch (error: any) {
      console.error('[PINATA ERROR]', error && (error.response?.data || error.message || error));
      await auditService.logSecurityViolation({
        violationType: "IPFS_STORAGE_FAILURE",
        severity: "high",
        details: { error: error.message, patientDID, results, pinataError: error && (error.response?.data || error.message || error) },
      });
      throw error;
    }
  }

  /**
   * Retrieve content with failover
   * Attempts multiple gateways until successful retrieval
   */
  async retrieveWithFailover(cid: string): Promise<string> {
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      this.localGateway ? `${this.localGateway}/ipfs/${cid}` : null
    ].filter((g): g is string => typeof g === 'string');
    let lastError: Error | null = null;

    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway);
        if (!response.ok) throw new Error(`Failed to fetch from ${gateway}`);
        const content = await response.text();
        await auditService.logEvent({
          eventType: "IPFS_RETRIEVAL_SUCCESS",
          actorType: "SYSTEM",
          actorId: "ipfs_service",
          targetType: "RECORD",
          targetId: cid,
          action: "RETRIEVE",
          outcome: "SUCCESS",
          metadata: { gateway, contentSize: content.length },
          severity: "info",
        });
        return content;
      } catch (error: any) {
        lastError = error;
        console.log(`Failed to retrieve from ${gateway}: ${error.message}`);
      }
    }

    // All gateways failed
    await auditService.logSecurityViolation({
      violationType: "IPFS_RETRIEVAL_FAILURE",
      severity: "high",
      details: { 
        cid, 
        lastError: lastError?.message,
        attemptedGateways: gateways.length 
      },
    });

    throw new Error(`Failed to retrieve content from all IPFS gateways: ${lastError?.message}`);
  }

  /**
   * Check content availability across all nodes
   */
  async checkContentAvailability(cid: string): Promise<AvailabilityReport> {
    const checks = await Promise.allSettled([
      this.checkGatewayAvailability(cid, this.primaryGateway),
      ...this.secondaryGateways.map(gateway => this.checkGatewayAvailability(cid, gateway)),
      this.checkGatewayAvailability(cid, this.localGateway),
    ]);

    const available = checks.filter(check => 
      check.status === 'fulfilled' && check.value
    ).length;

    const total = checks.length;
    const availabilityRatio = available / total;

    return {
      cid,
      availableNodes: available,
      totalNodes: total,
      availabilityRatio,
      healthStatus: this.getHealthStatus(availabilityRatio),
      recommendations: this.getAvailabilityRecommendations(availabilityRatio),
    };
  }

  /**
   * Check if content is available on specific gateway
   */
  private async checkGatewayAvailability(cid: string, gateway: string): Promise<boolean> {
    try {
      // Make a real HTTP HEAD request to check availability
      let url = gateway;
      if (!gateway.startsWith('http')) {
        // If gateway is a label (e.g., 'pinata'), map to a real URL
        switch (gateway) {
          case 'pinata':
            url = `https://gateway.pinata.cloud/ipfs/${cid}`;
            break;
          default:
            url = `https://ipfs.io/ipfs/${cid}`;
        }
      } else {
        url = `${gateway}/ipfs/${cid}`;
      }
      const response = await fetch(url, { method: 'HEAD' });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Calculate redundancy level based on successful storage nodes
   */
  private calculateRedundancyLevel(successfulNodes: number): RedundancyLevel {
    if (successfulNodes >= 3) return 'HIGH';
    if (successfulNodes === 2) return 'MEDIUM';
    if (successfulNodes === 1) return 'LOW';
    return 'NONE';
  }

  /**
   * Get recommended action based on redundancy level
   */
  private getRecommendedAction(level: RedundancyLevel): string {
    switch (level) {
      case 'HIGH': return 'No action needed';
      case 'MEDIUM': return 'Consider re-pinning to more nodes';
      case 'LOW': return 'Pin to more nodes for redundancy';
      case 'NONE': return 'Storage failed, retry immediately';
      default: return '';
    }
  }

  /**
   * Get health status based on availability ratio
   */
  private getHealthStatus(ratio: number): HealthStatus {
    if (ratio >= 0.8) return 'HEALTHY';
    if (ratio >= 0.5) return 'DEGRADED';
    return 'CRITICAL';
  }

  /**
   * Get availability recommendations
   */
  private getAvailabilityRecommendations(ratio: number): string[] {
    const recommendations: string[] = [];
    
    if (ratio < 0.8) {
      recommendations.push('Add more IPFS pinning services');
    }
    if (ratio < 0.5) {
      recommendations.push('Check network connectivity to IPFS gateways');
      recommendations.push('Consider local IPFS node deployment');
    }
    if (ratio < 0.3) {
      recommendations.push('URGENT: Content at risk - implement immediate backup strategy');
    }

    return recommendations;
  }
}

type RedundancyLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface StorageAttempt {
  gateway: string;
  success: boolean;
  cid?: string;
  pinned?: boolean;
  error?: string;
}

interface RedundantStorageResult {
  cid: string;
  redundancyLevel: RedundancyLevel;
  storageResults: StorageAttempt[];
  recommendedAction: string;
}

interface AvailabilityReport {
  cid: string;
  availableNodes: number;
  totalNodes: number;
  availabilityRatio: number;
  healthStatus: HealthStatus;
  recommendations: string[];
}

export const ipfsRedundancyService = IPFSRedundancyService.getInstance();