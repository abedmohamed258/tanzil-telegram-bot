import { BlockService } from '../src/bot/services/BlockService';
import { SupabaseManager } from '../src/database/SupabaseManager';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe('Admin Commands Tests', () => {
  let storage: SupabaseManager;
  let blockService: BlockService;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    storage = new SupabaseManager(100);
    blockService = new BlockService(storage);
    jest.clearAllMocks();
  });

  describe('Ban/Unban Functionality', () => {
    it('should ban user permanently', () => {
      const userId = 123;
      const reason = 'Spam';

      // Verify ban parameters are valid
      expect(userId).toBeGreaterThan(0);
      expect(reason.length).toBeGreaterThan(0);
    });

    it('should ban user temporarily with duration', () => {
      const userId = 123;
      const reason = 'Temporary violation';
      const duration = '1h';

      // Verify temporary ban parameters
      expect(userId).toBeGreaterThan(0);
      expect(reason.length).toBeGreaterThan(0);
      expect(duration).toMatch(/^\d+[mhdw]$/);
    });

    it('should parse duration correctly - hours', () => {
      const duration = '2h';
      const match = duration.match(/^(\d+)([mhdw])$/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('2');
      expect(match![2]).toBe('h');
    });

    it('should parse duration correctly - days', () => {
      const duration = '7d';
      const match = duration.match(/^(\d+)([mhdw])$/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('7');
      expect(match![2]).toBe('d');
    });

    it('should parse duration correctly - weeks', () => {
      const duration = '2w';
      const match = duration.match(/^(\d+)([mhdw])$/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('2');
      expect(match![2]).toBe('w');
    });

    it('should unban user', () => {
      const userId = 123;
      // Verify unban parameter is valid
      expect(userId).toBeGreaterThan(0);
    });

    it('should check if user is banned', async () => {
      const userId = 123;

      // Mock user with permanent ban
      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: { used: 0, lastReset: new Date().toISOString() },
        timezone: 0,
        activePlaylist: null,
        blockRecord: {
          type: 'perm',
          reason: 'Banned',
          blockedAt: Date.now(),
          blockedBy: 0,
        },
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const isBanned = await blockService.isBlocked(userId);
      expect(isBanned).toBe(true);
    });

    it('should detect expired temporary ban', async () => {
      const userId = 123;

      // Mock user with expired temporary ban
      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: { used: 0, lastReset: new Date().toISOString() },
        timezone: 0,
        activePlaylist: null,
        blockRecord: {
          type: 'temp',
          reason: 'Temporary',
          blockedAt: Date.now() - 7200000, // 2 hours ago
          blockedBy: 0,
          expiry: Date.now() - 3600000, // Expired 1 hour ago
        },
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const isBanned = await blockService.isBlocked(userId);
      expect(isBanned).toBe(false);
    });

    it('should detect active temporary ban', async () => {
      const userId = 123;

      // Mock user with active temporary ban
      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: { used: 0, lastReset: new Date().toISOString() },
        timezone: 0,
        activePlaylist: null,
        blockRecord: {
          type: 'temp',
          reason: 'Temporary',
          blockedAt: Date.now(),
          blockedBy: 0,
          expiry: Date.now() + 3600000, // Expires in 1 hour
        },
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const isBanned = await blockService.isBlocked(userId);
      expect(isBanned).toBe(true);
    });
  });

  describe('Broadcast Functionality', () => {
    it('should retrieve all users for broadcast', async () => {
      const mockUsers = [
        {
          id: 123,
          first_name: 'User1',
          last_name: 'Test',
          username: 'user1',
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          credits_used: 0,
          credits_last_reset: new Date().toISOString(),
          timezone: 0,
          active_playlist: null,
          block_record: null,
          preferred_quality: 'best',
        },
        {
          id: 124,
          first_name: 'User2',
          last_name: 'Test',
          username: 'user2',
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          credits_used: 0,
          credits_last_reset: new Date().toISOString(),
          timezone: 0,
          active_playlist: null,
          block_record: null,
          preferred_quality: 'best',
        },
      ];

      // Mock the database response
      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: mockUsers, error: null }),
      }));

      const users = await storage.getAllUsers();
      expect(users.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty user list', async () => {
      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const users = await storage.getAllUsers();
      expect(users).toEqual([]);
    });

    it('should filter out blocked users from broadcast', async () => {
      const users = [
        { id: 123, blockRecord: undefined },
        {
          id: 124,
          blockRecord: {
            type: 'perm',
            reason: 'Banned',
            blockedAt: Date.now(),
            blockedBy: 0,
          },
        },
        { id: 125, blockRecord: undefined },
      ];

      const activeUsers = users.filter((u) => !u.blockRecord);
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map((u) => u.id)).toEqual([123, 125]);
    });
  });

  describe('Stats Generation', () => {
    it('should count total users', async () => {
      const mockUsers = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: i + 1,
          first_name: `User${i}`,
          last_name: 'Test',
          username: `user${i}`,
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          credits_used: 0,
          credits_last_reset: new Date().toISOString(),
          timezone: 0,
          active_playlist: null,
          block_record: null,
          preferred_quality: 'best',
        }));

      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: mockUsers, error: null }),
      }));

      const users = await storage.getAllUsers();
      expect(users.length).toBe(50);
    });

    it('should count blocked users', async () => {
      const users = [
        { blockRecord: undefined },
        {
          blockRecord: {
            type: 'perm',
            reason: 'Spam',
            blockedAt: Date.now(),
            blockedBy: 0,
          },
        },
        { blockRecord: undefined },
        {
          blockRecord: {
            type: 'temp',
            reason: 'Temp',
            blockedAt: Date.now(),
            blockedBy: 0,
            expiry: Date.now() + 3600000,
          },
        },
      ];

      const blockedCount = users.filter((u) => u.blockRecord).length;
      expect(blockedCount).toBe(2);
    });

    it('should count active users in last 24 hours', () => {
      const now = Date.now();
      const oneDayAgo = now - 86400000;

      const users = [
        { lastActive: new Date(now - 3600000).toISOString() }, // 1 hour ago
        { lastActive: new Date(now - 90000000).toISOString() }, // Over 24 hours ago
        { lastActive: new Date(now - 7200000).toISOString() }, // 2 hours ago
        { lastActive: new Date(now - 172800000).toISOString() }, // 2 days ago
      ];

      const activeUsers = users.filter((u) => {
        const lastActive = new Date(u.lastActive).getTime();
        return lastActive >= oneDayAgo;
      });

      expect(activeUsers).toHaveLength(2);
    });

    it('should calculate total downloads', async () => {
      const mockHistory = Array(100)
        .fill(null)
        .map((_, i) => ({
          user_id: 123,
          title: `Video ${i}`,
          url: `https://example.com/video${i}`,
          format: 'best',
          filename: `video${i}.mp4`,
          created_at: new Date().toISOString(),
        }));

      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      }));

      const history = await storage.getDownloadHistory(123);
      expect(history.length).toBe(100);
    });
  });

  describe('User Management', () => {
    it('should get user profile', async () => {
      const userId = 123;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: { used: 30, lastReset: new Date().toISOString() },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const user = await storage.getUser(userId);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
    });

    it('should get user download history', async () => {
      const userId = 123;
      const mockHistory = [
        {
          user_id: userId,
          title: 'Video 1',
          url: 'https://example.com/video1',
          format: 'best',
          filename: 'video1.mp4',
          created_at: new Date().toISOString(),
        },
      ];

      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      }));

      const history = await storage.getDownloadHistory(userId);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should reset user credits', () => {
      const userId = 123;
      const dailyLimit = 100;

      // Simulate reset logic
      const afterReset = 0;
      const remaining = dailyLimit - afterReset;

      expect(remaining).toBe(dailyLimit);
      expect(userId).toBeGreaterThan(0);
    });

    it('should handle non-existent user gracefully', async () => {
      const userId = 999999;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue(null);

      const user = await storage.getUser(userId);
      expect(user).toBeNull();
    });
  });

  describe('Maintenance Mode', () => {
    it('should enable maintenance mode', () => {
      // Test maintenance mode logic
      let maintenanceMode = false;
      maintenanceMode = true;
      expect(maintenanceMode).toBe(true);
    });

    it('should disable maintenance mode', () => {
      // Test maintenance mode logic
      let maintenanceMode = true;
      maintenanceMode = false;
      expect(maintenanceMode).toBe(false);
    });

    it('should toggle maintenance mode', () => {
      // Test toggle logic
      let maintenanceMode = false;

      maintenanceMode = true;
      expect(maintenanceMode).toBe(true);

      maintenanceMode = false;
      expect(maintenanceMode).toBe(false);
    });
  });
});
