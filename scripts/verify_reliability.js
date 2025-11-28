"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var requestQueue_1 = require("../src/queue/requestQueue");
var downloadManager_1 = require("../src/download/downloadManager");
var botHandler_1 = require("../src/bot/botHandler");
var storage_1 = require("../src/utils/storage");
var fileManager_1 = require("../src/utils/fileManager");
var urlValidator_1 = require("../src/utils/urlValidator");
// Mock dependencies
var mockQueue = new requestQueue_1.RequestQueue();
var mockFileManager = new fileManager_1.FileManager();
var mockDownloadManager = new downloadManager_1.DownloadManager(mockFileManager);
var mockStorage = new storage_1.StorageManager();
var mockUrlValidator = new urlValidator_1.URLValidator();
var mockAdminConfig = {
    adminGroupId: 123,
    topicControl: 1,
    topicLogs: 2,
    topicErrors: 3,
    topicGeneral: 4
};
// Mock BotHandler to expose protected methods for testing
var TestBotHandler = /** @class */ (function (_super) {
    __extends(TestBotHandler, _super);
    function TestBotHandler() {
        return _super.call(this, 'FAKE_TOKEN', mockStorage, mockQueue, mockDownloadManager, mockFileManager, mockUrlValidator, mockAdminConfig) || this;
    }
    // Expose for testing
    TestBotHandler.prototype.testBan = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Simulate ban command
                    // Access private adminService via any cast
                    return [4 /*yield*/, this.adminService.executeBan(123, 1, userId)];
                    case 1:
                        // Simulate ban command
                        // Access private adminService via any cast
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TestBotHandler.prototype.testCancel = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var fakeQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fakeQuery = {
                            id: 'query_id',
                            message: { chat: { id: 123 }, message_thread_id: 1, message_id: 999 },
                            from: { id: 888 }, // Use the user ID that owns the request (888 in the test)
                            data: "cancel:".concat(sessionId)
                        };
                        return [4 /*yield*/, this.downloadService.handleCallback(fakeQuery, 'cancel', [sessionId])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return TestBotHandler;
}(botHandler_1.BotHandler));
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var userId, bot, queueStats, sessionId;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🧪 Starting Reliability Verification Tests...\n');
                    // 1. Test Hard Ban
                    console.log('🔹 Test 1: Hard Ban Logic');
                    userId = 999;
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
                    console.log("   Queue length before ban: ".concat(mockQueue.getStats().queued));
                    bot = new TestBotHandler();
                    // Mock bot methods to avoid network calls
                    bot.getBot().sendMessage = function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ message_id: 1 })];
                    }); }); };
                    bot.getBot().deleteMessage = function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); };
                    bot.getBot().answerCallbackQuery = function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); };
                    bot.getBot().editMessageText = function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); };
                    return [4 /*yield*/, bot.testBan(userId)];
                case 1:
                    _a.sent();
                    queueStats = mockQueue.getStats();
                    console.log("   Queue length after ban: ".concat(queueStats.queued));
                    if (queueStats.queued === 0 && mockStorage.isBanned(userId)) {
                        console.log('   ✅ Hard Ban Test Passed: Queue purged and user banned.');
                    }
                    else {
                        console.error('   ❌ Hard Ban Test Failed.');
                    }
                    // 2. Test Cancel Logic
                    console.log('\n🔹 Test 2: Cancel Logic');
                    sessionId = 'req_2';
                    mockQueue.addRequest({
                        id: sessionId,
                        userId: 888,
                        url: 'http://test.com',
                        chatId: 123,
                        createdAt: new Date(),
                        priority: 0,
                        user: { id: 888, firstName: 'Test2', username: 'test2' }
                    });
                    console.log("   Queue length before cancel: ".concat(mockQueue.getStats().queued));
                    return [4 /*yield*/, bot.testCancel(sessionId)];
                case 2:
                    _a.sent();
                    console.log("   Queue length after cancel: ".concat(mockQueue.getStats().queued));
                    if (mockQueue.getStats().queued === 0) {
                        console.log('   ✅ Cancel Test Passed: Request removed from queue.');
                    }
                    else {
                        console.error('   ❌ Cancel Test Failed.');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
runTests().catch(console.error);
