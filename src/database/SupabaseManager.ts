import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  DownloadRecord,
  ScheduledTask,
  PlaylistSession,
  BlockRecord,
  DbUserRecord,
  DbUpdateData,
} from '../types';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

interface FileCache {
  [url: string]: {
    [format: string]: string; // file_id
  };
}

export class SupabaseManager {
  private supabase: SupabaseClient;
  private dailyLimit: number;
  private userCache: Map<number, UserProfile> = new Map();
  private fileCache: FileCache = {};

  constructor(dailyLimit: number = 100) {
    this.dailyLimit = dailyLimit;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing Supabase credentials in .env');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    logger.info('🔌 Connected to Supabase');
    this.loadFileCache();
    this.loadSettings();
  }

  private async loadFileCache() {
    // In a real scenario, this might load from a separate table or Redis
    // For now, we keep it in memory as per "Rocket Speed" tip (ephemeral cache)
  }

  /**
   * جلب أو إنشاء مستخدم (Hybrid Cache)
   */
  async getUser(userId: number): Promise<UserProfile | null> {
    // 1. Check Cache (RAM) - Ultra Fast
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    // 2. Fetch from DB
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    const profile = this.mapDbUserToProfile(data);
    this.userCache.set(userId, profile); // Cache it
    return profile;
  }

