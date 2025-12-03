# Scripts Directory

This directory contains utility scripts for the Tanzil Bot project.

## generate-session.js

Generates a Telegram session string for MTProto authentication (required for downloading Telegram Stories).

### Prerequisites

1. Get your API credentials from [my.telegram.org](https://my.telegram.org):
   - Log in with your phone number
   - Go to "API development tools"
   - Create an app to get API ID and Hash

### Usage

**Option 1: Using command line arguments**

```bash
node scripts/generate-session.js <API_ID> <API_HASH> <PHONE_NUMBER>
```

Example:

```bash
node scripts/generate-session.js 12345678 abcdef1234567890abcdef1234567890 +1234567890
```

**Option 2: Using environment variables**

```bash
export TELEGRAM_API_ID=12345678
export TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
export PHONE_NUMBER=+1234567890
node scripts/generate-session.js
```

**Option 3: Interactive mode**

```bash
node scripts/generate-session.js <API_ID> <API_HASH>
# You'll be prompted for phone number
```

### Output

The script will:

1. Connect to Telegram
2. Send you a verification code
3. Ask you to enter the code
4. Generate a session string
5. Save it to `session.txt`
6. Display it in the console

Copy the session string and add it to your `.env` file:

```env
TELEGRAM_SESSION=your_session_string_here
```

### Security Notes

⚠️ **NEVER commit your session string to version control!**

- The `session.txt` file is gitignored
- Keep your session string private
- Regenerate if exposed

### Troubleshooting

**"Missing required parameters"**

- Make sure you provide API_ID and API_HASH
- Check that values are correct

**"Phone number invalid"**

- Include country code (e.g., +1234567890)
- No spaces or special characters except +

**"Code invalid"**

- Enter the code exactly as received
- Code expires after a few minutes
- Request a new code if expired
