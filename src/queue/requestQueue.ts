import { DownloadRequest, QueueStatus } from '../types';
import { ResourceMonitor } from '../utils/ResourceMonitor';
import { logger } from '../utils/logger';

/**
 * RequestQueue - Manages download requests with concurrency limit
 * CRITICAL for Render Free Tier (512MB RAM) - limits concurrent downloads to 2
 * Implements the queue system from design.md
 */
export class RequestQueue {
  private queue: DownloadRequest[] = [];
  private processing: Set<string> = new Set();
  private readonly maxConcurrent: number;
  private readonly monitor: ResourceMonitor;
  private processingCallback?: (request: DownloadRequest) => Promise<void>;
  private onQueueChange?: (queue: DownloadRequest[]) => void;
  private isProcessingNext: boolean = false;

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
    this.monitor = new ResourceMonitor();
    logger.info('🎯 RequestQueue initialized', { maxConcurrent });
  }

  /**
   * Set the callback function to process download requests
   */
  setProcessingCallback(
    callback: (request: DownloadRequest) => Promise<void>,
  ): void {
    this.processingCallback = callback;
  }

  /**
   * Set callback for queue changes
   */
  setOnQueueChange(callback: (queue: DownloadRequest[]) => void): void {
    this.onQueueChange = callback;
  }

  private notifyQueueChange(): void {
    if (this.onQueueChange) {
      this.onQueueChange([...this.queue]);
    }
  }

  /**
   * Add a request to the queue
   * Returns the queue position
   */
  async addRequest(request: DownloadRequest): Promise<number> {
    this.queue.push(request);
    logger.info('📥 Request added to queue', {
      requestId: request.id,
      userId: request.userId,
      position: this.queue.length,
      processing: this.processing.size,
    });

    // Try to process immediately if capacity available
    this.processNext();

    this.notifyQueueChange();

    return this.queue.length;
  }

  /**
   * Process the next request in queue if capacity allows
   */
  async processNext(): Promise<void> {
    // Prevent re-entry/race conditions in the decision phase
    if (this.isProcessingNext) return;
    this.isProcessingNext = true;

    let request: DownloadRequest | undefined;

    try {
      // Check if we can process more requests
      if (this.processing.size >= this.maxConcurrent) {
        logger.debug('⏸️ Max concurrent downloads reached', {
          processing: this.processing.size,
          maxConcurrent: this.maxConcurrent,
        });
        return;
      }

      // Check memory before processing
      if (!this.monitor.checkMemory()) {
        logger.warn('⏸️ Queue paused due to high memory usage');
        await this.monitor.cleanup();

        // Re-check concurrency limit to prevent race condition
        if (this.processing.size >= this.maxConcurrent) {
          return;
        }

        // Retry after cleanup delay (Faster recovery)
        setTimeout(() => this.processNext(), 1000);
        return;
      }

      // Check if circuit breaker is open
      if (this.monitor.isCircuitOpen()) {
        logger.warn('⏸️ Queue paused - circuit breaker open');
        setTimeout(() => this.processNext(), 5000);
        return;
      }

      // Get next request from queue
      request = this.queue.shift();
      if (request) {
        this.notifyQueueChange();
        // Mark as processing immediately inside the lock
        this.processing.add(request.id);
        logger.info('▶️ Processing request', {
          requestId: request.id,
          userId: request.userId,
          processing: this.processing.size,
          queued: this.queue.length,
        });
      }
    } finally {
      // Release the lock so other calls can check capacity (which is now updated)
      this.isProcessingNext = false;
    }

    // Process the request (outside the lock to allow concurrency)
    if (request) {
      try {
        if (this.processingCallback) {
          await this.processingCallback(request);
        } else {
          logger.error('No processing callback set for RequestQueue');
        }
      } catch (error: unknown) {
        logger.error('Failed to process request', {
          requestId: request.id,
          error: (error as Error).message,
        });
      } finally {
        // Remove from processing set
        this.processing.delete(request.id);

        // Try to process next request
        setImmediate(() => this.processNext());
      }
    }
  }

  /**
   * Get queue status for a user
   */
  getQueueStatus(userId: number): QueueStatus {
    const position = this.queue.findIndex((r) => r.userId === userId) + 1;

    // Estimate wait time based on position and average processing time
    const avgProcessingTime = 120; // 2 minutes average per video
    const estimatedWaitTime =
      position > 0
        ? Math.ceil((position / this.maxConcurrent) * avgProcessingTime)
        : 0;

    return {
      position,
      totalInQueue: this.queue.length,
      estimatedWaitTime,
    };
  }

  /**
   * Remove a request from the queue
   * Returns true if removed, false if not found
   */
  removeRequest(requestId: string): boolean {
    const index = this.queue.findIndex((r) => r.id === requestId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      logger.info('🗑️ Request removed from queue', { requestId });
      this.notifyQueueChange();
      return true;
    }
    return false;
  }

  /**
   * Purge all requests for a specific user
   * Used for Hard Ban
   */
  purgeUser(userId: number): void {
    const initialCount = this.queue.length;
    this.queue = this.queue.filter((r) => r.userId !== userId);
    const removedCount = initialCount - this.queue.length;

    if (removedCount > 0) {
      logger.info('🗑️ Purged user requests from queue', {
        userId,
        count: removedCount,
      });
      this.notifyQueueChange();
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): {
    processing: number;
    queued: number;
    memoryStats: { heapUsed: string; heapTotal: string; percentage: string };
  } {
    return {
      processing: this.processing.size,
      queued: this.queue.length,
      memoryStats: this.monitor.getMemoryStats(),
    };
  }

  /**
   * Check if queue is currently processing requests
   */
  isProcessing(): boolean {
    return this.processing.size > 0;
  }

  /**
   * Get number of requests being processed
   */
  getProcessingCount(): number {
    return this.processing.size;
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Stop queue processing - clears queue and resets state
   * Used during bot shutdown
   */
  stop(): void {
    const queuedCount = this.queue.length;
    const processingCount = this.processing.size;

    if (queuedCount > 0 || processingCount > 0) {
      logger.info('🛑 Stopping RequestQueue', {
        queued: queuedCount,
        processing: processingCount,
      });
    }

    // Clear the queue (processing requests will finish naturally)
    this.queue = [];
    // Note: Don't clear processing set - let active downloads complete

    logger.debug('RequestQueue stopped');
  }
}
