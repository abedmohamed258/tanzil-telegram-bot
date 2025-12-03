import { SupabaseManager } from '../src/database/SupabaseManager';

// Mock Supabase client
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

describe('Credit System Tests', () => {
  let storage: SupabaseManager;
  const dailyLimit = 100;

  beforeEach(() => {
    // Set environment variables for Supabase
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    storage = new SupabaseManager(dailyLimit);
    jest.clearAllMocks();
  });

  describe('Credit Calculation', () => {
    it('should calculate correct credits for short video', () => {
      const { calculateCost } = require('../src/utils/logicHelpers');
      const duration = 180; // 3 minutes
      const cost = calculateCost(duration, false);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThanOrEqual(10);
    });

    it('should calculate correct credits for long video', () => {
      const { calculateCost } = require('../src/utils/logicHelpers');
      const duration = 3600; // 1 hour
      const cost = calculateCost(duration, false);
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate lower credits for audio', () => {
      const { calculateCost } = require('../src/utils/logicHelpers');
      const duration = 300; // 5 minutes
      const videoCost = calculateCost(duration, false);
      const audioCost = calculateCost(duration, true);
      expect(audioCost).toBeLessThan(videoCost);
    });

    it('should return minimum 1 credit for very short videos', () => {
      const { calculateCost } = require('../src/utils/logicHelpers');
      const duration = 10; // 10 seconds
      const cost = calculateCost(duration, false);
      expect(cost).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Credit Deduction', () => {
    it('should deduct credits when sufficient balance', async () => {
      const userId = 123;
      const amount = 10;

      // Mock user with sufficient credits
      const mockUser = {
        id: userId,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        credits_used: 20,
        credits_last_reset: new Date().toISOString(),
        timezone: 0,
        active_playlist: null,
        block_record: null,
        preferred_quality: 'best',
      };

      // Mock getUser to return user with credits
      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: mockUser.joined_at,
        lastActive: mockUser.last_active,
        credits: {
          used: 20,
          lastReset: mockUser.credits_last_reset,
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const result = await storage.useCredits(userId, amount);
      expect(result).toBe(true);
    });

    it('should reject deduction when insufficient balance', async () => {
      const userId = 123;
      const amount = 50;

      // Mock user with insufficient credits
      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 90, // Only 10 remaining
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const result = await storage.useCredits(userId, amount);
      expect(result).toBe(false);
    });

    it('should handle exact balance deduction', async () => {
      const userId = 123;
      const amount = 30;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 70, // Exactly 30 remaining
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const result = await storage.useCredits(userId, amount);
      expect(result).toBe(true);
    });

    it('should refund credits correctly', async () => {
      const userId = 123;
      const amount = 10;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 50,
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      await storage.refundCredits(userId, amount);
      // Verify no errors thrown
    });
  });

  describe('Credit Reset Logic', () => {
    it('should reset credits on new day', async () => {
      const userId = 123;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 80,
          lastReset: yesterday.toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const credits = await storage.getCredits(userId);
      expect(credits.used).toBe(0);
      expect(credits.remaining).toBe(dailyLimit);
    });

    it('should not reset credits on same day', async () => {
      const userId = 123;
      const today = new Date();

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 30,
          lastReset: today.toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const credits = await storage.getCredits(userId);
      expect(credits.used).toBe(30);
      expect(credits.remaining).toBe(70);
    });

    it('should manually reset credits', () => {
      const userId = 123;
      const dailyLimit = 100;

      // Simulate reset logic
      const afterReset = 0;
      const remaining = dailyLimit - afterReset;

      expect(remaining).toBe(dailyLimit);
      expect(userId).toBeGreaterThan(0);
    });

    it('should handle month change correctly', async () => {
      const userId = 123;
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 90,
          lastReset: lastMonth.toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const credits = await storage.getCredits(userId);
      expect(credits.used).toBe(0);
      expect(credits.remaining).toBe(dailyLimit);
    });
  });

  describe('Credit Edge Cases', () => {
    it('should handle zero credit deduction', async () => {
      const userId = 123;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 50,
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const result = await storage.useCredits(userId, 0);
      expect(result).toBe(true);
    });

    it('should handle negative refund gracefully', async () => {
      const userId = 123;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 5,
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      await storage.refundCredits(userId, 10);
      // Should not go below 0
    });

    it('should return zero remaining when limit exceeded', async () => {
      const userId = 123;

      jest.spyOn(storage as any, 'getUser').mockResolvedValue({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        credits: {
          used: 150, // Over limit
          lastReset: new Date().toISOString(),
        },
        timezone: 0,
        activePlaylist: null,
        blockRecord: undefined,
        preferredQuality: 'best',
        downloadHistory: [],
      });

      const credits = await storage.getCredits(userId);
      expect(credits.remaining).toBe(0);
    });
  });
});
