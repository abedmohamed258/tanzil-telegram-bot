/**
 * Pure Logic Helpers for Tanzil Bot
 * Extracted for testability
 */

/**
 * Calculate the credit cost of a download based on duration and type
 * @param duration Duration in seconds
 * @param isAudio Whether it is an audio-only download
 */
export function calculateCost(duration: number, isAudio: boolean): number {
    let cost = 0;
    if (duration < 300) cost = 5; // < 5m
    else if (duration < 1200) cost = 15; // 5-20m
    else if (duration < 3600) cost = 30; // 20-60m
    else cost = 60; // > 60m

    if (isAudio) cost = Math.ceil(cost / 2);
    return cost;
}

/**
 * Parse playlist selection string into an array of indices
 * @param input User input string (e.g., "1-5", "1,3,7", "all")
 * @param totalVideos Total number of videos in the playlist
 */
export function parsePlaylistSelection(input: string, totalVideos: number): number[] {
    const indices = new Set<number>();
    const text = input.toLowerCase().trim();

    if (!text) return [];

    if (text === 'all') {
        return Array.from({ length: totalVideos }, (_, i) => i + 1);
    }

    const parts = text.split(',');
    for (const part of parts) {
        const cleanPart = part.trim();
        if (!cleanPart) continue;

        if (cleanPart.includes('-')) {
            const rangeParts = cleanPart.split('-').map(s => s.trim());
            // Handle cases like "1-" or "-5" which split might return empty strings for
            if (rangeParts.length === 2 && rangeParts[0] !== '' && rangeParts[1] !== '') {
                const start = parseInt(rangeParts[0]);
                const end = parseInt(rangeParts[1]);

                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) indices.add(i);
                }
            }
        } else {
            const num = parseInt(cleanPart);
            if (!isNaN(num)) indices.add(num);
        }
    }

    // Convert to array, filter valid range, and sort
    return Array.from(indices)
        .filter(i => i >= 1 && i <= totalVideos)
        .sort((a, b) => a - b);
}
