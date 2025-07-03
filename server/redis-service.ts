import Redis from 'ioredis';

// Redis configuration
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

// Cache key prefixes for organization
const CACHE_KEYS = {
  OTP: 'otp:',
  SESSION: 'session:',
  PATIENT_PROFILE: 'patient:profile:',
  PATIENT_RECORDS: 'patient:records:',
  CONSENT_REQUESTS: 'consent:requests:',
  AUDIT_STATS: 'audit:stats:',
  IPFS_CONTENT: 'ipfs:content:',
  ADMIN_DASHBOARD: 'admin:dashboard:',
  SECURITY_VIOLATIONS: 'security:violations:',
  FREQUENT_QUERIES: 'query:',
} as const;

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  OTP: 600, // 10 minutes
  SESSION: 3600, // 1 hour
  PATIENT_PROFILE: 1800, // 30 minutes
  PATIENT_RECORDS: 900, // 15 minutes
  CONSENT_REQUESTS: 300, // 5 minutes
  AUDIT_STATS: 300, // 5 minutes
  IPFS_CONTENT: 3600, // 1 hour
  ADMIN_DASHBOARD: 60, // 1 minute
  SECURITY_VIOLATIONS: 300, // 5 minutes
  FREQUENT_QUERIES: 600, // 10 minutes
} as const;

class RedisService {
  private static instance: RedisService;
  private redis: Redis | null = null;
  private isConnected = false;

