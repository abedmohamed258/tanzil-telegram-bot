/**
 * DownloadManager - Re-export for backward compatibility
 * 
 * This file maintains compatibility with existing imports while using 
 * the new modular download system internally.
 */

// Re-export from the new wrapper
export { DownloadManager } from './DownloadManagerV2';

// Also export the new system for direct access
export { DownloadOrchestrator } from './core/DownloadOrchestrator';
export { ProviderManager } from './core/ProviderManager';
