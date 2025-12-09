/**
 * RateLimiter - Controls request rates to prevent abuse
 * Implements per-user and global rate limiting
 */

import { logger } from '../../utils/logger';
import { RateLimitInfo } from '../core/types';

interface RateLimitEntry {
    count: number;
    windowStart: Date;
    lastRequest: Date;
}

export class RateLimiter {
    private readonly userLimits = new Map<number, RateLimitEntry>();
    private readonly ipLimits = new Map<string, RateLimitEntry>();
    private globalCount = 0;
    private globalWindowStart = new Date();

    private readonly config: {
        userMaxRequests: number;
        userWindowMs: number;
        globalMaxRequests: number;
        globalWindowMs: number;
        burstLimit: number;
        burstWindowMs: number;
    };

    constructor(config?: Partial<RateLimiter['config']>) {
        this.config = {
            userMaxRequests: 30,      // 30 requests per user
            userWindowMs: 60000,      // per minute
            globalMaxRequests: 100,   // 100 total requests
            globalWindowMs: 60000,    // per minute
            burstLimit: 5,            // 5 rapid requests
            burstWindowMs: 10000,     // in 10 seconds
            ...config,
        };

        // Cleanup old entries periodically
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if user can make a request
     */
    checkLimit(userId: number): RateLimitInfo {
        const now = new Date();
        let entry = this.userLimits.get(userId);

        // Reset window if expired
        if (entry && now.getTime() - entry.windowStart.getTime() > this.config.userWindowMs) {
            entry = undefined;
        }

        if (!entry) {
            entry = { count: 0, windowStart: now, lastRequest: now };
            this.userLimits.set(userId, entry);
        }

        // Check burst limit
        const timeSinceLastRequest = now.getTime() - entry.lastRequest.getTime();
        if (timeSinceLastRequest < this.config.burstWindowMs) {
            const recentCount = entry.count;
            if (recentCount >= this.config.burstLimit) {
                const resetTime = new Date(entry.lastRequest.getTime() + this.config.burstWindowMs);
                return {
                    userId,
                    requestsRemaining: 0,
                    resetTime,
                    isLimited: true,
                };
            }
        }

        // Check window limit
        if (entry.count >= this.config.userMaxRequests) {
            const resetTime = new Date(entry.windowStart.getTime() + this.config.userWindowMs);
            return {
                userId,
                requestsRemaining: 0,
                resetTime,
                isLimited: true,
            };
        }

        return {
            userId,
            requestsRemaining: this.config.userMaxRequests - entry.count,
            resetTime: new Date(entry.windowStart.getTime() + this.config.userWindowMs),
            isLimited: false,
        };
    }

    /**
     * Check global rate limit
     */
    checkGlobalLimit(): { allowed: boolean; retryAfter?: number } {
        const now = new Date();

        // Reset window if expired
        if (now.getTime() - this.globalWindowStart.getTime() > this.config.globalWindowMs) {
            this.globalCount = 0;
            this.globalWindowStart = now;
        }

        if (this.globalCount >= this.config.globalMaxRequests) {
            const retryAfter = this.config.globalWindowMs - (now.getTime() - this.globalWindowStart.getTime());
            return { allowed: false, retryAfter };
        }

        return { allowed: true };
    }

    /**
     * Record a request
     */
    recordRequest(userId: number): void {
        const now = new Date();

        // Update user entry
        let entry = this.userLimits.get(userId);
        if (!entry || now.getTime() - entry.windowStart.getTime() > this.config.userWindowMs) {
            entry = { count: 1, windowStart: now, lastRequest: now };
        } else {
            entry.count++;
            entry.lastRequest = now;
        }
        this.userLimits.set(userId, entry);

        // Update global count
        if (now.getTime() - this.globalWindowStart.getTime() > this.config.globalWindowMs) {
            this.globalCount = 1;
            this.globalWindowStart = now;
        } else {
            this.globalCount++;
        }

        logger.debug('Rate limit recorded', { userId, count: entry.count, global: this.globalCount });
    }

    /**
     * Check and record in one operation
     */
    consume(userId: number): RateLimitInfo {
        const info = this.checkLimit(userId);

        if (!info.isLimited) {
            const globalCheck = this.checkGlobalLimit();
            if (!globalCheck.allowed) {
                return {
                    ...info,
                    isLimited: true,
                    requestsRemaining: 0,
                };
            }
            this.recordRequest(userId);
        }

        return info;
    }

    /**
     * Reset limits for a user
     */
    resetUser(userId: number): void {
        this.userLimits.delete(userId);
        logger.info('Rate limit reset for user', { userId });
    }

    /**
     * Get current stats
     */
    getStats(): {
        activeUsers: number;
        globalCount: number;
        globalRemaining: number;
    } {
        return {
            activeUsers: this.userLimits.size,
            globalCount: this.globalCount,
            globalRemaining: this.config.globalMaxRequests - this.globalCount,
        };
    }

    /**
     * Cleanup old entries
     */
    private cleanup(): void {
        const now = Date.now();
        const expiredThreshold = this.config.userWindowMs * 2;

        for (const [userId, entry] of this.userLimits) {
            if (now - entry.windowStart.getTime() > expiredThreshold) {
                this.userLimits.delete(userId);
            }
        }

        for (const [ip, entry] of this.ipLimits) {
            if (now - entry.windowStart.getTime() > expiredThreshold) {
                this.ipLimits.delete(ip);
            }
        }
    }

    /**
     * Shutdown cleanup
     */
    shutdown(): void {
        this.userLimits.clear();
        this.ipLimits.clear();
        this.globalCount = 0;
    }
}
