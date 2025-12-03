import { Telegraf } from 'telegraf';
import { SupabaseManager } from '../database/SupabaseManager';
import { RequestQueue } from '../queue/RequestQueue';
import { DownloadManager } from '../download/DownloadManager';
import { FileManager } from '../utils/FileManager';
import { URLValidator } from '../utils/UrlValidator';
import { AdminConfig } from './config';
import { AdminService } from '../bot/services/AdminService';
import { UserService } from '../bot/services/UserService';
import { DownloadService } from '../bot/services/DownloadService';
import { StoryService } from '../bot/services/StoryService';
import { BlockService } from '../bot/services/BlockService';

export interface AppContext {
  bot: Telegraf;
  storage: SupabaseManager;
  queue: RequestQueue;
  downloadManager: DownloadManager;
  fileManager: FileManager;
  urlValidator: URLValidator;
  adminConfig: AdminConfig;
  adminService: AdminService;
  userService: UserService;
  downloadService: DownloadService;
  storyService: StoryService;
  blockService: BlockService;
}
