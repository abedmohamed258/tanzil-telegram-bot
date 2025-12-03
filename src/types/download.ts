export interface Format {
  formatId: string;
  quality: string;
  extension: string;
  filesize: number;
  hasVideo: boolean;
  hasAudio: boolean;
  // Enhanced fields for quality selection
  bitrate?: number; // For audio formats (kbps)
  fps?: number; // For video formats
  codec?: string; // vcodec or acodec
  resolutionCategory?: string; // '4K' | '1080p' | '720p' | '480p' | 'Other'
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  formats: Format[];
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface DownloadRequest {
  id: string;
  userId: number;
  user?: {
    id: number;
    firstName: string;
    username?: string;
  };
  videoInfo?: {
    title: string;
  };
  chatId: number;
  url: string;
  format?: string;
  priority: number;
  createdAt: Date;
  statusMessageId?: number;
  reservedCredits?: number;
}

export interface QueueStatus {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: number;
}

export interface Session {
  id: string;
  userId: number;
  url: string;
  videoInfo?: VideoInfo;
  selectedFormat?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface FileMetadata {
  filename: string;
  title: string;
  duration?: number;
  mimeType: string;
  thumbnail?: Buffer;
}

export interface DownloadProgress {
  sessionId: string;
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
}

export interface ErrorContext {
  sessionId?: string;
  chatId?: number;
  userId?: number;
  operation: string;
}

export interface ScheduledTaskMeta {
  isPlaylist?: boolean;
  indices?: number[];
  totalVideos?: number;
  forceTomorrow?: boolean;
}

export interface ScheduledTaskOptions {
  chatId: number;
  threadId?: number;
  format?: string;
  meta?: ScheduledTaskMeta;
}

export interface ScheduledTask {
  id: string;
  userId: number;
  url: string;
  executeAt: string;
  options: ScheduledTaskOptions;
}
