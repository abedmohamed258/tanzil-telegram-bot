/**
 * Event types for EventBus
 */

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

export interface ErrorEventData {
  userId: number;
  error: Error;
  context?: string;
}

export type EventData =
  | ScheduleRequestData
  | DownloadCompleteData
  | ErrorEventData;

export type EventListener<T = EventData> = (...args: T[]) => void;
