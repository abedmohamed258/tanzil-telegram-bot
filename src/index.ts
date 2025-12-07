import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import * as Sentry from '@sentry/node';
import { loadConfig } from './utils/config';
import { logger } from './utils/logger';
import { FileManager } from './utils/FileManager';
import { CookiesManager } from './utils/CookiesManager';
import { SupabaseManager } from './database/SupabaseManager';
import { URLValidator } from './utils/UrlValidator';
import { DownloadManager } from './download/DownloadManager';
import { RequestQueue } from './queue/RequestQueue';
import { Server } from './server';
import { AppContext } from './types';
import { AdminService } from './bot/services/AdminService';
import { UserService } from './bot/services/UserService';
import { DownloadService } from './bot/services/DownloadService';
import { StoryService } from './bot/services/StoryService';
import { BlockService } from './bot/services/BlockService';
import { InputValidator } from './utils/InputValidator';

const messageRateLimit = new Map<number, number>();

function initializeSentry(): void {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: 1.0,
  });
}

async function initializeComponents(
  config: ReturnType<typeof loadConfig>,
): Promise<AppContext> {
  const bot = new Telegraf(config.telegramToken);
  const fileManager = new FileManager(config.tempDirectory);
  await fileManager.initialize();

  const storage = new SupabaseManager(config.dailyCredits);
  const urlValidator = new URLValidator();
  const downloadManager = new DownloadManager(
    fileManager,
    config.retryAttempts,
    config.downloadTimeout,
  );
  const requestQueue = new RequestQueue(config.maxConcurrentDownloads);

  // Initialize Services
  const blockService = new BlockService(storage);
  const adminService = new AdminService(
    bot as any,
    storage,
    requestQueue,
    downloadManager,
    fileManager,
    config.adminConfig,
    blockService,
  );
  const userService = new UserService(
    bot as any,
    storage,
    urlValidator,
    config.adminConfig,
  );
  const downloadService = new DownloadService(
    bot as any,
    storage,
    requestQueue,
    downloadManager,
    fileManager,
    urlValidator,
  );

  const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  const sessionString = process.env.TELEGRAM_SESSION || '';
  const tempDir = config.tempDirectory || './temp';
  const storyService = new StoryService(apiId, apiHash, sessionString, tempDir);
  downloadService.setStoryService(storyService);
  userService.setDownloadService(downloadService);

  requestQueue.setProcessingCallback((req) =>
    downloadService.processDownloadRequest(req),
  );
  requestQueue.setOnQueueChange((q) => downloadService.handleQueueChange(q));

  return {
    bot,
    storage,
    queue: requestQueue,
    downloadManager,
    fileManager,
    urlValidator,
    adminConfig: config.adminConfig,
    adminService,
    userService,
    downloadService,
    storyService,
    blockService,
  };
}

