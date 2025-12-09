/**
 * Download System - Main Entry Point
 * Exports all components of the new modular download system
 */

// Core components
export * from './core';
export { DownloadOrchestrator } from './core/DownloadOrchestrator';
export { ProviderManager } from './core/ProviderManager';

// Providers
export * from './providers';
export { YtDlpProvider } from './providers/YtDlpProvider';
export { CobaltProvider } from './providers/CobaltProvider';
export { InvidiousProvider } from './providers/InvidiousProvider';

// Security
export * from './security';
export { FileSanitizer } from './security/FileSanitizer';
export { RateLimiter } from './security/RateLimiter';

// Quality
export * from './quality';
export { QualityManager } from './quality/QualityManager';

// Re-export types for convenience
export type {
    VideoInfo,
    VideoFormat,
    DownloadResult,
    DownloadProgress,
    DownloadOptions,
    DownloadTask,
    DownloadState,
    Platform,
    ProviderStatus,
    ProviderHealth,
    IDownloadProvider,
} from './core/types';
