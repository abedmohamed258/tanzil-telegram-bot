export interface YtDlpFormat {
  format_id: string;
  format_note?: string;
  quality?: string | number;
  ext: string;
  filesize?: number;
  filesize_approx?: number;
  vcodec: string;
  acodec: string;
  width?: number;
  height?: number;
  fps?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
}

export interface YtDlpVideoInfo {
  title: string;
  duration: number;
  thumbnail?: string;
  uploader?: string;
  formats?: YtDlpFormat[];
  _type?: string;
  url?: string;
  webpage_url?: string;
}

export interface YtDlpPlaylistEntry {
  title: string;
  url: string;
  id?: string;
  _type?: string;
}