function registerHandlers(app: AppContext): void {
  const {
    bot,
    adminService,
    userService,
    downloadService,
    storage,
    blockService,
    adminConfig,
  } = app;

  bot.start((ctx) => userService.handleStart(ctx.message as any));
  bot.help((ctx) => userService.handleHelp(ctx.message as any));
  bot.command('admin', (ctx) => adminService.handleAdminDashboard(ctx.message));
  bot.command('block', (ctx) =>
    adminService.handleBlock(
      ctx.message,
      ctx.message.text.split(' ').slice(1).join(' '),
    ),
  );
  bot.command('unblock', (ctx) =>
    adminService.handleUnblock(
      ctx.message,
      ctx.message.text.split(' ').slice(1).join(' '),
    ),
  );
  bot.command('isblocked', (ctx) =>
    adminService.handleIsBlocked(
      ctx.message,
      ctx.message.text.split(' ').slice(1).join(' '),
    ),
  );
  bot.command('broadcast', (ctx) =>
    adminService.handleBroadcast(
      ctx.message,
      ctx.message.text.split(' ').slice(1).join(' '),
    ),
  );
  bot.command('send', (ctx) =>
    adminService.handleSend(
      ctx.message,
      ctx.message.text.split(' ').slice(1).join(' '),
    ),
  );
  bot.command('clean', (ctx) => adminService.handleForceClean(ctx.message));
  bot.command('stats', (ctx) => adminService.handleSysStats(ctx.message));

  // Handle /user_ID commands for viewing user details
  bot.hears(/^\/user_(\d+)/, async (ctx) => {
    const match = ctx.message.text.match(/^\/user_(\d+)/);
    if (match) {
      const targetUserId = parseInt(match[1], 10);
      await adminService.handleUserDetails(ctx.message, targetUserId);
    }
  });

  bot.on('message', async (ctx: Context) => {
    const msg = ctx.message as any; // telegraf types are a bit different
    if (!msg || !msg.text) return;
    if (msg.text?.startsWith('/')) return; // Ignore commands

    const userId = msg.from?.id;
    const chatId = msg.chat.id;
    if (!userId) return;

    if (chatId === adminConfig.adminGroupId && msg.reply_to_message) {
      const originalText = msg.reply_to_message.text || '';
      // Match both formats: "ID: `123`" or "ID: 123" (backticks consumed by Markdown)
      const idMatch = originalText.match(/ID:\s*`?(\d+)`?/i);

      if (idMatch && idMatch[1]) {
        const targetUserId = parseInt(idMatch[1]);
        const replyText = msg.text || 'صورة/ملف';

        try {
          await bot.telegram.sendMessage(
            targetUserId,
            `📩 *رد من الدعم الفني:*\n\n${replyText}`,
            { parse_mode: 'Markdown' },
          );
          await bot.telegram.sendMessage(
            chatId,
            `✅ تم إرسال الرد للمستخدم (${targetUserId})`,
            { message_thread_id: msg.message_thread_id }
          );
          logger.info('Admin replied to user', { adminId: userId, targetUserId });
        } catch (e) {
          await bot.telegram.sendMessage(
            chatId,
            `❌ فشل الإرسال: ربما قام المستخدم بحظر البوت.`,
            { message_thread_id: msg.message_thread_id }
          );
        }
        return;
      }
    }


    const lastMsgTime = messageRateLimit.get(userId) || 0;
    const now = Date.now();
    if (now - lastMsgTime < 1000) return;
    messageRateLimit.set(userId, now);

    if (
      (await storage.isMaintenanceMode()) &&
      chatId !== adminConfig.adminGroupId
    ) {
      await ctx.reply(
        '🚧 ⚠️ System is currently in maintenance mode. Please try again later.',
      );
      return;
    }

    if (await blockService.isBlocked(userId)) {
      const blockRecord = await blockService.getBlockDetails(userId);
      const reason = blockRecord?.reason || 'No reason provided';
      const expiry = blockRecord?.expiry
        ? `\n⏳ Expires: ${new Date(blockRecord.expiry).toLocaleString()}`
        : '';
      await ctx.reply(
        `🚫 *عذراً، تم حظرك من استخدام البوت.*\n📝 السبب: ${reason}${expiry}\nتواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (adminService.hasPendingState(userId)) {
      await adminService.handlePendingState(msg);
      return;
    }

    if (userService.hasPendingState(userId)) {
      await userService.handleStateInput(msg);
      return;
    }

    await downloadService.handleMessage(msg);
  });

  bot.on('callback_query', async (ctx: Context) => {
    const query = ctx.callbackQuery as any;
    if (!query.data || !query.message) return;

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    if (
      (await storage.isMaintenanceMode()) &&
      chatId !== adminConfig.adminGroupId
    ) {
      await ctx.answerCbQuery('🚧 System in maintenance mode', {
        show_alert: true,
      });
      return;
    }

    if (await blockService.isBlocked(userId)) {
      await ctx.answerCbQuery('🚫 تم حظرك من استخدام البوت.', {
        show_alert: true,
      });
      return;
    }

    const sanitizedData = InputValidator.sanitizeCallbackData(query.data);
    if (!sanitizedData) {
      logger.warn('Invalid callback data received', {
        userId,
        data: query.data,
      });
      await ctx.answerCbQuery('❌ بيانات غير صحيحة', { show_alert: true });
      return;
    }

    const [action, ...params] = sanitizedData.split(':');

    try {
      if (action === 'admin') {
        await adminService.handleCallback(query, params);
      } else if (action === 'user') {
        await userService.handleCallback(query, params.join(':'));
      } else if (action === 'dl' || action === 'cancel') {
        if (action === 'cancel') {
          await downloadService.handleCallback(query, 'cancel', params);
        } else {
          const subAction = params[0];
          if (subAction === 'pl') {
            await downloadService.handleCallback(query, 'pl', params.slice(1));
          } else {
            const uuid = params[0];
            const format = params[1];
            await downloadService.handleCallback(query, uuid, [format]);
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Callback Error', {
        error: (error as Error).message,
        data: query.data,
      });
    }
  });

  // =========================================================================
  // نظام إدارة الجروبات المتعددة - Multi-Group Control
  // =========================================================================
  bot.on('my_chat_member', async (ctx) => {
    try {
      const update = ctx.myChatMember;
      const chat = update.chat;
      const newStatus = update.new_chat_member.status;
      const oldStatus = update.old_chat_member.status;
      const addedBy = update.from;

      // تحقق أن هذا جروب وليس شات خاص
      if (chat.type === 'private') return;

      const chatId = chat.id;
      const chatTitle = (chat as any).title || 'Unknown Group';
      const chatType = chat.type as 'group' | 'supergroup' | 'channel';

      // البوت أضيف لجروب جديد
      if ((newStatus === 'member' || newStatus === 'administrator') &&
        (oldStatus === 'left' || oldStatus === 'kicked')) {

        // جلب قائمة أدمنز الجروب
        let adminIds: number[] = [];
        try {
          const admins = await bot.telegram.getChatAdministrators(chatId);
          adminIds = admins
            .filter(a => !a.user.is_bot)
            .map(a => a.user.id);
        } catch {
          // إذا فشل جلب الأدمنز، نضيف من أضاف البوت فقط
          if (addedBy && !addedBy.is_bot) {
            adminIds = [addedBy.id];
          }
        }

        // تسجيل الجروب في قاعدة البيانات
        await storage.upsertGroup({
          id: chatId,
          title: chatTitle,
          type: chatType,
          addedAt: new Date().toISOString(),
          addedBy: addedBy?.id,
          isActive: true,
          adminIds,
          settings: {
            allowDownloads: true,
            notifyOnJoin: true,
            logDownloads: true,
          },
        });

        // إرسال تنبيه لجروب الإدارة
        await bot.telegram.sendMessage(
          adminConfig.adminGroupId,
          `📢 *البوت أضيف لجروب جديد*\n━━━━━━━━━━━━━━━━━━━━\n🏷️ *الاسم:* ${chatTitle}\n🆔 *ID:* \`${chatId}\`\n📊 *النوع:* ${chatType}\n👤 *أضافه:* ${addedBy?.first_name || 'Unknown'}\n👥 *الأدمنز:* ${adminIds.length}`,
          { parse_mode: 'Markdown', message_thread_id: adminConfig.topicLogs }
        );

        // إرسال رسالة ترحيب في الجروب
        await bot.telegram.sendMessage(
          chatId,
          `مرحباً! 👋\n\nأنا بوت *Tanzil* لتحميل الفيديوهات.\n\n📥 أرسل أي رابط من YouTube أو TikTok أو Instagram وسأقوم بتحميله لك.\n\n⚡ للتحكم بإعدادات البوت في هذا الجروب، استخدم /settings (للأدمنز فقط)`,
          { parse_mode: 'Markdown' }
        );

        logger.info('Bot added to group', { chatId, chatTitle, addedBy: addedBy?.id });

        // البوت أزيل من الجروب
      } else if ((newStatus === 'left' || newStatus === 'kicked') &&
        (oldStatus === 'member' || oldStatus === 'administrator')) {

        // تعطيل الجروب في قاعدة البيانات
        await storage.deactivateGroup(chatId);

        // إرسال تنبيه لجروب الإدارة
        await bot.telegram.sendMessage(
          adminConfig.adminGroupId,
          `🚪 *البوت أزيل من جروب*\n━━━━━━━━━━━━━━━━━━━━\n🏷️ *الاسم:* ${chatTitle}\n🆔 *ID:* \`${chatId}\``,
          { parse_mode: 'Markdown', message_thread_id: adminConfig.topicLogs }
        );

        logger.info('Bot removed from group', { chatId, chatTitle });
      }
    } catch (error) {
      logger.error('Error handling my_chat_member', { error: (error as Error).message });
    }
  });

  // أمر إعدادات الجروب (للأدمنز فقط)
  bot.command('settings', async (ctx) => {
    const msg = ctx.message;
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    // تحقق أن هذا جروب
    if (msg.chat.type === 'private') {
      await ctx.reply('هذا الأمر متاح فقط في الجروبات.');
      return;
    }

    if (!userId) return;

    // تحقق أن المستخدم أدمن في الجروب
    const isAdmin = await storage.isGroupAdmin(chatId, userId);
    if (!isAdmin) {
      await ctx.reply('❌ هذا الأمر متاح للأدمنز فقط.');
      return;
    }

    const group = await storage.getGroup(chatId);
    if (!group) {
      await ctx.reply('❌ الجروب غير مسجل. أعد إضافة البوت.');
      return;
    }

    const settingsText = `
⚙️ *إعدادات البوت في هذا الجروب*
━━━━━━━━━━━━━━━━━━━━
📥 *السماح بالتحميل:* ${group.settings.allowDownloads ? '✅' : '❌'}
📢 *تنبيهات الانضمام:* ${group.settings.notifyOnJoin ? '✅' : '❌'}
📝 *تسجيل التحميلات:* ${group.settings.logDownloads ? '✅' : '❌'}
━━━━━━━━━━━━━━━━━━━━
👥 *الأدمنز:* ${group.adminIds.length}`;

    await ctx.reply(settingsText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: group.settings.allowDownloads ? '🔴 تعطيل التحميل' : '🟢 تفعيل التحميل', callback_data: 'grp:toggle_downloads' },
          ],
          [
            { text: '🔄 تحديث الأدمنز', callback_data: 'grp:sync_admins' },
          ],
        ],
      },
    });
  });

  // معالجة callbacks الجروبات
  bot.on('callback_query', async (ctx, next) => {
    const query = ctx.callbackQuery as any;
    if (!query.data?.startsWith('grp:')) return next();

    const chatId = query.message?.chat.id;
    const userId = query.from.id;

    if (!chatId) return;

    // تحقق أن المستخدم أدمن
    const isAdmin = await storage.isGroupAdmin(chatId, userId);
    if (!isAdmin) {
      await ctx.answerCbQuery('❌ للأدمنز فقط', { show_alert: true });
      return;
    }

    const action = query.data.split(':')[1];

    if (action === 'toggle_downloads') {
      const group = await storage.getGroup(chatId);
      if (group) {
        const newValue = !group.settings.allowDownloads;
        await storage.updateGroupSettings(chatId, { allowDownloads: newValue });
        await ctx.answerCbQuery(newValue ? '✅ تم تفعيل التحميل' : '❌ تم تعطيل التحميل');

        // تحديث الرسالة
        group.settings.allowDownloads = newValue;
        const settingsText = `
⚙️ *إعدادات البوت في هذا الجروب*
━━━━━━━━━━━━━━━━━━━━
📥 *السماح بالتحميل:* ${group.settings.allowDownloads ? '✅' : '❌'}
📢 *تنبيهات الانضمام:* ${group.settings.notifyOnJoin ? '✅' : '❌'}
📝 *تسجيل التحميلات:* ${group.settings.logDownloads ? '✅' : '❌'}
━━━━━━━━━━━━━━━━━━━━
👥 *الأدمنز:* ${group.adminIds.length}`;

        await ctx.editMessageText(settingsText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: group.settings.allowDownloads ? '🔴 تعطيل التحميل' : '🟢 تفعيل التحميل', callback_data: 'grp:toggle_downloads' }],
              [{ text: '🔄 تحديث الأدمنز', callback_data: 'grp:sync_admins' }],
            ],
          },
        });
      }
    } else if (action === 'sync_admins') {
      try {
        const admins = await bot.telegram.getChatAdministrators(chatId);
        const adminIds = admins.filter(a => !a.user.is_bot).map(a => a.user.id);
        await storage.updateGroupAdmins(chatId, adminIds);
        await ctx.answerCbQuery(`✅ تم تحديث ${adminIds.length} أدمن`);
      } catch {
        await ctx.answerCbQuery('❌ فشل تحديث الأدمنز', { show_alert: true });
      }
    }
  });

  logger.info('✅ Bot handlers registered');
}

