# Configuration Guide

Complete guide for configuring the Tanzil Telegram Bot.

## Environment Variables

All configuration is done through environment variables in the `.env` file.

### Setup

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values

---

## Required Variables

### Telegram Bot Settings

```env
# Get this token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

**How to get:**

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Copy the token provided

---

### Admin Configuration

```env
# The Supergroup ID where bot admins operate
ADMIN_GROUP_ID=-1001234567890

# Topic IDs for organized logging
TOPIC_GENERAL=2
TOPIC_CONTROL=3
TOPIC_LOGS=4
TOPIC_ERRORS=5
```

**How to get Group ID:**

1. Add your bot to a Supergroup
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":-100...}` - that's your group ID

**Topics Setup:**

1. Enable topics in your Supergroup settings
2. Create topics named: General, Control, Logs, Errors
3. Send a message in each topic
4. Check `getUpdates` API - look for `"message_thread_id"` values

---

### Database Configuration

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

**How to get:**

1. Go to [supabase.com](https://supabase.com)
2. Create or open your project
3. Go to **Project Settings** > **API**
4. Copy:
   - **URL** → `SUPABASE_URL`
   - **service_role key** (click to reveal) → `SUPABASE_KEY`

> ⚠️ Use **service_role key**, NOT anon key!

---

## Optional Variables

### Telegram Stories Support

```env
# Only needed for downloading Telegram Stories
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION=
```

**How to get API credentials:**

1. Visit [my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Go to **API development tools**
4. Create an app to get API ID and Hash

**Generate session string:**

```bash
node generate-session.js
```

---

### Deployment Settings

```env
# Port for the bot server (webhook mode)
PORT=3000

# Webhook settings (recommended for production)
USE_WEBHOOK=false
WEBHOOK_URL=https://your-domain.com/webhook
```

**Webhook vs Polling:**

- **Polling** (default): Bot checks for new messages periodically. Good for development.
- **Webhook**: Telegram pushes updates to your server. Better for production. Requires HTTPS.

---

### Download Configuration

```env
# Maximum file size in bytes (2GB default)
MAX_FILE_SIZE=2147483648

# Maximum concurrent downloads
MAX_CONCURRENT_DOWNLOADS=5

# Download timeout in milliseconds (5 minutes default)
DOWNLOAD_TIMEOUT=300000

# Number of retry attempts for failed downloads
RETRY_ATTEMPTS=3
```

**Recommendations:**

- `MAX_FILE_SIZE`: Telegram's limit is 2GB for bots
- `MAX_CONCURRENT_DOWNLOADS`: 3-5 is safe for most VPS
- `DOWNLOAD_TIMEOUT`: Increase for slow connections
- `RETRY_ATTEMPTS`: 3 is a good balance

---

### User Management

```env
# Daily download credit limit per user
DAILY_CREDITS=100
```

Credits prevent abuse. Each download costs 1-10 credits based on file size.

---

### File Management

```env
# Temporary directory for downloads
TEMP_DIRECTORY=./temp
```

**Note:** Ensure this directory is writable and has enough space.

---

### Error Tracking (Optional)

```env
# Sentry DSN for error tracking
SENTRY_DSN=
```

**How to get:**

1. Create account at [sentry.io](https://sentry.io)
2. Create a new project (Node.js)
3. Copy the DSN URL
4. Leave empty to disable error tracking

---

## Complete Example

Here's a minimal working `.env`:

```env
# Required
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_GROUP_ID=-1001234567890
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_KEY=eyJhbGc...

# Topics
TOPIC_GENERAL=1
TOPIC_CONTROL=2
TOPIC_LOGS=3
TOPIC_ERRORS=4

# Optional (using defaults)
PORT=3000
USE_WEBHOOK=false
MAX_FILE_SIZE=2147483648
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT=300000
RETRY_ATTEMPTS=3
DAILY_CREDITS=100
TEMP_DIRECTORY=./temp
```

---

## Validation

After setting up your `.env`, test the configuration:

```bash
npm run build
npm start
```

The bot should:

1. ✅ Connect to Telegram
2. ✅ Connect to Supabase
3. ✅ Start polling/webhook
4. ✅ Log "Bot is fully operational!"

If you see errors, check:

- Token format is correct
- Supabase credentials are valid
- Required directories exist
- Port is not in use (if using webhook)

---

## Security Best Practices

1. **Never commit `.env` to git** - it's in `.gitignore` for a reason
2. **Use service_role key** for Supabase, not anon key
3. **Keep your bot token secret** - regenerate if exposed
4. **Use HTTPS** for webhooks in production
5. **Set appropriate file permissions** on `.env` (chmod 600)

---

## Troubleshooting

### "Missing required environment variable: BOT_TOKEN"

- Your `.env` file has `BOT_TOKEN` instead of `TELEGRAM_BOT_TOKEN`
- Rename it or check `.env.example` for correct names

### "Failed to connect to Supabase"

- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check if your Supabase project is active
- Ensure you're using the **service_role** key

### "Port 3000 already in use"

- Change `PORT` to a different number
- Or stop the conflicting process

### Bot doesn't respond

- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is not already running elsewhere
- Check bot privacy settings (should be off for groups)
