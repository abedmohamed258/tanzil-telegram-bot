# Database Setup Guide

This guide will walk you through setting up your Supabase database for the Tanzil Bot.

## Prerequisites

- A Supabase account ([supabase.com](https://supabase.com))
- Access to the Supabase SQL Editor in your project dashboard

---

## Step-by-Step Setup

### Step 1: Create the Base Schema

This creates the essential tables for the bot.

**File to execute:** `schema.sql`

```sql
-- Run this first to create scheduled_tasks table
-- Already includes RLS policies for service_role
```

In your Supabase dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `schema.sql`
4. Click **Run** (or press Ctrl+Enter)

---

### Step 2: Apply RLS Policies

This ensures proper Row Level Security is configured for all tables.

**File to execute:** `fix_rls.sql`

This file:

- Enables RLS on all tables (users, download_history, scheduled_tasks, bot_settings)
- Creates policies allowing the service_role full access
- Grants necessary permissions

In your Supabase dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `fix_rls.sql`
4. Click **Run**

> **Note:** If you see any errors about tables not existing (like `users`, `download_history`, or `bot_settings`), this is expected if you haven't created them yet. The bot will create these tables automatically using the SupabaseManager on first run.

---

### Step 3: Verify Setup

After running the above scripts, verify your setup:

1. **Check Tables:**
   - Go to **Table Editor** in Supabase
   - You should see: `scheduled_tasks`
   - After the bot runs once, you'll also see: `users`, `download_history`, `bot_settings`

2. **Check RLS:**
   - Go to **Authentication** > **Policies**
   - You should see policies for `service_role` on all tables

---

## Additional Migration Files

### `migration_fix.sql`

This file is for fixing specific migration issues if you encounter errors. Only run this if you're experiencing problems with the database.

### `supabase_rls_fix.sql`

Alternative RLS configuration. Only use if `fix_rls.sql` doesn't work for your setup.

---

## Environment Variables

After setting up the database, make sure your `.env` file has:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

> ⚠️ **Important:** Use the **Service Role Key**, NOT the anon/public key. The Service Role Key can be found in:
> **Project Settings** > **API** > **Project API keys** > **service_role** (click to reveal)

---

## Troubleshooting

### Error: "relation does not exist"

- The bot creates some tables automatically on first run
- Only `scheduled_tasks` needs to be created manually

### Error: "insufficient_privilege" or code 42501

- Make sure you're using the **Service Role Key** in your `.env`
- Re-run `fix_rls.sql` to grant permissions

### Tables not appearing

- Check your Supabase project is active
- Verify you're connected to the correct project
- Try refreshing the Table Editor

---

## Summary

**Minimum required setup:**

1. Run `schema.sql` to create `scheduled_tasks` table
2. Run `fix_rls.sql` to configure permissions
3. Set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
4. Start the bot - it will create remaining tables automatically

**Execution order:**

1. ✅ `schema.sql` (required)
2. ✅ `fix_rls.sql` (required)
3. ⚠️ `migration_fix.sql` or `supabase_rls_fix.sql` (only if issues occur)