  /**
   * تحديث بيانات المستخدم (Upsert)
   */
  async updateUser(user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    preferredQuality?: string;
  }): Promise<void> {
    const now = new Date().toISOString();

    // Update DB
    const updateData: DbUpdateData = {
      id: user.id,
      last_active: now,
    };
    if (user.first_name !== undefined) updateData.first_name = user.first_name;
    if (user.last_name !== undefined) updateData.last_name = user.last_name;
    if (user.username !== undefined) updateData.username = user.username;
    if (user.preferredQuality !== undefined)
      updateData.preferred_quality = user.preferredQuality;

    const { error } = await this.supabase
      .from('users')
      .upsert(updateData, { onConflict: 'id' });

    if (error) {
      logger.error('Supabase: Failed to update user', {
        userId: user.id,
        error,
      });
      return;
    }

    // Update Cache
    const cachedUser = this.userCache.get(user.id);
    if (cachedUser) {
      if (user.first_name) cachedUser.firstName = user.first_name;
      if (user.last_name) cachedUser.lastName = user.last_name;
      if (user.username) cachedUser.username = user.username;
      if (user.preferredQuality)
        cachedUser.preferredQuality = user.preferredQuality;
      cachedUser.lastActive = now;
      this.userCache.set(user.id, cachedUser);
    }
  }

  /**
   * إضافة سجل تحميل
   */
  async addDownload(userId: number, record: DownloadRecord): Promise<void> {
    // Fire & Forget for speed
    this.supabase
      .from('download_history')
      .insert({
        user_id: userId,
        title: record.title,
        url: record.url,
        format: record.format,
        filename: record.filename,
        created_at: record.date,
      })
      .then(({ error }) => {
        if (error) logger.error('Supabase: Failed to add download log', error);
      });

    // Update cache history if needed (optional, might grow too large)
    // For now we don't cache history in the UserProfile to save RAM
  }

  /**
   * إدارة الرصيد (Credits) - Hybrid
   */
  async getCredits(
    userId: number,
  ): Promise<{ used: number; remaining: number; limit: number }> {
    const user = await this.getUser(userId);
    if (!user) return { used: 0, remaining: 0, limit: 0 };

    const lastReset = new Date(user.credits.lastReset);
    const now = new Date();

    // Check Daily Reset
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth()
    ) {
      user.credits.used = 0;
      user.credits.lastReset = now.toISOString();
      this.userCache.set(userId, user); // Update Cache

      // Sync DB in background
      this.supabase
        .from('users')
        .update({
          credits_used: 0,
          credits_last_reset: now.toISOString(),
        })
        .eq('id', userId)
        .then();

      return { used: 0, remaining: this.dailyLimit, limit: this.dailyLimit };
    }

    return {
      used: user.credits.used,
      remaining: Math.max(0, this.dailyLimit - user.credits.used),
      limit: this.dailyLimit,
    };
  }

  async useCredits(userId: number, amount: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Check Daily Reset logic implicitly via getCredits or just check here?
    // To be safe and fast, we assume getCredits was called or we check reset here too.
    // But for max speed, we just check current values.
    // Ideally getCredits is called before useCredits in the flow, but let's be safe.

    const remaining = Math.max(0, this.dailyLimit - user.credits.used);

    if (remaining >= amount) {
      user.credits.used += amount;
      this.userCache.set(userId, user); // Update Cache immediately

      // Fire & Forget DB Update
      this.supabase
        .from('users')
        .update({ credits_used: user.credits.used })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) logger.error('Supabase: Failed to update credits', error);
        });
      return true;
    }
    return false;
  }

  async refundCredits(userId: number, amount: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    user.credits.used = Math.max(0, user.credits.used - amount);
    this.userCache.set(userId, user);

    // Fire & Forget
    this.supabase
      .from('users')
      .update({ credits_used: user.credits.used })
      .eq('id', userId)
      .then();
  }

  async resetCredits(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.credits.used = 0;
      this.userCache.set(userId, user);
    }

    await this.supabase
      .from('users')
      .update({ credits_used: 0 })
      .eq('id', userId);
  }

  /**
   * الحظر (Blocking)
   */
  async updateBlockRecord(
    userId: number,
    record: BlockRecord | null,
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.blockRecord = record || undefined;
      this.userCache.set(userId, user);
    }

    await this.supabase
      .from('users')
      .update({ block_record: record })
      .eq('id', userId);
  }

  /**
   * Playlist Session
   */
  async setPlaylistSession(
    userId: number,
    session: PlaylistSession | null,
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.activePlaylist = session;
      this.userCache.set(userId, user);
    }

    // Fire & Forget for playlist session to speed up UI
    this.supabase
      .from('users')
      .update({ active_playlist: session })
      .eq('id', userId)
      .then();
  }

  /**
   * Timezone
   */
  async setTimezone(userId: number, offset: number): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (user) {
        user.timezone = offset;
        this.userCache.set(userId, user);
      }

      const { error } = await this.supabase
        .from('users')
        .update({ timezone: offset })
        .eq('id', userId);

      if (error) {
        logger.error('Failed to set timezone', { userId, offset, error });
      }
    } catch (error) {
      logger.error('Error setting timezone', { userId, offset, error });
      throw error;
    }
  }

  /**
   * Get all users (for broadcast)
   * Warning: This can be heavy!
   */
  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await this.supabase.from('users').select('*');

    if (error || !data) return [];
    return data.map((u) => this.mapDbUserToProfile(u));
  }

  /**
   * Get download history for a user
   */
  async getDownloadHistory(userId: number): Promise<DownloadRecord[]> {
    const { data, error } = await this.supabase
      .from('download_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d) => ({
      title: d.title,
      url: d.url,
      format: d.format,
      filename: d.filename,
      date: d.created_at,
      timestamp: new Date(d.created_at).getTime(),
    }));
  }

  // =========================================================================
  // Scheduled Tasks
  // =========================================================================

  async getScheduledTasks(): Promise<ScheduledTask[]> {
    const { data, error } = await this.supabase
      .from('scheduled_tasks')
      .select('*');

    if (error || !data) return [];

    return data.map((t) => ({
      id: t.id,
      userId: t.user_id,
      url: t.url,
      executeAt: t.execute_at,
      options: t.options,
    }));
  }

  async addScheduledTask(task: ScheduledTask): Promise<void> {
    const { error } = await this.supabase.from('scheduled_tasks').insert({
      id: task.id,
      user_id: task.userId,
      url: task.url,
      execute_at: task.executeAt,
      options: task.options,
    });

    if (error) {
      logger.error('Supabase: Failed to add scheduled task', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  async removeScheduledTask(taskId: string): Promise<void> {
    const { error } = await this.supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      logger.error('Supabase: Failed to remove scheduled task', error);
    }
  }

  // =========================================================================
  // Settings (Maintenance)
  // =========================================================================

  // Cache settings in memory to avoid DB call on every message
  private settingsCache: { maintenance: boolean } = { maintenance: false };

  async isMaintenanceMode(): Promise<boolean> {
    // Return cached value for speed
    return this.settingsCache.maintenance;
  }

  async setMaintenanceMode(enabled: boolean): Promise<void> {
    this.settingsCache.maintenance = enabled;
    // Persist to DB
    await this.supabase
      .from('bot_settings')
      .upsert({ key: 'maintenance', value: enabled }, { onConflict: 'key' });

    logger.info(
      enabled ? '🚧 Maintenance mode ENABLED' : '✅ Maintenance mode DISABLED',
    );
  }

  async loadSettings(): Promise<void> {
    const { data } = await this.supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'maintenance')
      .single();

    if (data) {
      this.settingsCache.maintenance = !!data.value;
    }
  }

  // =========================================================================
  // Rocket Speed Features: File ID Caching
  // =========================================================================

  public getCachedFile(url: string, format: string): string | null {
    if (this.fileCache?.[url]?.[format]) {
      return this.fileCache[url][format];
    }
    return null;
  }

  public async saveCachedFile(
    url: string,
    format: string,
    fileId: string,
  ): Promise<void> {
    if (!this.fileCache[url]) this.fileCache[url] = {};
    this.fileCache[url][format] = fileId;

    // Optionally persist to DB if we had a table for it
    // await this.supabase.from('file_cache').upsert({ url, format, file_id: fileId });
  }

  /**
   * Helper: تحويل بيانات DB إلى UserProfile
   */
  private mapDbUserToProfile(dbUser: DbUserRecord): UserProfile {
    return {
      id: dbUser.id,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      username: dbUser.username,
      joinedAt: dbUser.joined_at,
      lastActive: dbUser.last_active,
      credits: {
        used: dbUser.credits_used,
        lastReset: dbUser.credits_last_reset,
      },
      timezone: dbUser.timezone,
      activePlaylist: dbUser.active_playlist,
      blockRecord: dbUser.block_record || undefined,
      preferredQuality: dbUser.preferred_quality,
      downloadHistory: [], // Optimized: Don't load history by default
    };
  }
  /**
   * Force save all data immediately (No-op for Supabase as it is real-time)
   * Kept for compatibility with StorageManager interface
   */
  public async forceSaveAll(): Promise<void> {
    // Supabase is real-time, so we don't need to force save.
    // This method exists to satisfy the interface if we were using a shared interface,
    // or just to minimize code changes in index.ts during shutdown.
    logger.info('💾 Supabase: All data is already persisted (Real-time)');
  }
}
