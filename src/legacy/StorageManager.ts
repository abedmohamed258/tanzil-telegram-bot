import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import {
  UserProfile,
  DownloadRecord,
  ScheduledTask,
  PlaylistSession,
  BlockRecord,
} from '../types';

interface FileCache {
  [url: string]: {
    [format: string]: string; // file_id
  };
}

interface StorageData {
  users: Record<number, UserProfile>;
  scheduledTasks: ScheduledTask[];
  fileCache?: FileCache;
  settings: {
    maintenance: boolean;
  };
}

/**
 * StorageManager - Handles persistent data storage
 * Stores detailed user profiles, history, and scheduled tasks
 */
export class StorageManager {
  private data: StorageData;
  private readonly filePath: string;
  private saveTimeout?: NodeJS.Timeout;
  private saveInProgress: boolean = false;

  private readonly dailyLimit: number;

  constructor(dataDir: string = './data', dailyLimit: number = 100) {
    this.dailyLimit = dailyLimit;
    this.filePath = path.join(dataDir, 'store.json');
    this.data = {
      users: {},
      scheduledTasks: [],
      settings: { maintenance: false },
    };

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.load();
  }

  /**
   * Load data from disk with migration support
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        const rawData = JSON.parse(fileContent);

        // Migration Logic: Check if users is an array (Legacy)
        if (Array.isArray(rawData.users)) {
          logger.info('🔄 Migrating legacy storage data...');
          this.data = {
            users: {},
            scheduledTasks: [],
            settings: { maintenance: false },
          };

          // Migrate users
          for (const userId of rawData.users) {
            this.data.users[userId] = this.createDefaultProfile(userId);
            if (rawData.bannedUsers?.includes(userId)) {
              this.data.users[userId].blockRecord = {
                type: 'perm',
                reason: 'Legacy Ban',
                blockedAt: Date.now(),
                blockedBy: 0,
              };
            }
          }

          this.save();
          logger.info('✅ Migration complete');
        } else {
          this.data = rawData;
          // Ensure scheduledTasks exists
          if (!this.data.scheduledTasks) {
            this.data.scheduledTasks = [];
          }
          if (!this.data.settings) {
            this.data.settings = { maintenance: false };
          }
          // Ensure fileCache exists
          if (!this.data.fileCache) {
            this.data.fileCache = {};
          }
          // V3 Migration: Ensure all users have new fields
          let migrated = false;
          for (const userId in this.data.users) {
            const user = this.data.users[userId];
            if (!user.credits) {
              user.credits = { used: 0, lastReset: new Date().toISOString() };
              user.timezone = 0;
              user.activePlaylist = null;
              migrated = true;
            }
            // V4 Migration: isBanned -> blockRecord
            if ((user as any).isBanned) {
              user.blockRecord = {
                type: 'perm',
                reason: 'Legacy Ban (Migration)',
                blockedAt: Date.now(),
                blockedBy: 0,
              };
              delete (user as any).isBanned;
              migrated = true;
            }
          }
          if (migrated) {
            logger.info(
              '🔄 V3 Migration: Updated user profiles with new fields',
            );
            this.save();
          }
        }

        logger.info('💾 Data loaded from storage', {
          users: Object.keys(this.data.users).length,
          tasks: this.data.scheduledTasks.length,
        });
      } else {
        this.save(); // Create empty file
      }
    } catch (error) {
      logger.error('Failed to load storage data', { error });
      logger.error('Failed to load storage data', { error });
      // Initialize with empty if load fails to prevent crash
      this.data = {
        users: {},
        scheduledTasks: [],
        settings: { maintenance: false },
      };
    }
  }

  /**
   * Save data to disk (Queue-based to prevent race conditions)
   */
  public save(): void {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Schedule debounced save
    this.saveTimeout = setTimeout(() => {
      this.enqueueSave();
    }, 1000);
  }

  /**
   * Enqueue a save operation
   */
  private async enqueueSave(): Promise<void> {
    if (this.saveInProgress) {
      // If save is in progress, just mark that we need another save after
      // This is a simple form of coalescing
      this.saveTimeout = setTimeout(() => this.enqueueSave(), 1000);
      return;
    }

    this.saveInProgress = true;

    try {
      await this.performSave();
    } catch (error) {
      logger.error('Save failed', { error });
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Perform the actual save operation (async, atomic)
   */
  private async performSave(): Promise<void> {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const dataStr = JSON.stringify(this.data, null, 2);

      // Atomic write: write to temp file, then rename
      await fsPromises.writeFile(tempPath, dataStr, 'utf-8');
      await fsPromises.rename(tempPath, this.filePath);

      logger.debug('💾 Data saved to storage');
    } catch (error) {
      logger.error('Failed to save storage data', { error });
      throw error;
    }
  }

  /**
   * Force immediate save (for critical operations)
   */
  public async forceSave(): Promise<void> {
    // Clear any pending debounced save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = undefined;
    }

    await this.performSave();
  }

  /**
   * Force save all data immediately (Alias for forceSave with logging)
   * Used during graceful shutdown
   */
  public async forceSaveAll(): Promise<void> {
    logger.info('💾 Forcing immediate save of all data...');
    await this.forceSave();
  }

  private createDefaultProfile(
    userId: number,
    firstName: string = 'Unknown',
  ): UserProfile {
    const now = new Date().toISOString();
    return {
      id: userId,
      firstName,
      joinedAt: now,
      lastActive: now,
      downloadHistory: [],
      credits: { used: 0, lastReset: now },
      timezone: 0,
      activePlaylist: null,
    };
  }

