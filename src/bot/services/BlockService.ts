import { SupabaseManager } from '../../database/SupabaseManager';
import { BlockRecord } from '../../types';
import { logger } from '../../utils/logger';

export class BlockService {
  private storage: SupabaseManager;

  constructor(storage: SupabaseManager) {
    this.storage = storage;
  }

  /**
   * Block a user
   */
  public async blockUser(
    userId: number,
    reason: string,
    duration?: string,
    byAdmin: number = 0,
  ): Promise<void> {
    let expiry: number | undefined;
    let type: 'temp' | 'perm' = 'perm';

    if (duration) {
      const match = duration.match(/^(\d+)([mhdw])$/);
      if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        const now = Date.now();

        switch (unit) {
          case 'm':
            expiry = now + amount * 60 * 1000;
            break;
          case 'h':
            expiry = now + amount * 60 * 60 * 1000;
            break;
          case 'd':
            expiry = now + amount * 24 * 60 * 60 * 1000;
            break;
          case 'w':
            expiry = now + amount * 7 * 24 * 60 * 60 * 1000;
            break;
        }
        type = 'temp';
      }
    }

    const record: BlockRecord = {
      type,
      reason,
      expiry,
      blockedAt: Date.now(),
      blockedBy: byAdmin,
    };

    await this.storage.updateBlockRecord(userId, record);
    logger.info(`🚫 User ${userId} blocked`, { type, reason, expiry });
  }

  /**
   * Unblock a user
   */
  public async unblockUser(userId: number, byAdmin: number = 0): Promise<void> {
    await this.storage.updateBlockRecord(userId, null);
    logger.info(`✅ User ${userId} unblocked by ${byAdmin}`);
  }

  /**
   * Check if user is blocked
   */
  public async isBlocked(userId: number): Promise<boolean> {
    const user = await this.storage.getUser(userId);
    if (!user || !user.blockRecord) return false;

    // Check expiry for temp blocks
    if (user.blockRecord.type === 'temp' && user.blockRecord.expiry) {
      if (Date.now() > user.blockRecord.expiry) {
        // Expired, auto-unblock (lazy)
        // We can't await here easily without making isBlocked async,
        // but we can fire-and-forget the unblock or just return false.
        // Better to return false and let a cleanup job or next action clear it.
        // For now, just return false.
        return false;
      }
    }

    return true;
  }

  /**
   * Get block details
   */
  public async getBlockDetails(userId: number): Promise<BlockRecord | null> {
    const user = await this.storage.getUser(userId);
    if (!user?.blockRecord) return null;

    // Check expiry
    if (
      user.blockRecord.type === 'temp' &&
      user.blockRecord.expiry &&
      Date.now() > user.blockRecord.expiry
    ) {
      return null;
    }

    return user.blockRecord;
  }
}
