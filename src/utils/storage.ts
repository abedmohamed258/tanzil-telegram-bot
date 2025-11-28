import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { logger } from './logger';
import { UserProfile, DownloadRecord, ScheduledTask, PlaylistSession } from '../types';

interface StorageData {
    users: Record<number, UserProfile>;
    scheduledTasks: ScheduledTask[];
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

    constructor(dataDir: string = './data') {
        this.filePath = path.join(dataDir, 'store.json');
        this.data = {
            users: {},
            scheduledTasks: [],
            settings: { maintenance: false }
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
                    this.data = { users: {}, scheduledTasks: [], settings: { maintenance: false } };

                    // Migrate users
                    for (const userId of rawData.users) {
                        this.data.users[userId] = this.createDefaultProfile(userId);
                        this.data.users[userId].isBanned = rawData.bannedUsers?.includes(userId) || false;
                    }

                    this.save();
                    logger.info('✅ Migration complete');
                } else {
                    this.data = rawData;
                    // Ensure scheduledTasks exists
                    if (!this.data.scheduledTasks) {
                        this.data.scheduledTasks = [];
                    }
                    // Ensure settings exists
                    if (!this.data.settings) {
                        this.data.settings = { maintenance: false };
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
                    }
                    if (migrated) {
                        logger.info('🔄 V3 Migration: Updated user profiles with new fields');
                        this.save();
                    }
                }

                logger.info('💾 Data loaded from storage', {
                    users: Object.keys(this.data.users).length,
                    tasks: this.data.scheduledTasks.length
                });
            } else {
                this.save(); // Create empty file
            }
        } catch (error) {
            logger.error('Failed to load storage data', { error });
            logger.error('Failed to load storage data', { error });
            // Initialize with empty if load fails to prevent crash
            this.data = { users: {}, scheduledTasks: [], settings: { maintenance: false } };
        }
    }

    /**
     * Save data to disk (debounced)
     * Schedules a save operation with 1000ms debounce
     * For immediate save, use forceSave()
     */
    public save(): void {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Schedule debounced save
        this.saveTimeout = setTimeout(() => {
            this.performSave().catch(error => {
                logger.error('Debounced save failed', { error });
            });
        }, 1000);
    }

    /**
     * Perform the actual save operation (async, atomic)
     */
    private async performSave(): Promise<void> {
        // Prevent concurrent saves
        if (this.saveInProgress) {
            return;
        }

        this.saveInProgress = true;

        try {
            const tempPath = `${this.filePath}.tmp`;
            const dataStr = JSON.stringify(this.data, null, 2);

            // Atomic write: write to temp file, then rename
            await fsPromises.writeFile(tempPath, dataStr, 'utf-8');
            await fsPromises.rename(tempPath, this.filePath);

            logger.debug('💾 Data saved to storage');
        } catch (error) {
            logger.error('Failed to save storage data', { error });
        } finally {
            this.saveInProgress = false;
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

    private createDefaultProfile(userId: number, firstName: string = 'Unknown'): UserProfile {
        const now = new Date().toISOString();
        return {
            id: userId,
            firstName,
            joinedAt: now,
            lastActive: now,
            isBanned: false,
            downloadHistory: [],
            credits: { used: 0, lastReset: now },
            timezone: 0,
            activePlaylist: null
        };
    }

    /**
     * Update or create a user profile
     */
    updateUser(user: { id: number; first_name: string; last_name?: string; username?: string }): void {
        const userId = user.id;
        const now = new Date().toISOString();

        if (!this.data.users[userId]) {
            // New User
            this.data.users[userId] = {
                ...this.createDefaultProfile(userId, user.first_name),
                lastName: user.last_name,
                username: user.username
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
     * Ban a user
     */
    async banUser(userId: number): Promise<void> {
        if (this.data.users[userId]) {
            this.data.users[userId].isBanned = true;
            await this.forceSave();
            logger.info('🚫 User banned', { userId });
        } else {
            // Create a skeleton profile if banning a user not in DB (rare)
            this.data.users[userId] = {
                ...this.createDefaultProfile(userId, 'Banned User'),
                isBanned: true
            };
            await this.forceSave();
        }
    }

    /**
     * Unban a user
     */
    async unbanUser(userId: number): Promise<void> {
        if (this.data.users[userId]) {
            this.data.users[userId].isBanned = false;
            await this.forceSave();
            logger.info('✅ User unbanned', { userId });
        }
    }

    /**
     * Check if user is banned
     */
    isBanned(userId: number): boolean {
        return this.data.users[userId]?.isBanned || false;
    }

    // =========================================================================
    // V3 Features: Credits, Timezone, Playlists, Scheduling
    // =========================================================================

    /**
     * Get user credits
     */
    getCredits(userId: number): { used: number; remaining: number; limit: number } {
        const user = this.data.users[userId];
        if (!user) return { used: 0, remaining: 0, limit: 0 };

        const limit = 100; // Daily Limit (Hardcoded for now, can be config)

        // Check for daily reset
        const lastReset = new Date(user.credits.lastReset);
        const now = new Date();
        if (lastReset.getDate() !== now.getDate() || lastReset.getMonth() !== now.getMonth()) {
            user.credits.used = 0;
            user.credits.lastReset = now.toISOString();
            this.save();
        }

        return {
            used: user.credits.used,
            remaining: Math.max(0, limit - user.credits.used),
            limit
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
            this.data.users[userId].credits.used = Math.max(0, this.data.users[userId].credits.used - amount);
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
    async setPlaylistSession(userId: number, session: PlaylistSession | null): Promise<void> {
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
        this.data.scheduledTasks = this.data.scheduledTasks.filter(t => t.id !== taskId);
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
        logger.info(enabled ? '🚧 Maintenance mode ENABLED' : '✅ Maintenance mode DISABLED');
    }
}
