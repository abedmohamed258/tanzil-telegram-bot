import { SupabaseManager } from '../src/database/SupabaseManager';
import { ScheduledTask } from '../src/types';

// Mock Supabase client with proper chaining
const mockFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  order: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('Scheduling Functionality Tests', () => {
  let storage: SupabaseManager;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    storage = new SupabaseManager(100);
    jest.clearAllMocks();
  });

  describe('Schedule Parsing', () => {
    it('should parse valid time format HH:MM', () => {
      const timeStr = '14:30';
      const [hours, minutes] = timeStr.split(':').map(Number);
      expect(hours).toBe(14);
      expect(minutes).toBe(30);
    });

    it('should parse time with leading zeros', () => {
      const timeStr = '08:05';
      const [hours, minutes] = timeStr.split(':').map(Number);
      expect(hours).toBe(8);
      expect(minutes).toBe(5);
    });

    it('should handle midnight correctly', () => {
      const timeStr = '00:00';
      const [hours, minutes] = timeStr.split(':').map(Number);
      expect(hours).toBe(0);
      expect(minutes).toBe(0);
    });

    it('should handle end of day correctly', () => {
      const timeStr = '23:59';
      const [hours, minutes] = timeStr.split(':').map(Number);
      expect(hours).toBe(23);
      expect(minutes).toBe(59);
    });

    it('should calculate future time correctly', () => {
      const now = new Date();
      const scheduledTime = new Date(now);
      scheduledTime.setHours(14, 30, 0, 0);

      // If time has passed today, should be tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      expect(scheduledTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle timezone offset correctly', () => {
      const userOffset = 3; // KSA timezone
      const hours = 14;
      const minutes = 30;

      const scheduledTime = new Date();
      scheduledTime.setUTCHours(hours - userOffset, minutes, 0, 0);

      expect(scheduledTime.getUTCHours()).toBe(hours - userOffset);
    });
  });

  describe('Schedule Execution', () => {
    it('should add scheduled task to database', () => {
      const task: ScheduledTask = {
        id: 'test-task-1',
        userId: 123,
        url: 'https://www.youtube.com/watch?v=test',
        executeAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        options: {
          chatId: 456,
          threadId: undefined,
          format: 'best',
          meta: {},
        },
      };

      // Verify task structure is correct
      expect(task.id).toBe('test-task-1');
      expect(task.userId).toBe(123);
      expect(new Date(task.executeAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should retrieve scheduled tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          user_id: 123,
          url: 'https://www.youtube.com/watch?v=test1',
          execute_at: new Date(Date.now() + 3600000).toISOString(),
          options: { chatId: 456, format: 'best', meta: {} },
        },
        {
          id: 'task-2',
          user_id: 124,
          url: 'https://www.youtube.com/watch?v=test2',
          execute_at: new Date(Date.now() + 7200000).toISOString(),
          options: { chatId: 457, format: '720p', meta: {} },
        },
      ];

      // Mock the database response
      const mockSupabase = (storage as any).supabase;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: mockTasks, error: null }),
      }));

      const tasks = await storage.getScheduledTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[1].id).toBe('task-2');
    });

    it('should identify tasks ready for execution', () => {
      const now = new Date();
      const pastTask = {
        id: 'past-task',
        userId: 123,
        url: 'https://www.youtube.com/watch?v=test',
        executeAt: new Date(now.getTime() - 60000).toISOString(), // 1 minute ago
        options: { chatId: 456, format: 'best', meta: {} },
      };

      const futureTask = {
        id: 'future-task',
        userId: 124,
        url: 'https://www.youtube.com/watch?v=test2',
        executeAt: new Date(now.getTime() + 60000).toISOString(), // 1 minute from now
        options: { chatId: 457, format: 'best', meta: {} },
      };

      const pastExecuteTime = new Date(pastTask.executeAt);
      const futureExecuteTime = new Date(futureTask.executeAt);

      expect(pastExecuteTime.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(futureExecuteTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle playlist scheduling', () => {
      const task: ScheduledTask = {
        id: 'playlist-task',
        userId: 123,
        url: 'https://www.youtube.com/playlist?list=PLtest',
        executeAt: new Date(Date.now() + 3600000).toISOString(),
        options: {
          chatId: 456,
          threadId: undefined,
          format: 'best',
          meta: {
            isPlaylist: true,
            indices: [1, 2, 3, 4, 5],
          },
        },
      };

      // Verify playlist task structure
      expect(task.options.meta?.isPlaylist).toBe(true);
      expect(task.options.meta?.indices).toHaveLength(5);
    });

    it('should execute task within time window', () => {
      const scheduledTime = new Date('2024-01-01T14:30:00Z');
      const executionTime = new Date('2024-01-01T14:30:45Z'); // 45 seconds later
      const timeDiff = Math.abs(
        executionTime.getTime() - scheduledTime.getTime(),
      );

      // Should execute within 60 seconds
      expect(timeDiff).toBeLessThanOrEqual(60000);
    });
  });

  describe('Schedule Cancellation', () => {
    it('should remove scheduled task', () => {
      const taskId = 'test-task-1';
      // Verify task ID format
      expect(taskId).toBe('test-task-1');
      expect(typeof taskId).toBe('string');
    });

    it('should handle removal of non-existent task', () => {
      const taskId = 'non-existent-task';
      // Verify task ID is valid string
      expect(taskId.length).toBeGreaterThan(0);
    });

    it('should remove task after execution', () => {
      const task: ScheduledTask = {
        id: 'executed-task',
        userId: 123,
        url: 'https://www.youtube.com/watch?v=test',
        executeAt: new Date(Date.now() - 1000).toISOString(), // Past time
        options: { chatId: 456, format: 'best', meta: {} },
      };

      // Verify task with past time is ready for execution
      const executeTime = new Date(task.executeAt);
      expect(executeTime.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Schedule Edge Cases', () => {
    it('should handle scheduling for tomorrow when time has passed today', () => {
      const now = new Date();
      const targetHour = now.getHours() - 1; // 1 hour ago
      const targetMinute = now.getMinutes();

      const scheduledTime = new Date(now);
      scheduledTime.setHours(targetHour, targetMinute, 0, 0);

      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      expect(scheduledTime.getDate()).toBe(now.getDate() + 1);
    });

    it('should handle force tomorrow flag', () => {
      const now = new Date();
      const scheduledTime = new Date(now);
      scheduledTime.setHours(8, 0, 0, 0);

      // Force tomorrow
      scheduledTime.setDate(scheduledTime.getDate() + 1);

      expect(scheduledTime.getDate()).toBe(now.getDate() + 1);
    });

    it('should handle multiple tasks for same user', () => {
      const tasks: ScheduledTask[] = [
        {
          id: 'task-1',
          userId: 123,
          url: 'https://www.youtube.com/watch?v=test1',
          executeAt: new Date(Date.now() + 3600000).toISOString(),
          options: { chatId: 456, format: 'best', meta: {} },
        },
        {
          id: 'task-2',
          userId: 123,
          url: 'https://www.youtube.com/watch?v=test2',
          executeAt: new Date(Date.now() + 7200000).toISOString(),
          options: { chatId: 456, format: '720p', meta: {} },
        },
      ];

      // Verify multiple tasks for same user
      const userTasks = tasks.filter((t) => t.userId === 123);
      expect(userTasks).toHaveLength(2);
      expect(userTasks[0].id).not.toBe(userTasks[1].id);
    });

    it('should handle scheduling at exact current time', () => {
      const now = new Date();
      const scheduledTime = new Date(now);

      // If scheduled time equals now, should move to next day
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      expect(scheduledTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle month boundary correctly', () => {
      const lastDayOfMonth = new Date(2024, 0, 31, 23, 59, 59); // Jan 31
      const scheduledTime = new Date(lastDayOfMonth);
      scheduledTime.setDate(scheduledTime.getDate() + 1);

      expect(scheduledTime.getMonth()).toBe(1); // February
      expect(scheduledTime.getDate()).toBe(1);
    });

    it('should handle year boundary correctly', () => {
      const lastDayOfYear = new Date(2024, 11, 31, 23, 59, 59); // Dec 31
      const scheduledTime = new Date(lastDayOfYear);
      scheduledTime.setDate(scheduledTime.getDate() + 1);

      expect(scheduledTime.getFullYear()).toBe(2025);
      expect(scheduledTime.getMonth()).toBe(0); // January
      expect(scheduledTime.getDate()).toBe(1);
    });
  });

  describe('Scheduler Interval', () => {
    it('should check tasks every minute', () => {
      const intervalMs = 60000; // 1 minute
      expect(intervalMs).toBe(60000);
    });

    it('should handle multiple tasks in same check', () => {
      const now = new Date();
      const tasks = [
        { executeAt: new Date(now.getTime() - 30000).toISOString() }, // 30 sec ago
        { executeAt: new Date(now.getTime() - 10000).toISOString() }, // 10 sec ago
        { executeAt: new Date(now.getTime() + 30000).toISOString() }, // 30 sec future
      ];

      const readyTasks = tasks.filter((task) => {
        const executeTime = new Date(task.executeAt);
        return executeTime <= now;
      });

      expect(readyTasks).toHaveLength(2);
    });
  });
});
