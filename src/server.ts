import express, { Request, Response } from 'express';
import { Telegraf } from 'telegraf';
import { logger } from './utils/logger';

/**
 * Express server for Webhook mode (recommended for Render)
 * Implements webhook endpoint from RENDER_DEPLOYMENT.md
 */
export class Server {
  private app: express.Application;
  private bot: Telegraf;
  private port: number;
  private webhookUrl: string;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private readonly KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes

  constructor(bot: Telegraf, port: number, webhookUrl: string) {
    this.app = express();
    this.bot = bot;
    this.port = port;
    this.webhookUrl = webhookUrl;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint (for UptimeRobot and Render health checks)
    this.app.get('/health', (_req: Request, res: Response) => {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      res.status(200).json({
        status: 'ok',
        uptime: Math.floor(uptime),
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Webhook endpoint for Telegram
    this.app.post('/webhook', (req: Request, res: Response) => {
      this.bot.handleUpdate(req.body, res);
    });

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.send('🤖 Tanzil Telegram Bot is running!');
    });
  }

  /**
   * Start keep-alive mechanism to prevent Render free tier from sleeping
   * Pings /health endpoint every 14 minutes
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(async () => {
      try {
        const healthUrl = this.webhookUrl.replace(/\/webhook$/, '') + '/health';
        const response = await fetch(healthUrl);
        if (response.ok) {
          logger.debug('🏓 Keep-alive ping successful');
        } else {
          logger.warn('Keep-alive ping returned non-OK status', { status: response.status });
        }
      } catch (error: unknown) {
        logger.warn('Keep-alive ping failed', { error: (error as Error).message });
      }
    }, this.KEEP_ALIVE_INTERVAL);

    logger.info('🔔 Keep-alive started (every 14 minutes)');
  }

  /**
   * Stop keep-alive mechanism
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      logger.info('🔕 Keep-alive stopped');
    }
  }

  /**
   * Start the server and set webhook
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, async () => {
        logger.info(`🚀 Server running on port ${this.port}`);

        try {
          // Ensure we don't add /webhook twice if URL already ends with it
          const webhookPath = this.webhookUrl.endsWith('/webhook')
            ? this.webhookUrl
            : `${this.webhookUrl}/webhook`;
          await this.bot.telegram.setWebhook(webhookPath);
          logger.info(`✅ Webhook set to: ${webhookPath}`);

          // Start keep-alive mechanism
          this.startKeepAlive();
        } catch (error: unknown) {
          logger.error('Failed to set webhook', {
            error: (error as Error).message,
          });
        }

        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    logger.info('🛑 Server shutting down...');
    this.stopKeepAlive();
    // Cleanup can be added here if needed
  }
}
