import { logger } from './logger';

/**
 * InputValidator - Validates and sanitizes all user inputs
 * Prevents injection attacks and ensures data integrity
 * Requirements: 3.4
 */
export class InputValidator {
  /**
   * Validates and sanitizes text input
   * @param input - Raw text input from user
   * @param maxLength - Maximum allowed length (default: 4096)
   * @returns Sanitized text or null if invalid
   */
  static sanitizeText(
    input: string | undefined,
    maxLength: number = 4096,
  ): string | null {
    if (!input) {
      return null;
    }

    // Trim whitespace
    const trimmed = input.trim();

    // Check if empty after trimming
    if (trimmed.length === 0) {
      return null;
    }

    // Check length limit
    if (trimmed.length > maxLength) {
      logger.warn('Input exceeds maximum length', {
        length: trimmed.length,
        maxLength,
      });
      return trimmed.substring(0, maxLength);
    }

    // Remove null bytes and other control characters (except newlines and tabs)
    const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Validates user ID input
   * @param input - User ID as string
   * @returns Parsed user ID or null if invalid
   */
  static validateUserId(input: string | undefined): number | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();

    // Check if it's a valid number
    if (!/^\d+$/.test(trimmed)) {
      logger.debug('Invalid user ID format', { input: trimmed });
      return null;
    }

    const userId = parseInt(trimmed, 10);

    // Telegram user IDs are positive integers
    if (userId <= 0 || userId > Number.MAX_SAFE_INTEGER) {
      logger.debug('User ID out of valid range', { userId });
      return null;
    }

    return userId;
  }

  /**
   * Validates command parameters
   * @param params - Array of command parameters
   * @param expectedCount - Expected number of parameters
   * @returns True if valid, false otherwise
   */
  static validateCommandParams(
    params: (string | undefined)[],
    expectedCount: number,
  ): boolean {
    if (!params || params.length < expectedCount) {
      return false;
    }

    // Check that all expected parameters are non-empty
    for (let i = 0; i < expectedCount; i++) {
      if (!params[i] || params[i]!.trim().length === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates and sanitizes callback data
   * @param data - Callback query data
   * @returns Sanitized callback data or null if invalid
   */
  static sanitizeCallbackData(data: string | undefined): string | null {
    if (!data) {
      return null;
    }

    const trimmed = data.trim();

    // Callback data should not be empty
    if (trimmed.length === 0) {
      return null;
    }

    // Telegram callback data has a 64-byte limit
    if (trimmed.length > 64) {
      logger.warn('Callback data exceeds Telegram limit', {
        length: trimmed.length,
      });
      return trimmed.substring(0, 64);
    }

    // Only allow alphanumeric, colon, underscore, and hyphen
    if (!/^[a-zA-Z0-9:_-]+$/.test(trimmed)) {
      logger.warn('Invalid characters in callback data', { data: trimmed });
      return null;
    }

    return trimmed;
  }

  /**
   * Validates numeric input within a range
   * @param input - Numeric input as string
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @returns Parsed number or null if invalid
   */
  static validateNumericInput(
    input: string | undefined,
    min: number,
    max: number,
  ): number | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();

    if (trimmed === '') {
      return null;
    }

    // Check if it's a valid number (including decimals)
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      logger.debug('Invalid numeric format', { input: trimmed });
      return null;
    }

    const value = parseFloat(trimmed);

    // Check if within range
    if (value < min || value > max) {
      logger.debug('Numeric value out of range', { value, min, max });
      return null;
    }

    return value;
  }

  /**
   * Validates timezone offset input
   * @param input - Timezone offset as string (e.g., "+3", "-5")
   * @returns Parsed offset or null if invalid
   */
  static validateTimezoneOffset(input: string | undefined): number | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();

    // Check format: optional +/- followed by digits
    if (!/^[+-]?\d+$/.test(trimmed)) {
      logger.debug('Invalid timezone format', { input: trimmed });
      return null;
    }

    const offset = parseInt(trimmed, 10);

    // Timezone offsets range from -12 to +14
    if (offset < -12 || offset > 14) {
      logger.debug('Timezone offset out of range', { offset });
      return null;
    }

    return offset;
  }

  /**
   * Sanitizes HTML/Markdown to prevent injection
   * @param input - Text that may contain HTML/Markdown
   * @returns Sanitized text with escaped special characters
   */
  static escapeMarkdown(input: string): string {
    if (!input) {
      return '';
    }

    // Escape Markdown special characters
    return input
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  /**
   * Validates file path to prevent directory traversal
   * @param path - File path input
   * @returns True if safe, false if potentially malicious
   */
  static isPathSafe(path: string): boolean {
    if (!path) {
      return false;
    }

    // Check for directory traversal patterns
    if (path.includes('..') || path.includes('~')) {
      logger.warn('Potential directory traversal attempt', { path });
      return false;
    }

    // Check for absolute paths (should use relative paths only)
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
      logger.warn('Absolute path not allowed', { path });
      return false;
    }

    return true;
  }

  /**
   * Validates schedule time input
   * @param input - Time input (e.g., "14:30", "2:45 PM")
   * @returns Parsed time object or null if invalid
   */
  static validateTimeInput(
    input: string | undefined,
  ): { hours: number; minutes: number } | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();

    // Support 24-hour format: HH:MM
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return { hours, minutes };
      }
    }

    logger.debug('Invalid time format', { input: trimmed });
    return null;
  }

  /**
   * Validates credit amount input
   * @param input - Credit amount as string
   * @returns Parsed credit amount or null if invalid
   */
  static validateCreditAmount(input: string | undefined): number | null {
    const amount = this.validateNumericInput(input, 0, 1000000);

    if (amount === null) {
      return null;
    }

    // Credits should be whole numbers
    if (!Number.isInteger(amount)) {
      logger.debug('Credit amount must be integer', { amount });
      return null;
    }

    return amount;
  }
}
