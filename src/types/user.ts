export interface BlockRecord {
  type: 'temp' | 'perm';
  reason: string;
  expiry?: number; // Timestamp for temp blocks
  blockedAt: number;
  blockedBy: number; // Admin ID
}

export interface DownloadRecordMetadata {
  isAudio?: boolean;
  duration?: number;
  fileSize?: number;
  quality?: string;
}

export interface DownloadRecord {
  title: string;
  url: string;
  format: string;
  date: string; // ISO Date
  timestamp: number;
  filename?: string;
  metadata?: DownloadRecordMetadata;
}

export interface Credits {
  used: number;
  lastReset: string; // ISO Date
}

export interface PlaylistSession {
  url: string;
  indices: number[];
  totalVideos: number;
  state: 'WAITING_FOR_SELECTION' | 'PROCESSING';
  currentIndex?: number;
  options?: string;
  threadId?: number;
  menuMessageId?: number;
  mode?: 'download' | 'schedule';
}

export interface UserProfile {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
  joinedAt: string; // ISO Date
  lastActive: string; // ISO Date
  blockRecord?: BlockRecord;
  downloadHistory: DownloadRecord[];
  credits: Credits;
  timezone: number; // Offset from UTC
  activePlaylist: PlaylistSession | null;
  preferredQuality?: 'ask' | 'best' | 'audio' | string;
}
