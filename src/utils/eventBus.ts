import { EventEmitter } from 'events';
import { logger } from './logger';

export enum BotEvents {
  PLAYLIST_SELECTION_REQUIRED = 'playlist_selection_required',
  SCHEDULE_REQUESTED = 'schedule_requested',
  DOWNLOAD_COMPLETED = 'download_completed',
  DOWNLOAD_FAILED = 'download_failed',
}

export interface ScheduleRequestData {
  userId: number;
  url: string;
  isPlaylist?: boolean;
  indices?: number[];
  format?: string;
}

export interface DownloadCompleteData {
  userId: number;
  url: string;
  success: boolean;
  filePath?: string;
  error?: string;
}

export type EventData =
  | ScheduleRequestData
  | DownloadCompleteData
  | Record<string, unknown>;
export type EventListener = (...args: EventData[]) => void;

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  public emit(event: BotEvents, ...args: EventData[]): boolean {
    logger.debug(`EventBus: Emitting ${event}`, { args });
    return super.emit(event, ...args);
  }

  public on(event: BotEvents, listener: EventListener): this {
    logger.debug(`EventBus: Listener added for ${event}`);
    return super.on(event, listener);
  }
}

export const eventBus = new EventBus();
