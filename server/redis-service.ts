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
  private isRedisAvailable = false;
  private memoryStore = new Map<string, { data: any; expires: number }>();

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
    // Skip Redis initialization in production if no Redis URL is provided
    if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL && !process.env.REDIS_HOST) {
      console.log('[REDIS] Redis not configured for production, using memory store');
      this.isRedisAvailable = false;
      return;
    }

    try {
      if (typeof redisConfig === 'string') {
        this.redis = new Redis(redisConfig);
      } else {
        this.redis = new Redis(redisConfig);
      }
      
      this.redis.on('connect', () => {
        console.log('[REDIS] Connected to Redis server');
        this.isConnected = true;
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error) => {
        console.error('[REDIS] Connection error:', error);
        this.isConnected = false;
        this.isRedisAvailable = false;
      });

      this.redis.on('close', () => {
        console.log('[REDIS] Connection closed');
        this.isConnected = false;
        this.isRedisAvailable = false;
      });

      this.redis.on('reconnecting', () => {
        console.log('[REDIS] Reconnecting...');
      });

      // Wait for initial connection with timeout
      const connectionPromise = this.redis.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);

    } catch (error) {
      console.error('[REDIS] Failed to initialize Redis:', error);
      this.redis = null;
      this.isConnected = false;
      this.isRedisAvailable = false;
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.isRedisAvailable) {
      return false;
    }

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

  // Memory store fallback methods
  private setMemoryStore(key: string, value: any, ttl: number): void {
    const expires = Date.now() + (ttl * 1000);
    this.memoryStore.set(key, { data: value, expires });
  }

  private getMemoryStore(key: string): any | null {
    const item = this.memoryStore.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.memoryStore.delete(key);
      return null;
    }
    
    return item.data;
  }

  private deleteMemoryStore(key: string): void {
    this.memoryStore.delete(key);
  }

  // OTP Management
  async storeOTP(contact: string, otpData: { code: string; expires: number; method: string }): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.OTP}${contact}`;
        await this.redis!.setex(key, CACHE_TTL.OTP, JSON.stringify(otpData));
        console.log(`[REDIS] Stored OTP for ${contact}`);
      } catch (error) {
        console.error('[REDIS] Failed to store OTP:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.OTP}${contact}`, otpData, CACHE_TTL.OTP);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.OTP}${contact}`, otpData, CACHE_TTL.OTP);
    }
  }

  async getOTP(contact: string): Promise<{ code: string; expires: number; method: string } | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.OTP}${contact}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get OTP:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.OTP}${contact}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.OTP}${contact}`);
    }
  }

  async deleteOTP(contact: string): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.OTP}${contact}`;
        await this.redis!.del(key);
        console.log(`[REDIS] Deleted OTP for ${contact}`);
      } catch (error) {
        console.error('[REDIS] Failed to delete OTP:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.OTP}${contact}`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.OTP}${contact}`);
    }
  }

  // Session Caching
  async storeSession(sessionId: string, sessionData: any): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.SESSION}${sessionId}`;
        await this.redis!.setex(key, CACHE_TTL.SESSION, JSON.stringify(sessionData));
      } catch (error) {
        console.error('[REDIS] Failed to store session:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`, sessionData, CACHE_TTL.SESSION);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`, sessionData, CACHE_TTL.SESSION);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.SESSION}${sessionId}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get session:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.SESSION}${sessionId}`;
        await this.redis!.del(key);
      } catch (error) {
        console.error('[REDIS] Failed to delete session:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.SESSION}${sessionId}`);
    }
  }

  // Patient Profile Caching
  async cachePatientProfile(patientDID: string, profileData: any): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
        await this.redis!.setex(key, CACHE_TTL.PATIENT_PROFILE, JSON.stringify(profileData));
      } catch (error) {
        console.error('[REDIS] Failed to cache patient profile:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`, profileData, CACHE_TTL.PATIENT_PROFILE);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`, profileData, CACHE_TTL.PATIENT_PROFILE);
    }
  }

  async getCachedPatientProfile(patientDID: string): Promise<any | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached patient profile:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`);
    }
  }

  async invalidatePatientProfile(patientDID: string): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`;
        await this.redis!.del(key);
      } catch (error) {
        console.error('[REDIS] Failed to invalidate patient profile:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.PATIENT_PROFILE}${patientDID}`);
    }
  }

  // Patient Records Caching
  async cachePatientRecords(patientDID: string, records: any[]): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
        await this.redis!.setex(key, CACHE_TTL.PATIENT_RECORDS, JSON.stringify(records));
      } catch (error) {
        console.error('[REDIS] Failed to cache patient records:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`, records, CACHE_TTL.PATIENT_RECORDS);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`, records, CACHE_TTL.PATIENT_RECORDS);
    }
  }

  async getCachedPatientRecords(patientDID: string): Promise<any[] | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached patient records:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`);
    }
  }

  async invalidatePatientRecords(patientDID: string): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`;
        await this.redis!.del(key);
      } catch (error) {
        console.error('[REDIS] Failed to invalidate patient records:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.PATIENT_RECORDS}${patientDID}`);
    }
  }

  // Consent Requests Caching
  async cacheConsentRequests(patientId: string, requests: any[]): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
        await this.redis!.setex(key, CACHE_TTL.CONSENT_REQUESTS, JSON.stringify(requests));
      } catch (error) {
        console.error('[REDIS] Failed to cache consent requests:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`, requests, CACHE_TTL.CONSENT_REQUESTS);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`, requests, CACHE_TTL.CONSENT_REQUESTS);
    }
  }

  async getCachedConsentRequests(patientId: string): Promise<any[] | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached consent requests:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`);
    }
  }

  async invalidateConsentRequests(patientId: string): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`;
        await this.redis!.del(key);
      } catch (error) {
        console.error('[REDIS] Failed to invalidate consent requests:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.CONSENT_REQUESTS}${patientId}`);
    }
  }

  // Admin Dashboard Caching
  async cacheAdminDashboardData(data: any): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
        await this.redis!.setex(key, CACHE_TTL.ADMIN_DASHBOARD, JSON.stringify(data));
      } catch (error) {
        console.error('[REDIS] Failed to cache admin dashboard data:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`, data, CACHE_TTL.ADMIN_DASHBOARD);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`, data, CACHE_TTL.ADMIN_DASHBOARD);
    }
  }

  async getCachedAdminDashboardData(): Promise<any | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached admin dashboard data:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`);
    }
  }

  async invalidateAdminDashboardData(): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.ADMIN_DASHBOARD}stats`;
        await this.redis!.del(key);
      } catch (error) {
        console.error('[REDIS] Failed to invalidate admin dashboard data:', error);
        // Fallback to memory store
        this.deleteMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`);
      }
    } else {
      // Use memory store
      this.deleteMemoryStore(`${CACHE_KEYS.ADMIN_DASHBOARD}stats`);
    }
  }

  // IPFS Content Caching
  async cacheIPFSContent(cid: string, content: any): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.IPFS_CONTENT}${cid}`;
        await this.redis!.setex(key, CACHE_TTL.IPFS_CONTENT, JSON.stringify(content));
      } catch (error) {
        console.error('[REDIS] Failed to cache IPFS content:', error);
        // Fallback to memory store
        this.setMemoryStore(`${CACHE_KEYS.IPFS_CONTENT}${cid}`, content, CACHE_TTL.IPFS_CONTENT);
      }
    } else {
      // Use memory store
      this.setMemoryStore(`${CACHE_KEYS.IPFS_CONTENT}${cid}`, content, CACHE_TTL.IPFS_CONTENT);
    }
  }

  async getCachedIPFSContent(cid: string): Promise<any | null> {
    if (await this.ensureConnection()) {
      try {
        const key = `${CACHE_KEYS.IPFS_CONTENT}${cid}`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached IPFS content:', error);
        // Fallback to memory store
        return this.getMemoryStore(`${CACHE_KEYS.IPFS_CONTENT}${cid}`);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(`${CACHE_KEYS.IPFS_CONTENT}${cid}`);
    }
  }

  // Generic Query Caching
  async cacheQueryResult(queryKey: string, result: any, ttl?: number): Promise<void> {
    const key = `${CACHE_KEYS.FREQUENT_QUERIES}${queryKey}`;
    const cacheTTL = ttl || CACHE_TTL.FREQUENT_QUERIES;
    if (await this.ensureConnection()) {
      try {
        await this.redis!.setex(key, cacheTTL, JSON.stringify(result));
      } catch (error) {
        console.error('[REDIS] Failed to cache query result:', error);
        // Fallback to memory store
        this.setMemoryStore(key, result, cacheTTL);
      }
    } else {
      // Use memory store
      this.setMemoryStore(key, result, cacheTTL);
    }
  }

  async getCachedQueryResult(queryKey: string): Promise<any | null> {
    const key = `${CACHE_KEYS.FREQUENT_QUERIES}${queryKey}`;
    if (await this.ensureConnection()) {
      try {
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[REDIS] Failed to get cached query result:', error);
        // Fallback to memory store
        return this.getMemoryStore(key);
      }
    } else {
      // Use memory store
      return this.getMemoryStore(key);
    }
  }

  // Cache Management
  async clearAllCaches(): Promise<void> {
    if (await this.ensureConnection()) {
      try {
        await this.redis!.flushdb();
        console.log('[REDIS] Cleared all caches');
      } catch (error) {
        console.error('[REDIS] Failed to clear caches:', error);
        // Fallback to memory store
        this.memoryStore.clear();
      }
    } else {
      // Use memory store
      this.memoryStore.clear();
    }
  }

  async getCacheStats(): Promise<any> {
    if (await this.ensureConnection()) {
      try {
        const info = await this.redis!.info();
        const keyspace = await this.redis!.info('keyspace');
        return { info, keyspace };
      } catch (error) {
        console.error('[REDIS] Failed to get cache stats:', error);
        // Fallback to memory store
        return { memoryStoreSize: this.memoryStore.size };
      }
    } else {
      // Use memory store
      return { memoryStoreSize: this.memoryStore.size };
    }
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    if (!this.redis) {
      // If Redis is not available, consider memory store as healthy
      return true;
    }
    try {
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