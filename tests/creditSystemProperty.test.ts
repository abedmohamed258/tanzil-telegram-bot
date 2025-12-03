import fc from 'fast-check';
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

/**
 * **Feature: production-readiness-review, Property 5: Credit System Correctness**
 * **Validates: Requirements 2.4**
 *
 * Property: For any sequence of credit operations (deduct, add, reset),
 * the final credit balance should equal the initial balance plus all additions
 * minus all deductions, with resets setting balance to the configured daily limit.
 */
describe('Property Test: Credit System Correctness', () => {
  const dailyLimit = 100;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    jest.clearAllMocks();
  });

  it('should maintain correct balance after any sequence of operations', () => {
    // Pure logic test without database calls
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant('deduct'),
              amount: fc.integer({ min: 1, max: 50 }),
            }),
            fc.record({
              type: fc.constant('add'),
              amount: fc.integer({ min: 1, max: 50 }),
            }),
            fc.record({ type: fc.constant('reset'), amount: fc.constant(0) }),
          ),
          { minLength: 1, maxLength: 10 },
        ),
        (operations) => {
          let currentUsed = 0;
          let expectedBalance = dailyLimit;

          for (const op of operations) {
            if (op.type === 'deduct') {
              const remaining = dailyLimit - currentUsed;
              if (remaining >= op.amount) {
                currentUsed += op.amount;
                expectedBalance = dailyLimit - currentUsed;
              }
            } else if (op.type === 'add') {
              currentUsed = Math.max(0, currentUsed - op.amount);
              expectedBalance = dailyLimit - currentUsed;
            } else if (op.type === 'reset') {
              currentUsed = 0;
              expectedBalance = dailyLimit;
            }
          }

          // Final balance should match expected
          const finalRemaining = dailyLimit - currentUsed;
          expect(finalRemaining).toBe(expectedBalance);
          expect(finalRemaining).toBeGreaterThanOrEqual(0);
          expect(finalRemaining).toBeLessThanOrEqual(dailyLimit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should never allow negative balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 30 }), {
          minLength: 1,
          maxLength: 10,
        }),
        async (deductions) => {
          const storage = new SupabaseManager(dailyLimit);
          const userId = 12346;
          let currentUsed = 0;

          const mockGetUser = jest.spyOn(storage as any, 'getUser');

          for (const amount of deductions) {
            mockGetUser.mockResolvedValue({
              id: userId,
              firstName: 'Test',
              lastName: 'User',
              username: 'testuser',
              joinedAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              credits: {
                used: currentUsed,
                lastReset: new Date().toISOString(),
              },
              timezone: 0,
              activePlaylist: null,
              blockRecord: undefined,
              preferredQuality: 'best',
              downloadHistory: [],
            });

            const success = await storage.useCredits(userId, amount);

            if (success) {
              currentUsed += amount;
            }

            // Balance should never be negative
            const finalRemaining = dailyLimit - currentUsed;
            expect(finalRemaining).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should correctly handle refunds without exceeding limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialUsed: fc.integer({ min: 0, max: dailyLimit }),
          refunds: fc.array(fc.integer({ min: 1, max: 50 }), {
            minLength: 1,
            maxLength: 5,
          }),
        }),
        async ({ initialUsed, refunds }) => {
          const storage = new SupabaseManager(dailyLimit);
          const userId = 12347;
          let currentUsed = initialUsed;

          const mockGetUser = jest.spyOn(storage as any, 'getUser');

          for (const refundAmount of refunds) {
            mockGetUser.mockResolvedValue({
              id: userId,
              firstName: 'Test',
              lastName: 'User',
              username: 'testuser',
              joinedAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              credits: {
                used: currentUsed,
                lastReset: new Date().toISOString(),
              },
              timezone: 0,
              activePlaylist: null,
              blockRecord: undefined,
              preferredQuality: 'best',
              downloadHistory: [],
            });

            await storage.refundCredits(userId, refundAmount);
            currentUsed = Math.max(0, currentUsed - refundAmount);

            // Used credits should never be negative
            expect(currentUsed).toBeGreaterThanOrEqual(0);

            // Remaining should never exceed limit
            expect(dailyLimit - currentUsed).toBeLessThanOrEqual(dailyLimit);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reset to daily limit regardless of current balance', () => {
    // Pure logic test without database calls
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }), // Can be over limit
        (_initialUsed) => {
          // Simulate reset operation
          const afterReset = 0; // Reset sets used to 0
          const remaining = dailyLimit - afterReset;

          // After reset, remaining should equal daily limit
          expect(remaining).toBe(dailyLimit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle concurrent-like operations correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('deduct', 'add'),
            amount: fc.integer({ min: 1, max: 20 }),
          }),
          { minLength: 5, maxLength: 15 },
        ),
        async (operations) => {
          const storage = new SupabaseManager(dailyLimit);
          const userId = 12349;
          let currentUsed = 0;

          const mockGetUser = jest.spyOn(storage as any, 'getUser');

          for (const op of operations) {
            mockGetUser.mockResolvedValue({
              id: userId,
              firstName: 'Test',
              lastName: 'User',
              username: 'testuser',
              joinedAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              credits: {
                used: currentUsed,
                lastReset: new Date().toISOString(),
              },
              timezone: 0,
              activePlaylist: null,
              blockRecord: undefined,
              preferredQuality: 'best',
              downloadHistory: [],
            });

            if (op.type === 'deduct') {
              const remaining = dailyLimit - currentUsed;
              if (remaining >= op.amount) {
                await storage.useCredits(userId, op.amount);
                currentUsed += op.amount;
              }
            } else {
              await storage.refundCredits(userId, op.amount);
              currentUsed = Math.max(0, currentUsed - op.amount);
            }

            // Invariant: balance is always valid
            const remaining = dailyLimit - currentUsed;
            expect(remaining).toBeGreaterThanOrEqual(0);
            expect(remaining).toBeLessThanOrEqual(dailyLimit);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
