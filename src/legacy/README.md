# Legacy Components - StorageManager

## Overview

This directory contains the legacy `StorageManager.ts` implementation that was used in earlier versions of Tanzil Bot (v1-v3).

## Why is this here?

The `StorageManager` class provided a simple JSON-file-based storage system for user profiles, download history, and scheduled tasks. It was designed for:

- Quick prototyping
- Offline development
- Small-scale deployments without database dependency

## Current Status: DEPRECATED

**As of v4.0, the bot uses `SupabaseManager` exclusively.**

The codebase has been fully migrated to use Supabase for:

- Better scalability
- Real-time capabilities
- Cloud backups
- Multi-instance support

## Why keep it?

This file is kept for:

1. **Reference**: Understanding the data structure and migration path
2. **Fallback**: Quick local testing without Supabase setup
3. **Documentation**: Historical context for contributors

## Migration Path

If you have data in `data/store.json` from an old installation:

```typescript
// The SupabaseManager automatically handles migration
// from StorageManager format on first run
```

The `StorageManager` included auto-migration logic for legacy data structures.

## Should I use this?

**No.** For production deployments:

- ✅ Use `SupabaseManager` (already configured in `src/index.ts`)
- ❌ Do NOT switch back to `StorageManager`

For local development/testing:

- You can still use `SupabaseManager` with a free Supabase project
- It's not recommended to modify the codebase to use `StorageManager`

## Interface Compatibility

Both `StorageManager` and `SupabaseManager` implement similar interfaces:

- `getUser(userId)`
- `updateUser(user)`
- `addDownload(userId, record)`
- `getCredits(userId)`
- `useCredits(userId, amount)`
- `setPlaylistSession(userId, session)`
- `getScheduledTasks()`
- `addScheduledTask(task)`

This was by design to allow easy switching (though not recommended).

## File Structure

```
src/
├── database/
│   └── SupabaseManager.ts    ✅ ACTIVE - Use this
└── legacy/
    └── StorageManager.ts      ⚠️ LEGACY - Reference only
```

## Questions?

If you have questions about:

- **Using the current bot**: See main [README.md](../README.md)
- **Database setup**: See [docs/database-setup.md](../docs/database-setup.md)
- **Configuration**: See [docs/configuration.md](../docs/configuration.md)
- **Migration issues**: Open an issue on GitHub

---

**Last Updated:** December 2025  
**Status:** Deprecated - Not actively maintained
