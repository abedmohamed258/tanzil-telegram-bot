import { BlockService } from '../src/bot/services/BlockService';
import { SupabaseManager } from '../src/database/SupabaseManager';

// Mock SupabaseManager
const mockStorage = {
  getUser: jest.fn(),
  updateBlockRecord: jest.fn(),
} as unknown as SupabaseManager;

describe('BlockService', () => {
  let blockService: BlockService;

  beforeEach(() => {
    blockService = new BlockService(mockStorage);
    jest.clearAllMocks();
  });

  it('should block a user permanently', async () => {
    const userId = 123;
    const reason = 'Spam';

    await blockService.blockUser(userId, reason);

    expect(mockStorage.updateBlockRecord).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        type: 'perm',
        reason: reason,
        blockedBy: 0,
      }),
    );
  });

  it('should block a user temporarily', async () => {
    const userId = 123;
    const reason = 'Temp Ban';
    const duration = '1h';

    await blockService.blockUser(userId, reason, duration);

    expect(mockStorage.updateBlockRecord).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        type: 'temp',
        reason: reason,
        expiry: expect.any(Number),
      }),
    );
  });

  it('should return true if user is blocked permanently', async () => {
    const userId = 123;
    // SupabaseManager.getUser is async
    (mockStorage.getUser as jest.Mock).mockResolvedValue({
      blockRecord: {
        type: 'perm',
        reason: 'Banned',
        blockedAt: Date.now(),
        blockedBy: 0,
      },
    });

    expect(await blockService.isBlocked(userId)).toBe(true);
  });

  it('should return true if user is blocked temporarily and not expired', async () => {
    const userId = 123;
    (mockStorage.getUser as jest.Mock).mockResolvedValue({
      blockRecord: {
        type: 'temp',
        reason: 'Temp',
        expiry: Date.now() + 10000, // Future
        blockedAt: Date.now(),
        blockedBy: 0,
      },
    });

    expect(await blockService.isBlocked(userId)).toBe(true);
  });

  it('should return false if user is blocked temporarily but expired', async () => {
    const userId = 123;
    (mockStorage.getUser as jest.Mock).mockResolvedValue({
      blockRecord: {
        type: 'temp',
        reason: 'Temp',
        expiry: Date.now() - 10000, // Past
        blockedAt: Date.now(),
        blockedBy: 0,
      },
    });

    expect(await blockService.isBlocked(userId)).toBe(false);
  });

  it('should unblock a user', async () => {
    const userId = 123;
    await blockService.unblockUser(userId);
    expect(mockStorage.updateBlockRecord).toHaveBeenCalledWith(userId, null);
  });
});
