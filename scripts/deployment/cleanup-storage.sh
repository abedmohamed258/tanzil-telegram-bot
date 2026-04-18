#!/bin/sh
# Cleanup script for Tanzil
# Sends a request to the Core Engine to purge old data

RETENTION_DAYS=${CLEANUP_RETENTION_DAYS:-7}
CORE_URL="http://core:8000"

echo "[$(date)] Triggering storage cleanup (Retention: $RETENTION_DAYS days)..."

# API Call to Core Engine to handle cleanup (Synchronizes DB and Filesystem)
curl -X POST "$CORE_URL/tasks/purge?days=$RETENTION_DAYS" \
     -H "Authorization: Bearer $CORE_API_TOKEN" \
     -f || echo "Error: Cleanup API call failed"

echo "[$(date)] Cleanup triggered."
