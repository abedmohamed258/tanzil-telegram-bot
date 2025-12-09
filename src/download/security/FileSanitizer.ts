/**
 * FileSanitizer - Security layer for validating and sanitizing downloaded files
 * Checks file types, sizes, and content for safety
 */

import { logger } from '../../utils/logger';
import { FileValidation } from '../core/types';

// Magic bytes for common video/audio formats
const MAGIC_BYTES: Record<string, Buffer[]> = {
    // Video formats
    'video/mp4': [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
        Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
    ],
    'video/webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
    'video/x-matroska': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
    'video/quicktime': [Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70])],

    // Audio formats
    'audio/mpeg': [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xFA]), Buffer.from([0x49, 0x44, 0x33])],
    'audio/mp4': [Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])],
    'audio/ogg': [Buffer.from([0x4F, 0x67, 0x67, 0x53])],
    'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    'audio/flac': [Buffer.from([0x66, 0x4C, 0x61, 0x43])],
};

// Allowed MIME types
const ALLOWED_TYPES = new Set([
    'video/mp4',
    'video/webm',
    'video/x-matroska',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/flac',
    'audio/x-m4a',
]);

// Dangerous file extensions
const DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js',
    '.jar', '.msi', '.dll', '.ps1', '.sh', '.php', '.py', '.rb',
]);

// Maximum file sizes
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const TELEGRAM_MAX_SIZE = 50 * 1024 * 1024; // 50MB for regular files
const TELEGRAM_MAX_VIDEO = 2 * 1024 * 1024 * 1024; // 2GB for video

export class FileSanitizer {
    /**
     * Validate a file for safety
     */
    async validateFile(filePath: string): Promise<FileValidation> {
        const warnings: string[] = [];

        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            // Check file exists
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                return {
                    isValid: false,
                    isSafe: false,
                    warnings: ['Path is not a file'],
                };
            }

            const actualSize = stats.size;
            const extension = path.extname(filePath).toLowerCase();
            const filename = path.basename(filePath);

            // Check dangerous extensions
            if (DANGEROUS_EXTENSIONS.has(extension)) {
                return {
                    isValid: false,
                    isSafe: false,
                    actualSize,
                    warnings: [`Dangerous file extension: ${extension}`],
                };
            }

            // Check file size
            if (actualSize > MAX_FILE_SIZE) {
                return {
                    isValid: false,
                    isSafe: false,
                    actualSize,
                    warnings: ['File exceeds maximum size limit'],
                };
            }

            if (actualSize > TELEGRAM_MAX_VIDEO) {
                warnings.push('File exceeds Telegram video size limit');
            }

            // Check magic bytes
            const mimeType = await this.detectMimeType(filePath);
            if (!mimeType) {
                warnings.push('Could not determine file type from content');
            } else if (!ALLOWED_TYPES.has(mimeType)) {
                return {
                    isValid: false,
                    mimeType,
                    actualSize,
                    isSafe: false,
                    warnings: [`File type not allowed: ${mimeType}`],
                };
            }

            // Validate filename
            const sanitizedFilename = this.sanitizeFilename(filename);
            if (sanitizedFilename !== filename) {
                warnings.push('Filename was sanitized');
            }

            logger.debug('File validation passed', { filePath, mimeType, actualSize });

            return {
                isValid: true,
                mimeType: mimeType ?? undefined,
                actualSize,
                isSafe: true,
                warnings,
            };
        } catch (error) {
            const err = error as Error;
            logger.error('File validation error', { filePath, error: err.message });

            return {
                isValid: false,
                isSafe: false,
                warnings: [`Validation error: ${err.message}`],
            };
        }
    }

    /**
     * Detect MIME type from file content (magic bytes)
     */
    private async detectMimeType(filePath: string): Promise<string | null> {
        try {
            const fs = await import('fs/promises');
            const handle = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(32);

            await handle.read(buffer, 0, 32, 0);
            await handle.close();

            for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
                for (const signature of signatures) {
                    if (buffer.subarray(0, signature.length).equals(signature)) {
                        return mimeType;
                    }
                }
            }

            // Check for MP4 ftyp at various offsets
            const ftypIndex = buffer.indexOf('ftyp');
            if (ftypIndex !== -1 && ftypIndex < 12) {
                return 'video/mp4';
            }

            // Check for MP3 ID3 tag
            if (buffer.toString('utf8', 0, 3) === 'ID3') {
                return 'audio/mpeg';
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Sanitize filename removing dangerous characters
     */
    sanitizeFilename(filename: string): string {
        return filename
            // Remove path traversal attempts
            .replace(/\.\./g, '')
            // Remove dangerous characters
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            // Remove leading/trailing dots and spaces
            .replace(/^[\s.]+|[\s.]+$/g, '')
            // Limit length
            .substring(0, 200)
            // Replace multiple underscores
            .replace(/_+/g, '_')
            // Ensure not empty
            || 'download';
    }

    /**
     * Check if file size is within Telegram limits
     */
    checkTelegramLimits(fileSize: number, isVideo: boolean): { allowed: boolean; warning?: string } {
        const limit = isVideo ? TELEGRAM_MAX_VIDEO : TELEGRAM_MAX_SIZE;

        if (fileSize > limit) {
            return {
                allowed: false,
                warning: isVideo
                    ? 'Video exceeds Telegram 2GB limit'
                    : 'File exceeds Telegram 50MB limit',
            };
        }

        if (isVideo && fileSize > 50 * 1024 * 1024) {
            return {
                allowed: true,
                warning: 'Large video file - upload may be slow',
            };
        }

        return { allowed: true };
    }

    /**
     * Get file extension from MIME type
     */
    getExtensionFromMime(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/x-matroska': '.mkv',
            'video/quicktime': '.mov',
            'audio/mpeg': '.mp3',
            'audio/mp4': '.m4a',
            'audio/ogg': '.ogg',
            'audio/wav': '.wav',
            'audio/flac': '.flac',
        };

        return mimeToExt[mimeType] || '.mp4';
    }
}
