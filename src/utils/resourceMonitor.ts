import { logger } from './logger';

/**
 * ResourceMonitor - Monitors RAM usage and implements circuit breaker
 * Critical for Render Free Tier (512MB RAM limitation)
 */
export class ResourceMonitor {
  private readonly RAM_LIMIT = 512 * 1024 * 1024; // 512MB in bytes
  private readonly THRESHOLD = 0.9; // 90% threshold
  private circuitOpen = false;

  /**
   * Check if memory usage is within safe limits
   * Returns false if circuit breaker is activated (RAM > 90%)
   */
  checkMemory(): boolean {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const percentage = heapUsed / this.RAM_LIMIT;

    if (percentage > this.THRESHOLD) {
      this.circuitOpen = true;
      logger.error('⚠️ RAM usage critical - Circuit breaker activated', {
        heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)}MB`,
        percentage: `${(percentage * 100).toFixed(2)}%`,
        limit: '512MB',
      });
      return false;
    }

    // Reset circuit if usage is back to normal
    if (this.circuitOpen && percentage < 0.7) {
      this.circuitOpen = false;
      logger.info('✅ Circuit breaker reset - RAM usage normal');
    }

    return true;
  }

  /**
   * Trigger manual garbage collection if available
   */
  async cleanup(): Promise<void> {
    if (global.gc) {
      global.gc();
      logger.info('🗑️ Manual garbage collection triggered');
    } else {
      logger.warn('Garbage collection not exposed. Run with --expose-gc flag.');
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): {
    heapUsed: string;
    heapTotal: string;
    percentage: string;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      percentage: `${((usage.heapUsed / this.RAM_LIMIT) * 100).toFixed(2)}%`,
    };
  }

  /**
   * Check if circuit breaker is currently open
   */
  isCircuitOpen(): boolean {
    return this.circuitOpen;
  }
}
