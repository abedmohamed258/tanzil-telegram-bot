/**
 * Types for scheduled tasks
 */

export interface ScheduledTaskOptions {
  chatId: number;
  threadId?: number;
  format: string;
  meta: ScheduledTaskMeta;
}

export interface ScheduledTaskMeta {
  isPlaylist?: boolean;
  indices?: number[];
  quality?: string;
  isAudio?: boolean;
  [key: string]: unknown;
}

export interface ScheduledTask {
  id: string;
  userId: number;
  url: string;
  executeAt: Date;
  options: ScheduledTaskOptions;
  createdAt: Date;
}

export interface DbScheduledTask {
  id: string;
  user_id: number;
  url: string;
  execute_at: string;
  options: Record<string, unknown>;
  created_at: string;
}
