import { RequestQueue } from '../src/queue/requestQueue';
import { DownloadManager } from '../src/download/downloadManager';
import { BotHandler } from '../src/bot/botHandler';
import { StorageManager } from '../src/utils/storage';
import { FileManager } from '../src/utils/fileManager';
import { URLValidator } from '../src/utils/urlValidator';


// Mock dependencies
const mockQueue = new RequestQueue();
const mockFileManager = new FileManager();
const mockDownloadManager = new DownloadManager(mockFileManager);
const mockStorage = new StorageManager();
const mockUrlValidator = new URLValidator();
const mockAdminConfig = {
    adminGroupId: 123,
    topicControl: 1,
    topicLogs: 2,
    topicErrors: 3,
    topicGeneral: 4
};

// Mock BotHandler to expose protected methods for testing
class TestBotHandler extends BotHandler {
    constructor() {
        super('FAKE_TOKEN', mockStorage, mockQueue, mockDownloadManager, mockFileManager, mockUrlValidator, mockAdminConfig);
    }

    // Expose for testing
    public async testBan(userId: number) {
        // Simulate ban command
        // Access private adminService via any cast
        await (this as any).adminService.executeBan(123, 1, userId);
    }

    public async testCancel(sessionId: string) {
        // Simulate cancel callback
        const fakeQuery: any = {
            id: 'query_id',
            message: { chat: { id: 123 }, message_thread_id: 1, message_id: 999 },
            from: { id: 888 }, // Use the user ID that owns the request (888 in the test)
            data: `cancel:${sessionId}`
        };
        await this.downloadService.handleCallback(fakeQuery, 'cancel', [sessionId]);
    }
}

async function runTests() {
    console.log('🧪 Starting Reliability Verification Tests...\n');

    // 1. Test Hard Ban
    console.log('🔹 Test 1: Hard Ban Logic');
    const userId = 999;

    // Add fake request to queue
    mockQueue.addRequest({
        id: 'req_1',
        userId: userId,
        url: 'http://test.com',
        chatId: 123,
        createdAt: new Date(),
        priority: 0,
        user: { id: userId, firstName: 'Test', username: 'test' }
    });

    console.log(`   Queue length before ban: ${mockQueue.getStats().queued}`);

    // Execute Ban
    const bot = new TestBotHandler();
    // Mock bot methods to avoid network calls
    (bot.getBot() as any).sendMessage = async () => ({ message_id: 1 });
    (bot.getBot() as any).deleteMessage = async () => { };
    (bot.getBot() as any).answerCallbackQuery = async () => { };
    (bot.getBot() as any).editMessageText = async () => { };

    await bot.testBan(userId);

    const queueStats = mockQueue.getStats();
    console.log(`   Queue length after ban: ${queueStats.queued}`);

    if (queueStats.queued === 0 && mockStorage.isBanned(userId)) {
        console.log('   ✅ Hard Ban Test Passed: Queue purged and user banned.');
    } else {
        console.error('   ❌ Hard Ban Test Failed.');
    }

    // 2. Test Cancel Logic
    console.log('\n🔹 Test 2: Cancel Logic');
    const sessionId = 'req_2';
    mockQueue.addRequest({
        id: sessionId,
        userId: 888,
        url: 'http://test.com',
        chatId: 123,
        createdAt: new Date(),
        priority: 0,
        user: { id: 888, firstName: 'Test2', username: 'test2' }
    });

    console.log(`   Queue length before cancel: ${mockQueue.getStats().queued}`);
    await bot.testCancel(sessionId);
    console.log(`   Queue length after cancel: ${mockQueue.getStats().queued}`);

    if (mockQueue.getStats().queued === 0) {
        console.log('   ✅ Cancel Test Passed: Request removed from queue.');
    } else {
        console.error('   ❌ Cancel Test Failed.');
    }
}

runTests().catch(console.error);