async function startBot(
  config: ReturnType<typeof loadConfig>,
  bot: Telegraf,
): Promise<void> {
  if (config.useWebhook) {
    if (!config.webhookUrl) {
      throw new Error('WEBHOOK_URL is required when USE_WEBHOOK=true');
    }
    const server = new Server(bot as any, config.port, config.webhookUrl);
    await server.start();
    logger.info('✅ Bot started in WEBHOOK mode');
  } else {
    await bot.launch();
    logger.info('✅ Bot started in POLLING mode');
  }
}

function setupShutdownHandlers(app: AppContext): void {
  const {
    bot,
    storage,
    downloadManager,
    adminService,
    userService,
    downloadService,
    queue,
  } = app;
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    try {
      bot.stop(signal);
      adminService.stop();
      userService.stop();
      downloadService.stop();
      queue.stop();
      await storage.forceSaveAll();
      await downloadManager.killAllActiveDownloads();
      if (global.gc) {
        logger.info('🧹 Forcing Garbage Collection...');
        global.gc();
      }
      await Sentry.close(2000);
      logger.info('✅ Bot stopped safely');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      Sentry.captureException(error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  setupEmergencyHandlers(downloadManager);
}

function setupEmergencyHandlers(downloadManager: DownloadManager): void {
  process.on('exit', (code) => {
    logger.info(
      `Process exiting with code ${code}. Performing final cleanup...`,
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception - initiating emergency shutdown', {
      error: error.message,
      stack: error.stack,
    });
    Sentry.captureException(error);
    try {
      downloadManager.killAllActiveDownloadsSync();
      logger.info('Emergency cleanup completed');
    } catch (cleanupError) {
      console.error('Error during emergency cleanup:', cleanupError);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection - potential memory leak', {
      reason,
      promise,
    });
    Sentry.captureException(reason);
  });
}

async function main() {
  try {
    initializeSentry();
    logger.info('🚀 Starting Tanzil Telegram Bot...');

    const config = loadConfig();
    CookiesManager.initialize(config.tempDirectory);
    logger.info('✅ Configuration loaded', {
      maxFileSize: `${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB`,
      maxConcurrentDownloads: config.maxConcurrentDownloads,
      downloadTimeout: config.downloadTimeout,
    });

    const app = await initializeComponents(config);
    logger.info('✅ All components initialized');

    registerHandlers(app);
    await startBot(config, app.bot);
    setupShutdownHandlers(app);

    logger.info('🎉 Tanzil Bot is fully operational!');
  } catch (error: unknown) {
    logger.error('Fatal error during startup', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    Sentry.captureException(error);
    process.exit(1);
  }
}

main();