  private constructor() {
    this.initializeRedis();
  }

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private async initializeRedis() {
    try {
      if (typeof redisConfig === 'string') {
        this.redis = new Redis(redisConfig);
      } else {
        this.redis = new Redis(redisConfig);
      }
      
      this.redis.on('connect', () => {
        console.log('[REDIS] Connected to Redis server');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('[REDIS] Connection error:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.log('[REDIS] Connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        console.log('[REDIS] Reconnecting...');
      });

      // Wait for initial connection
      await this.redis.connect();

    } catch (error) {
      console.error('[REDIS] Failed to initialize Redis:', error);
      this.redis = null;
      this.isConnected = false;
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.redis) {
      await this.initializeRedis();
    }
    
    if (!this.redis) {
      return false;
    }
    
    try {
      // Test the connection
      await this.redis.ping();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('[REDIS] Connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // OTP Management
  async storeOTP(contact: string, otpData: { code: string; expires: number; method: string }): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.OTP}${contact}`;
      await this.redis!.setex(key, CACHE_TTL.OTP, JSON.stringify(otpData));
      console.log(`[REDIS] Stored OTP for ${contact}`);
    } catch (error) {
      console.error('[REDIS] Failed to store OTP:', error);
    }
  }

  async getOTP(contact: string): Promise<{ code: string; expires: number; method: string } | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.OTP}${contact}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get OTP:', error);
      return null;
    }
  }

  async deleteOTP(contact: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.OTP}${contact}`;
      await this.redis!.del(key);
      console.log(`[REDIS] Deleted OTP for ${contact}`);
    } catch (error) {
      console.error('[REDIS] Failed to delete OTP:', error);
    }
  }

  // Session Caching
  async storeSession(sessionId: string, sessionData: any): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.SESSION}${sessionId}`;
      await this.redis!.setex(key, CACHE_TTL.SESSION, JSON.stringify(sessionData));
    } catch (error) {
      console.error('[REDIS] Failed to store session:', error);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.SESSION}${sessionId}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get session:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.SESSION}${sessionId}`;
      await this.redis!.del(key);
    } catch (error) {
      console.error('[REDIS] Failed to delete session:', error);
    }
  }

  // Patient Profile Caching
  async cachePatientProfile(patientDID: string, profileData: any): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
      await this.redis!.setex(key, CACHE_TTL.PATIENT_PROFILE, JSON.stringify(profileData));
    } catch (error) {
      console.error('[REDIS] Failed to cache patient profile:', error);
    }
  }

  async getCachedPatientProfile(patientDID: string): Promise<any | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached patient profile:', error);
      return null;
    }
  }

  async invalidatePatientProfile(patientDID: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
      await this.redis!.del(key);
    } catch (error) {
      console.error('[REDIS] Failed to invalidate patient profile:', error);
    }
  }

  // Patient Records Caching
  async cachePatientRecords(patientDID: string, records: any[]): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
      await this.redis!.setex(key, CACHE_TTL.PATIENT_RECORDS, JSON.stringify(records));
    } catch (error) {
      console.error('[REDIS] Failed to cache patient records:', error);
    }
  }

  async getCachedPatientRecords(patientDID: string): Promise<any[] | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached patient records:', error);
      return null;
    }
  }

  async invalidatePatientRecords(patientDID: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
      await this.redis!.del(key);
    } catch (error) {
      console.error('[REDIS] Failed to invalidate patient records:', error);
    }
  }

  // Consent Requests Caching
  async cacheConsentRequests(patientId: string, requests: any[]): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
      await this.redis!.setex(key, CACHE_TTL.CONSENT_REQUESTS, JSON.stringify(requests));
    } catch (error) {
      console.error('[REDIS] Failed to cache consent requests:', error);
    }
  }

  async getCachedConsentRequests(patientId: string): Promise<any[] | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached consent requests:', error);
      return null;
    }
  }

  async invalidateConsentRequests(patientId: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
      await this.redis!.del(key);
    } catch (error) {
      console.error('[REDIS] Failed to invalidate consent requests:', error);
    }
  }

  // Admin Dashboard Caching
  async cacheAdminDashboardData(data: any): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
      await this.redis!.setex(key, CACHE_TTL.ADMIN_DASHBOARD, JSON.stringify(data));
    } catch (error) {
      console.error('[REDIS] Failed to cache admin dashboard data:', error);
    }
  }

  async getCachedAdminDashboardData(): Promise<any | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached admin dashboard data:', error);
      return null;
    }
  }

  async invalidateAdminDashboardData(): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
      await this.redis!.del(key);
    } catch (error) {
      console.error('[REDIS] Failed to invalidate admin dashboard data:', error);
    }
  }

  // IPFS Content Caching
  async cacheIPFSContent(cid: string, content: any): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.IPFS_CONTENT}${cid}`;
      await this.redis!.setex(key, CACHE_TTL.IPFS_CONTENT, JSON.stringify(content));
    } catch (error) {
      console.error('[REDIS] Failed to cache IPFS content:', error);
    }
  }

  async getCachedIPFSContent(cid: string): Promise<any | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.IPFS_CONTENT}${cid}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached IPFS content:', error);
      return null;
    }
  }

  // Generic Query Caching
  async cacheQueryResult(queryKey: string, result: any, ttl?: number): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      const key = `${CACHE_KEYS.FREQUENT_QUERIES}${queryKey}`;
      const cacheTTL = ttl || CACHE_TTL.FREQUENT_QUERIES;
      await this.redis!.setex(key, cacheTTL, JSON.stringify(result));
    } catch (error) {
      console.error('[REDIS] Failed to cache query result:', error);
    }
  }

  async getCachedQueryResult(queryKey: string): Promise<any | null> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const key = `${CACHE_KEYS.FREQUENT_QUERIES}${queryKey}`;
      const data = await this.redis!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[REDIS] Failed to get cached query result:', error);
      return null;
    }
  }

  // Cache Management
  async clearAllCaches(): Promise<void> {
    if (!(await this.ensureConnection())) return;
    
    try {
      await this.redis!.flushdb();
      console.log('[REDIS] Cleared all caches');
    } catch (error) {
      console.error('[REDIS] Failed to clear caches:', error);
    }
  }

  async getCacheStats(): Promise<any> {
    if (!(await this.ensureConnection())) return null;
    
    try {
      const info = await this.redis!.info();
      const keyspace = await this.redis!.info('keyspace');
      return { info, keyspace };
    } catch (error) {
      console.error('[REDIS] Failed to get cache stats:', error);
      return null;
    }
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.redis) return false;
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('[REDIS] Health check failed:', error);
      return false;
    }
  }

  // Get Redis client for external use (e.g., connect-redis)
  getRedisClient(): Redis | null {
    if (!this.redis || !this.isConnected) {
      return null;
    }
    return this.redis;
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.isConnected = false;
      console.log('[REDIS] Disconnected from Redis');
    }
  }
}

export const redisService = RedisService.getInstance(); 