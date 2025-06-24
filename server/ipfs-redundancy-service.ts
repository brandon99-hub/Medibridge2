import { auditService } from "./audit-service";

/**
 * IPFS Redundancy Service
 * Addresses Q4: Multi-location pinning and failover handling
 * Ensures high availability with redundant storage
 */
export class IPFSRedundancyService {
  private static instance: IPFSRedundancyService;
  private primaryGateway = "https://web3.storage";
  private secondaryGateways = [
    "https://gateway.pinata.cloud",
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
   * Files are pinned on both Web3.storage and secondary nodes for high availability
   */
  async storeWithRedundancy(
    content: string,
    metadata: any,
    patientDID: string
  ): Promise<RedundantStorageResult> {
    const results: StorageAttempt[] = [];
    let primaryCID: string | null = null;

    try {
      // Attempt primary storage (Web3.storage)
      try {
        const primaryResult = await this.storeToPrimary(content, metadata);
        primaryCID = primaryResult.cid;
        results.push({
          gateway: "web3.storage",
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
          metadata: { patientDID, size: content.length },
          severity: "info",
        });
      } catch (error: any) {
        results.push({
          gateway: "web3.storage",
          success: false,
          error: error.message,
        });
        
        await auditService.logSecurityViolation({
          violationType: "PRIMARY_IPFS_FAILURE",
          severity: "medium",
          details: { error: error.message, patientDID },
        });
      }

      // Attempt secondary storage (parallel pinning)
      const secondaryPromises = this.secondaryGateways.map(async (gateway) => {
        try {
          const result = await this.storeToSecondary(content, gateway, primaryCID);
          results.push({
            gateway,
            success: true,
            cid: result.cid,
            pinned: true,
          });
          return result;
        } catch (error: any) {
          results.push({
            gateway,
            success: false,
            error: error.message,
          });
          return null;
        }
      });

      // Wait for secondary storage attempts
      const secondaryResults = await Promise.allSettled(secondaryPromises);
      const successfulSecondaries = secondaryResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .length;

      // Attempt local hospital node pinning
      if (primaryCID) {
        try {
          await this.pinToLocalNode(primaryCID);
          results.push({
            gateway: "local_hospital_node",
            success: true,
            cid: primaryCID,
            pinned: true,
          });
        } catch (error: any) {
          results.push({
            gateway: "local_hospital_node",
            success: false,
            error: error.message,
          });
        }
      }

      // Evaluate storage success
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
      await auditService.logSecurityViolation({
        violationType: "IPFS_STORAGE_FAILURE",
        severity: "high",
        details: { error: error.message, patientDID, results },
      });
      throw error;
    }
  }

  /**
   * Retrieve content with failover
   * Attempts multiple gateways until successful retrieval
   */
  async retrieveWithFailover(cid: string): Promise<string> {
    const gateways = [this.primaryGateway, ...this.secondaryGateways, this.localGateway];
    let lastError: Error | null = null;

    for (const gateway of gateways) {
      try {
        const content = await this.retrieveFromGateway(cid, gateway);
        
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
   * Store to primary IPFS gateway (Web3.storage)
   */
  private async storeToPrimary(content: string, metadata: any): Promise<{ cid: string }> {
    // Simulate Web3.storage API call
    // In production, use actual Web3.storage client
    const cid = this.generateCID(content);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate potential failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error("Web3.storage temporarily unavailable");
    }

    return { cid };
  }

  /**
   * Store to secondary IPFS gateway
   */
  private async storeToSecondary(
    content: string, 
    gateway: string, 
    primaryCID?: string | null
  ): Promise<{ cid: string }> {
    // In production, pin existing CID to secondary node
    const cid = primaryCID || this.generateCID(content);
    
    // Simulate pinning delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate potential failure (10% chance)
    if (Math.random() < 0.1) {
      throw new Error(`${gateway} pinning failed`);
    }

    return { cid };
  }

  /**
   * Pin to local hospital IPFS node
   */
  private async pinToLocalNode(cid: string): Promise<void> {
    // In production, use IPFS HTTP API to pin content
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate potential failure (15% chance - local nodes less reliable)
    if (Math.random() < 0.15) {
      throw new Error("Local IPFS node unavailable");
    }
  }

  /**
   * Retrieve content from specific gateway
   */
  private async retrieveFromGateway(cid: string, gateway: string): Promise<string> {
    // Simulate gateway retrieval
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simulate potential failure (20% chance per gateway)
    if (Math.random() < 0.2) {
      throw new Error(`${gateway} retrieval failed`);
    }

    return `Retrieved content for ${cid} from ${gateway}`;
  }

  /**
   * Check if content is available on specific gateway
   */
  private async checkGatewayAvailability(cid: string, gateway: string): Promise<boolean> {
    try {
      // In production, make HEAD request to check availability
      await new Promise(resolve => setTimeout(resolve, 300));
      return Math.random() > 0.1; // 90% availability simulation
    } catch {
      return false;
    }
  }

  /**
   * Generate deterministic CID for content
   */
  private generateCID(content: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `bafybei${hash.substring(0, 52)}`;
  }

  /**
   * Calculate redundancy level based on successful storage nodes
   */
  private calculateRedundancyLevel(successfulNodes: number): RedundancyLevel {
    if (successfulNodes >= 3) return 'HIGH';
    if (successfulNodes >= 2) return 'MEDIUM';
    if (successfulNodes >= 1) return 'LOW';
    return 'NONE';
  }

  /**
   * Get recommended action based on redundancy level
   */
  private getRecommendedAction(level: RedundancyLevel): string {
    switch (level) {
      case 'HIGH': return 'Content safely stored with high redundancy';
      case 'MEDIUM': return 'Content stored but consider adding more backup nodes';
      case 'LOW': return 'WARNING: Low redundancy - content at risk if single node fails';
      case 'NONE': return 'CRITICAL: Storage failed - content not preserved';
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