  /**
   * Update or create a user profile
   */
  updateUser(user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  }): void {
    const userId = user.id;
    const now = new Date().toISOString();

    if (!this.data.users[userId]) {
      // New User
      this.data.users[userId] = {
        ...this.createDefaultProfile(userId, user.first_name),
        lastName: user.last_name,
        username: user.username,
      };
      logger.info('👤 New user profile created', { userId });
    } else {
      // Update existing
      this.data.users[userId].firstName = user.first_name;
      this.data.users[userId].lastName = user.last_name;
      this.data.users[userId].username = user.username;
      this.data.users[userId].lastActive = now;
    }
    this.save();
  }

  /**
   * Add a download record to user history
   */
  addDownload(userId: number, record: DownloadRecord): void {
    if (this.data.users[userId]) {
      this.data.users[userId].downloadHistory.push(record);
      // Limit history to last 50 items to prevent infinite growth
      if (this.data.users[userId].downloadHistory.length > 50) {
        this.data.users[userId].downloadHistory.shift();
      }
      this.save();
    }
  }

  /**
   * Get user profile
   */
  getUser(userId: number): UserProfile | undefined {
    return this.data.users[userId];
  }

  /**
   * Get all users
   */
  getAllUsers(): UserProfile[] {
    return Object.values(this.data.users);
  }

  /**
   * Update block record for a user
   */
  async updateBlockRecord(
    userId: number,
    record: BlockRecord | null,
  ): Promise<void> {
    if (this.data.users[userId]) {
      if (record) {
        this.data.users[userId].blockRecord = record;
      } else {
        delete this.data.users[userId].blockRecord;
      }
      await this.forceSave();
    } else if (record) {
      // Create skeleton if blocking unknown user
      this.data.users[userId] = {
        ...this.createDefaultProfile(userId, 'Blocked User'),
        blockRecord: record,
      };
      await this.forceSave();
    }
  }

  // =========================================================================
  // V3 Features: Credits, Timezone, Playlists, Scheduling
  // =========================================================================

  /**
   * Get user credits
   */
  getCredits(userId: number): {
    used: number;
    remaining: number;
    limit: number;
  } {
    const user = this.data.users[userId];
    if (!user) return { used: 0, remaining: 0, limit: 0 };

    const limit = this.dailyLimit;

    // Check for daily reset
    const lastReset = new Date(user.credits.lastReset);
    const now = new Date();
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth()
    ) {
      user.credits.used = 0;
      user.credits.lastReset = now.toISOString();
      this.save();
    }

    return {
      used: user.credits.used,
      remaining: Math.max(0, limit - user.credits.used),
      limit,
    };
  }

  /**
   * Use credits (Critical Operation - Forces Save)
   */
  async useCredits(userId: number, amount: number): Promise<boolean> {
    const { remaining } = this.getCredits(userId);
    if (remaining >= amount) {
      this.data.users[userId].credits.used += amount;
      await this.forceSave(); // Force save immediately
      return true;
    }
    return false;
  }

  /**
   * Refund credits
   */
  refundCredits(userId: number, amount: number): void {
    if (this.data.users[userId]) {
      this.data.users[userId].credits.used = Math.max(
        0,
        this.data.users[userId].credits.used - amount,
      );
      this.save();
      logger.info('💰 Credits refunded', { userId, amount });
    }
  }

  /**
   * Reset user credits (Admin)
   */
  resetCredits(userId: number): void {
    if (this.data.users[userId]) {
      this.data.users[userId].credits.used = 0;
      this.data.users[userId].credits.lastReset = new Date().toISOString();
      this.save();
    }
  }

  /**
   * Set user timezone
   */
  setTimezone(userId: number, offset: number): void {
    if (this.data.users[userId]) {
      this.data.users[userId].timezone = offset;
      this.save();
    }
  }

  /**
   * Set active playlist session (Critical State - Forces Save)
   */
  async setPlaylistSession(
    userId: number,
    session: PlaylistSession | null,
  ): Promise<void> {
    if (this.data.users[userId]) {
      this.data.users[userId].activePlaylist = session;
      await this.forceSave(); // Force save immediately
    }
  }

  /**
   * Get scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    return this.data.scheduledTasks;
  }

  /**
   * Add scheduled task
   */
  addScheduledTask(task: ScheduledTask): void {
    this.data.scheduledTasks.push(task);
    this.save();
  }

  /**
   * Remove scheduled task
   */
  removeScheduledTask(taskId: string): void {
    this.data.scheduledTasks = this.data.scheduledTasks.filter(
      (t) => t.id !== taskId,
    );
    this.save();
  }

  /**
   * Check if maintenance mode is enabled
   */
  public isMaintenanceMode(): boolean {
    return this.data.settings.maintenance;
  }

  /**
   * Enable/Disable maintenance mode
   */
  public async setMaintenanceMode(enabled: boolean): Promise<void> {
    this.data.settings.maintenance = enabled;
    await this.forceSave();
    logger.info(
      enabled ? '🚧 Maintenance mode ENABLED' : '✅ Maintenance mode DISABLED',
    );
  }

  // =========================================================================
  // Rocket Speed Features: File ID Caching
  // =========================================================================

  public getCachedFile(url: string, format: string): string | null {
    if (this.data.fileCache?.[url]?.[format]) {
      return this.data.fileCache[url][format];
    }
    return null;
  }

  public async saveCachedFile(
    url: string,
    format: string,
    fileId: string,
  ): Promise<void> {
    if (!this.data.fileCache) this.data.fileCache = {};
    if (!this.data.fileCache[url]) this.data.fileCache[url] = {};

    this.data.fileCache[url][format] = fileId;
    this.save(); // Light save (Debounced)
  }
}
