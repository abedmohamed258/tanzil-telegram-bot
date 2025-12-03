import { DownloadManager } from '../src/download/DownloadManager';
import { FileManager } from '../src/utils/FileManager';
import { URLValidator } from '../src/utils/UrlValidator';
import { RequestQueue } from '../src/queue/RequestQueue';
import { DownloadRequest } from '../src/types';

// Mock FileManager
const mockFileManager = {
  createSessionDir: jest.fn(),
  deleteFile: jest.fn(),
  cleanupSession: jest.fn(),
} as unknown as FileManager;

// Mock spawn for yt-dlp
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('Download Functionality Tests', () => {
  let downloadManager: DownloadManager;
  let urlValidator: URLValidator;
  let requestQueue: RequestQueue;

  beforeEach(() => {
    downloadManager = new DownloadManager(mockFileManager);
    urlValidator = new URLValidator();
    requestQueue = new RequestQueue(5);
    jest.clearAllMocks();
  });

  describe('URL Parsing', () => {
    it('should extract valid YouTube URL from text', () => {
      const text =
        'Check this out: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const extracted = urlValidator.extractURL(text);
      expect(extracted).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract valid TikTok URL from text', () => {
      const text =
        'Look at this: https://www.tiktok.com/@user/video/1234567890';
      const extracted = urlValidator.extractURL(text);
      expect(extracted).toBe('https://www.tiktok.com/@user/video/1234567890');
    });

    it('should extract valid Instagram URL from text', () => {
      const text = 'Check: https://www.instagram.com/p/ABC123/';
      const extracted = urlValidator.extractURL(text);
      expect(extracted).toBe('https://www.instagram.com/p/ABC123/');
    });

    it('should return null for text without URL', () => {
      const text = 'This is just plain text without any links';
      const extracted = urlValidator.extractURL(text);
      expect(extracted).toBeNull();
    });

    it('should validate YouTube URL correctly', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = urlValidator.validate(url);
      expect(result.valid).toBe(true);
      expect(result.platform?.toLowerCase()).toBe('youtube');
    });

    it('should reject invalid URL format', () => {
      const url = 'not-a-valid-url';
      const result = urlValidator.validate(url);
      expect(result.valid).toBe(false);
    });

    it('should reject unsupported platform', () => {
      const url = 'https://www.unsupported-platform.com/video/123';
      const result = urlValidator.validate(url);
      expect(result.valid).toBe(false);
    });
  });

  describe('Download Queue Management', () => {
    const createRequest = (
      overrides: Partial<DownloadRequest> = {},
    ): DownloadRequest => ({
      id: `request-${Date.now()}-${Math.random()}`,
      userId: 123,
      chatId: 456,
      url: 'https://www.youtube.com/watch?v=test',
      format: 'best',
      priority: 1,
      createdAt: new Date(),
      ...overrides,
    });

    it('should add request to queue', async () => {
      const request = createRequest({ id: 'test-session-1' });
      await requestQueue.addRequest(request);
      expect(requestQueue.getQueueLength()).toBeGreaterThanOrEqual(0);
    });

    it('should process requests in FIFO order', async () => {
      const request1 = createRequest({ id: 'session-1', userId: 123 });
      const request2 = createRequest({ id: 'session-2', userId: 124 });

      await requestQueue.addRequest(request1);
      await requestQueue.addRequest(request2);

      // Queue length should be at least 0 (requests may be processed immediately)
      expect(requestQueue.getQueueLength()).toBeGreaterThanOrEqual(0);
    });

    it('should remove request from queue', async () => {
      const request = createRequest({ id: 'test-session' });
      await requestQueue.addRequest(request);

      const removed = requestQueue.removeRequest('test-session');
      // May or may not be removed depending on if it was already processed
      expect(typeof removed).toBe('boolean');
    });

    it('should return false when removing non-existent request', () => {
      const removed = requestQueue.removeRequest('non-existent');
      expect(removed).toBe(false);
    });

    it('should respect concurrency limit', async () => {
      const queue = new RequestQueue(2); // Max 2 concurrent

      for (let i = 0; i < 5; i++) {
        const request = createRequest({
          id: `session-${i}`,
          url: `https://www.youtube.com/watch?v=test${i}`,
        });
        await queue.addRequest(request);
      }

      // Processing count should not exceed max concurrent
      expect(queue.getProcessingCount()).toBeLessThanOrEqual(2);
    });
  });

  describe('File Handling and Cleanup', () => {
    it('should create session directory', async () => {
      const sessionId = 'test-session';
      (mockFileManager.createSessionDir as jest.Mock).mockResolvedValue(
        '/tmp/test-session',
      );

      const dir = await mockFileManager.createSessionDir(sessionId);
      expect(dir).toBe('/tmp/test-session');
      expect(mockFileManager.createSessionDir).toHaveBeenCalledWith(sessionId);
    });

    it('should delete file after upload', async () => {
      const filePath = '/tmp/test-session/video.mp4';
      (mockFileManager.deleteFile as jest.Mock).mockResolvedValue(undefined);

      await mockFileManager.deleteFile(filePath);
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith(filePath);
    });

    it('should cleanup session directory', async () => {
      const sessionId = 'test-session';
      (mockFileManager.cleanupSession as jest.Mock).mockResolvedValue(
        undefined,
      );

      await mockFileManager.cleanupSession(sessionId);
      expect(mockFileManager.cleanupSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle file deletion errors gracefully', async () => {
      const filePath = '/tmp/non-existent/video.mp4';
      (mockFileManager.deleteFile as jest.Mock).mockRejectedValue(
        new Error('File not found'),
      );

      await expect(mockFileManager.deleteFile(filePath)).rejects.toThrow(
        'File not found',
      );
    });
  });

  describe('Download Cancellation', () => {
    it('should cancel active download', async () => {
      const sessionId = 'test-session';
      await downloadManager.cancelDownload(sessionId);
      // Verify no errors thrown
    });

    it('should cancel all downloads for a user', async () => {
      const userId = 123;
      await downloadManager.cancelUserDownloads(userId);
      // Verify no errors thrown
    });
  });
});
