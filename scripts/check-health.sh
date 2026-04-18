#!/bin/bash
# Simple health check script for Tanzil production environment
# Can be run manually or triggered by cron

SERVER_URL="https://yourdomain.com/health" # Adjust to actual public URL
TELEGRAM_WEBHOOK_URL="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"
CHAT_ID="${ALERTS_CHAT_ID}"

function alert() {
    local message="$1"
    if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
        curl -s -X POST $TELEGRAM_WEBHOOK_URL \
            -d chat_id=$CHAT_ID \
            -d text="🚨 *Tanzil Health Alert*: $message" \
            -d parse_mode="Markdown" > /dev/null
    fi
    echo "ALERT: $message"
}

# Check Docker container status
if ! docker-compose ps | grep "Up" > /dev/null; then
    alert "One or more containers are down or in a non-running state."
    exit 1
fi

# Check public endpoint
response_code=$(curl -s -o /dev/null -w "%{http_code}" $SERVER_URL)
if [ "$response_code" != "200" ]; then
    alert "Public endpoint returned HTTP $response_code. The service might be inaccessible."
    exit 1
fi

echo "✅ System health check passed at $(date)"
