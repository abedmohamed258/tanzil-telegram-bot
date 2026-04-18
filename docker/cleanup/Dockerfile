FROM alpine:3.18

RUN apk add --no-cache findutils

WORKDIR /app

COPY scripts/deployment/cleanup-storage.sh .
RUN chmod +x cleanup-storage.sh

# Create a cron job
RUN echo "0 3 * * * /app/cleanup-storage.sh >> /var/log/cleanup.log 2>&1" > /etc/crontabs/root

CMD ["crond", "-f", "-l", "2"]
