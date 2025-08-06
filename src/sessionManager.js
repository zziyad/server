'use strict';

const redis = require('redis');
const logger = require('../lib/logger.js');

class SessionManager {
  constructor() {
    this.redis = redis.createClient();
    this.memoryFallback = new Map(); // In-memory fallback
    this.ttl = 21600; // 6 hours in seconds
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      redisErrors: 0,
      memoryFallbacks: 0
    };
    
    this.setupRedis();
  }

  setupRedis() {
    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
      this.metrics.redisErrors++;
    });

    this.redis.on('connect', () => {
      logger.system('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      logger.system('Redis ready for session management');
    });

    // Connect to Redis
    this.redis.connect().catch(err => {
      logger.error('Failed to connect to Redis:', err);
    });
  }

  async createSession(token, data) {
    try {
      const sessionData = {
        ...data,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.ttl * 1000).toISOString()
      };

      logger.debug(`Creating session with data:`, sessionData);

      // Check if Redis is connected
      if (this.redis.isReady) {
        // Store in Redis
        await this.redis.setEx(`session:${token}`, this.ttl, JSON.stringify(sessionData));
        logger.system(`Session stored in Redis: ${token}`);
        
        // Verify storage by retrieving it
        const stored = await this.redis.get(`session:${token}`);
        logger.debug(`Verification - stored session:`, stored ? 'FOUND' : 'NOT FOUND');
      } else {
        logger.debug('Redis not ready, using memory fallback only');
        this.metrics.memoryFallbacks++;
      }
      
      // Also store in memory as fallback
      this.memoryFallback.set(token, sessionData);
      
      this.metrics.totalSessions++;
      this.metrics.activeSessions++;
      
      logger.system(`Session created: ${token}`);
      return true;
    } catch (error) {
      logger.error('Session creation error:', error);
      // Fallback to memory only
      this.memoryFallback.set(token, data);
      this.metrics.memoryFallbacks++;
      return true;
    }
  }

  async getSession(token) {
    try {
      logger.debug(`Attempting to get session: ${token}`);
      
      // Check if Redis is connected and try Redis first
      if (this.redis.isReady) {
        const sessionData = await this.redis.get(`session:${token}`);
        logger.debug(`Redis lookup result:`, sessionData ? 'FOUND' : 'NOT FOUND');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          logger.debug(`Session retrieved from Redis:`, parsed);
          
          // Check if session is expired
          if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
            logger.debug(`Session expired: ${token}`);
            // Remove expired session
            await this.invalidateSession(token);
            return null;
          }
          
          return parsed;
        }
      }
      
      // Fallback to memory
      const memorySession = this.memoryFallback.get(token);
      logger.debug(`Memory lookup result:`, memorySession ? 'FOUND' : 'NOT FOUND');
      if (memorySession) {
        // Check if memory session is expired
        if (memorySession.expiresAt && new Date(memorySession.expiresAt).getTime() < Date.now()) {
          logger.debug(`Memory session expired: ${token}`);
          this.memoryFallback.delete(token);
          return null;
        }
        
        logger.debug(`Session restored from memory: ${token}`);
        this.metrics.memoryFallbacks++;
        return memorySession;
      }
      
      logger.debug(`No session found for token: ${token}`);
      return null;
    } catch (error) {
      logger.error('Session retrieval error:', error);
      // Fallback to memory
      const memorySession = this.memoryFallback.get(token);
      if (memorySession) {
        // Check if memory session is expired
        if (memorySession.expiresAt && new Date(memorySession.expiresAt).getTime() < Date.now()) {
          this.memoryFallback.delete(token);
          return null;
        }
        
        this.metrics.memoryFallbacks++;
        return memorySession;
      }
      return null;
    }
  }

  async invalidateSession(token) {
    try {
      // Check if Redis is connected
      if (this.redis.isReady) {
        // Remove from Redis
        await this.redis.del(`session:${token}`);
        logger.system(`Session removed from Redis: ${token}`);
      }
      
      // Remove from memory
      this.memoryFallback.delete(token);
      
      this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1);
      logger.system(`Session invalidated: ${token}`);
      return true;
    } catch (error) {
      logger.error('Session invalidation error:', error);
      // Remove from memory as fallback
      this.memoryFallback.delete(token);
      this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1);
      return true;
    }
  }

  async invalidateUserSessions(userId) {
    try {
      let invalidatedCount = 0;
      
      // Check if Redis is connected
      if (this.redis.isReady) {
        // Get all sessions and filter by userId
        const keys = await this.redis.keys('session:*');
        
        for (const key of keys) {
          const sessionData = await this.redis.get(key);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            if (session.id === userId) {
              await this.redis.del(key);
              invalidatedCount++;
            }
          }
        }
      }
      
      // Also check memory fallback
      for (const [token, session] of this.memoryFallback.entries()) {
        if (session.id === userId) {
          this.memoryFallback.delete(token);
          invalidatedCount++;
        }
      }
      
      this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - invalidatedCount);
      logger.system(`Invalidated ${invalidatedCount} sessions for user: ${userId}`);
      return invalidatedCount;
    } catch (error) {
      logger.error('User session invalidation error:', error);
      return 0;
    }
  }

  async invalidateAllSessions() {
    try {
      let redisCount = 0;
      
      // Check if Redis is connected
      if (this.redis.isReady) {
        // Clear Redis sessions
        const keys = await this.redis.keys('session:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
          redisCount = keys.length;
        }
      }
      
      // Clear memory fallback
      const memoryCount = this.memoryFallback.size;
      this.memoryFallback.clear();
      
      this.metrics.activeSessions = 0;
      logger.system(`Invalidated all sessions. Redis: ${redisCount}, Memory: ${memoryCount}`);
      return redisCount + memoryCount;
    } catch (error) {
      logger.error('All sessions invalidation error:', error);
      return 0;
    }
  }

  async getSessionAnalytics() {
    try {
      let redisKeys = 0;
      
      // Check if Redis is connected
      if (this.redis.isReady) {
        redisKeys = await this.redis.keys('session:*');
        redisKeys = redisKeys.length;
      }
      
      const memoryCount = this.memoryFallback.size;
      
      return {
        ...this.metrics,
        redisSessions: redisKeys,
        memorySessions: memoryCount,
        totalActive: redisKeys + memoryCount,
        uptime: process.uptime(),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Analytics error:', error);
      return {
        ...this.metrics,
        redisSessions: 0,
        memorySessions: this.memoryFallback.size,
        totalActive: this.memoryFallback.size,
        uptime: process.uptime(),
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async cleanupExpired() {
    try {
      // Redis handles expiration automatically
      // Just clean up memory fallback
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [token, session] of this.memoryFallback.entries()) {
        if (session.expiresAt && new Date(session.expiresAt).getTime() < now) {
          this.memoryFallback.delete(token);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.debug(`Cleaned up ${cleanedCount} expired sessions from memory`);
        this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - cleanedCount);
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Cleanup error:', error);
      return 0;
    }
  }

  async close() {
    try {
      if (this.redis.isReady) {
        await this.redis.quit();
      }
      logger.system('Session manager closed');
    } catch (error) {
      logger.error('Session manager close error:', error);
    }
  }
}

module.exports = { SessionManager }; 