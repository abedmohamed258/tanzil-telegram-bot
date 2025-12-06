import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

/**
 * FileManager - Manages temporary file storage
 * Implements Property 18 (File Cleanup After Upload) and Property 19 (Session Cleanup)
 * Critical: Handles Render's ephemeral disk storage
 */
export class FileManager {
  private readonly tempDir: string;

  constructor(tempDirectory: string = '/tmp/tanzil-downloads') {
    this.tempDir = tempDirectory;
  }

  /**
   * Initialize temp directory (create if doesn't exist)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info('📁 Temp directory initialized', { path: this.tempDir });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
      throw error;
    }
  }

  /**
   * Create a temporary path for a session
   */
  createTempPath(sessionId: string, filename: string = 'video.mp4'): string {
    const sessionDir = path.join(this.tempDir, sessionId);
    return path.join(sessionDir, filename);
  }

  /**
   * Create session directory
   */
  async createSessionDir(sessionId: string): Promise<string> {
    try {
      const sessionDir = path.join(this.tempDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });
      return sessionDir;
    } catch (error) {
      logger.error('Failed to create session directory', { sessionId, error });
      throw error;
    }
  }

  /**
   * Delete a file (Property 18: File Cleanup After Upload)
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('🗑️ File deleted', { path: filePath });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        logger.error('Failed to delete file', {
          path: filePath,
          error: err.message,
        });
      }
    }
  }

  /**
   * Clean up entire session directory (Property 19: Session Cleanup Completeness)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const sessionDir = path.join(this.tempDir, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      logger.info('🗑️ Session cleaned up', { sessionId });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        logger.error('Failed to cleanup session', {
          sessionId,
          error: err.message,
        });
      }
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      logger.error('Failed to get file size', { path: filePath, error });
      return 0;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old files (for maintenance)
   * Render ephemeral storage makes this less critical, but good practice
   */
  async cleanupOldFiles(maxAgeMinutes: number = 60): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();

      const cleanupPromises = files.map(async (file) => {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;

          if (ageMinutes > maxAgeMinutes) {
            if (stats.isDirectory()) {
              await fs.rm(filePath, { recursive: true, force: true });
            } else {
              await fs.unlink(filePath);
            }
            logger.info('🗑️ Old file/directory cleaned', {
              path: filePath,
              ageMinutes: ageMinutes.toFixed(1),
            });
          }
        } catch (err: unknown) {
          logger.warn('Failed to process file for cleanup', {
            filePath,
            error: (err as Error).message,
          });
        }
      });

      await Promise.allSettled(cleanupPromises);
    } catch (error: unknown) {
      logger.error('Failed to cleanup old files', { error });
    }
  }
}
