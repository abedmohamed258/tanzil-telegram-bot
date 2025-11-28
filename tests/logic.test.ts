
import { calculateCost, parsePlaylistSelection } from '../src/utils/logicHelpers';

describe('Logic Helpers', () => {
    describe('calculateCost', () => {
        it('should return 5 for duration < 5 minutes', () => {
            expect(calculateCost(240, false)).toBe(5);
            expect(calculateCost(299, false)).toBe(5);
        });

        it('should return 15 for duration 5-20 minutes', () => {
            expect(calculateCost(300, false)).toBe(15);
            expect(calculateCost(1199, false)).toBe(15);
        });

        it('should return 30 for duration 20-60 minutes', () => {
            expect(calculateCost(1200, false)).toBe(30);
            expect(calculateCost(3599, false)).toBe(30);
        });

        it('should return 60 for duration > 60 minutes', () => {
            expect(calculateCost(3600, false)).toBe(60);
            expect(calculateCost(7200, false)).toBe(60);
        });

        it('should halve the cost for audio (rounded up)', () => {
            expect(calculateCost(240, true)).toBe(3); // 5 / 2 = 2.5 -> 3
            expect(calculateCost(300, true)).toBe(8); // 15 / 2 = 7.5 -> 8
            expect(calculateCost(1200, true)).toBe(15); // 30 / 2 = 15
            expect(calculateCost(3600, true)).toBe(30); // 60 / 2 = 30
        });
    });

    describe('parsePlaylistSelection', () => {
        it('should handle "all"', () => {
            expect(parsePlaylistSelection('all', 5)).toEqual([1, 2, 3, 4, 5]);
            expect(parsePlaylistSelection('ALL', 3)).toEqual([1, 2, 3]);
        });

        it('should handle single numbers', () => {
            expect(parsePlaylistSelection('1', 5)).toEqual([1]);
            expect(parsePlaylistSelection('1, 3, 5', 5)).toEqual([1, 3, 5]);
        });

        it('should handle ranges', () => {
            expect(parsePlaylistSelection('1-3', 5)).toEqual([1, 2, 3]);
            expect(parsePlaylistSelection('2-4', 5)).toEqual([2, 3, 4]);
        });

        it('should handle mixed input', () => {
            expect(parsePlaylistSelection('1, 3-5', 5)).toEqual([1, 3, 4, 5]);
        });

        it('should ignore invalid numbers and ranges', () => {
            expect(parsePlaylistSelection('1, foo, 3', 5)).toEqual([1, 3]);
            expect(parsePlaylistSelection('1-foo', 5)).toEqual([]);
        });

        it('should filter out of bounds indices', () => {
            expect(parsePlaylistSelection('1, 6', 5)).toEqual([1]);
            expect(parsePlaylistSelection('0, 1, 5', 5)).toEqual([1, 5]);
        });

        it('should handle duplicates', () => {
            expect(parsePlaylistSelection('1, 1, 2', 5)).toEqual([1, 2]);
        });

        it('should handle whitespace', () => {
            expect(parsePlaylistSelection(' 1 , 2 - 3 ', 5)).toEqual([1, 2, 3]);
        });

        it('should handle empty input', () => {
            expect(parsePlaylistSelection('', 5)).toEqual([]);
            expect(parsePlaylistSelection('   ', 5)).toEqual([]);
        });

        it('should handle zero gracefully', () => {
            expect(parsePlaylistSelection('0', 5)).toEqual([]);
            expect(parsePlaylistSelection('0-3', 5)).toEqual([1, 2, 3]);
        });

        it('should handle reverse ranges (ignore them)', () => {
            expect(parsePlaylistSelection('5-1', 5)).toEqual([]);
        });
    });
});
