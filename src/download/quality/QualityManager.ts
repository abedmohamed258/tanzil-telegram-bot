/**
 * QualityManager - Manages video quality selection and format handling
 */

import { VideoFormat } from '../core/types';

export interface QualityPreference {
    preferredQuality: string;  // '4K' | '1080p' | '720p' | '480p' | 'best' | 'worst'
    preferMp4: boolean;
    maxFileSize?: number;
    maxDuration?: number;
}

export class QualityManager {
    private readonly defaultPreference: QualityPreference = {
        preferredQuality: '1080p',
        preferMp4: true,
    };

    /**
     * Select the best format based on preferences
     */
    selectBestFormat(
        formats: VideoFormat[],
        preference: Partial<QualityPreference> = {},
    ): VideoFormat | null {
        const pref = { ...this.defaultPreference, ...preference };

        if (formats.length === 0) return null;

        // Filter by file size if specified
        let filtered = pref.maxFileSize
            ? formats.filter(f => f.filesize <= pref.maxFileSize!)
            : formats;

        if (filtered.length === 0) filtered = formats;

        // Sort by quality preference
        const sorted = this.sortByPreference(filtered, pref);

        return sorted[0] || null;
    }

    /**
     * Select format for audio download
     */
    selectAudioFormat(formats: VideoFormat[]): VideoFormat | null {
        const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);

        if (audioFormats.length === 0) {
            // Fall back to any format with audio
            const withAudio = formats.filter(f => f.hasAudio);
            return withAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
        }

        // Sort by bitrate (higher is better)
        return audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    }

    /**
     * Group formats by resolution category
     */
    groupByResolution(formats: VideoFormat[]): Map<string, VideoFormat[]> {
        const groups = new Map<string, VideoFormat[]>();

        for (const format of formats) {
            if (!format.hasVideo) continue;

            const category = format.resolutionCategory || 'other';
            const existing = groups.get(category) || [];
            existing.push(format);
            groups.set(category, existing);
        }

        // Sort formats within each group by filesize
        for (const [key, value] of groups) {
            groups.set(key, value.sort((a, b) => a.filesize - b.filesize));
        }

        return groups;
    }

    /**
     * Get format suitable for Telegram (under 50MB or use stream for larger)
     */
    getTelegramSuitableFormat(formats: VideoFormat[]): { format: VideoFormat; needsStream: boolean } | null {
        const telegramLimit = 50 * 1024 * 1024;

        // First try to find a format under 50MB
        const suitable = formats
            .filter(f => f.hasVideo && f.hasAudio && f.filesize > 0 && f.filesize <= telegramLimit)
            .sort((a, b) => b.filesize - a.filesize);

        if (suitable.length > 0) {
            return { format: suitable[0], needsStream: false };
        }

        // Otherwise return the smallest video format
        const smallest = formats
            .filter(f => f.hasVideo)
            .sort((a, b) => a.filesize - b.filesize);

        if (smallest.length > 0) {
            return { format: smallest[0], needsStream: smallest[0].filesize > telegramLimit };
        }

        return null;
    }

    /**
     * Create quality menu options
     */
    createQualityOptions(formats: VideoFormat[]): Array<{
        label: string;
        formatId: string;
        filesize: number;
        quality: string;
    }> {
        const grouped = this.groupByResolution(formats);
        const options: Array<{
            label: string;
            formatId: string;
            filesize: number;
            quality: string;
        }> = [];

        // Order of quality categories
        const order = ['4K', '1080p', '720p', '480p', '360p', 'other'];

        for (const category of order) {
            const categoryFormats = grouped.get(category);
            if (!categoryFormats || categoryFormats.length === 0) continue;

            // Get the best format in this category (prefer mp4)
            const best = categoryFormats
                .filter(f => f.extension === 'mp4')
                .sort((a, b) => b.filesize - a.filesize)[0]
                || categoryFormats[0];

            options.push({
                label: this.formatLabel(best),
                formatId: best.formatId,
                filesize: best.filesize,
                quality: category,
            });
        }

        return options;
    }

    /**
     * Format human-readable label
     */
    private formatLabel(format: VideoFormat): string {
        const sizeStr = this.formatFileSize(format.filesize);
        let label = format.quality;

        if (format.fps && format.fps > 30) {
            label += ` ${format.fps}fps`;
        }

        return `${label} (${sizeStr})`;
    }

    /**
     * Format file size
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return 'Unknown';

        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Sort formats by preference
     */
    private sortByPreference(formats: VideoFormat[], pref: QualityPreference): VideoFormat[] {
        const qualityOrder: Record<string, number> = {
            '4K': 4,
            '1080p': 3,
            '720p': 2,
            '480p': 1,
            '360p': 0,
            'other': -1,
        };

        const preferredValue = qualityOrder[pref.preferredQuality] ?? 3;

        return [...formats].sort((a, b) => {
            // Prefer video+audio combined
            const aHasBoth = a.hasVideo && a.hasAudio;
            const bHasBoth = b.hasVideo && b.hasAudio;
            if (aHasBoth !== bHasBoth) return bHasBoth ? 1 : -1;

            // Prefer mp4 if specified
            if (pref.preferMp4) {
                const aIsMp4 = a.extension === 'mp4';
                const bIsMp4 = b.extension === 'mp4';
                if (aIsMp4 !== bIsMp4) return bIsMp4 ? 1 : -1;
            }

            // Sort by distance to preferred quality
            const aValue = qualityOrder[a.resolutionCategory || 'other'] ?? -1;
            const bValue = qualityOrder[b.resolutionCategory || 'other'] ?? -1;
            const aDist = Math.abs(aValue - preferredValue);
            const bDist = Math.abs(bValue - preferredValue);

            if (aDist !== bDist) return aDist - bDist;

            // If same quality, prefer larger file (usually better quality)
            return b.filesize - a.filesize;
        });
    }
}
