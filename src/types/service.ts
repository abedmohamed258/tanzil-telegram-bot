/**
 * Service-related type definitions
 */

export type UserStateAction =
  | 'WAITING_SCHEDULE_LINK'
  | 'WAITING_SCHEDULE_TIME'
  | 'WAITING_SUPPORT_MESSAGE'
  | 'WAITING_LOCATION';

export interface ScheduleStateData {
  url?: string;
  isPlaylist?: boolean;
  indices?: number[];
  format?: string;
  forceTomorrow?: boolean;
}

export interface UserState {
  action: UserStateAction;
  data?: ScheduleStateData;
  timestamp: number;
}

export interface ScheduleRequestEventData {
  userId: number;
  url: string;
  isPlaylist: boolean;
  indices?: number[];
  format?: string;
}

// Inline keyboard button type (compatible with Telegraf)
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface EditMessageOptions {
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: {
    inline_keyboard?: InlineKeyboardButton[][];
  };
}

import { PlaylistSession, BlockRecord } from './user';

export interface DbUserRecord {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  joined_at: string;
  last_active: string;
  credits_used: number;
  credits_last_reset: string;
  timezone: number;
  active_playlist: PlaylistSession | null;
  block_record: BlockRecord | null;
  preferred_quality?: string;
}

export interface DbUpdateData {
  id: number;
  last_active: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  preferred_quality?: string;
  joined_at?: string;
  timezone?: number;
  credits_used?: number;
  credits_last_reset?: string;
}
