#!/bin/bash
# init-ssl.sh: Bootstrap SSL and Nginx without deadlocks
set -e

DOMAIN=$1
EMAIL=$2
CERT_PATH="./docker/certs/conf/live/$DOMAIN"

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./scripts/init-ssl.sh <domain> <email>"
    exit 1
fi

mkdir -p ./docker/certs/conf
mkdir -p ./docker/certs/www

# 1. Create stub Nginx config if not exists
if [ ! -f "docker/nginx/ssl-params.conf" ]; then
    touch docker/nginx/ssl-params.conf
fi

# 2. Check if cert exists. If not, create dummy.
if [ ! -f "$CERT_PATH/fullchain.pem" ]; then
    echo "Creating dummy certificate for $DOMAIN..."
    mkdir -p "$CERT_PATH"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_PATH/privkey.pem" \
        -out "$CERT_PATH/fullchain.pem" \
        -subj "/CN=localhost"
fi

# 3. Start Nginx (it will now start because certs exist, even if dummy)
docker-compose up -d nginx

# 4. Request real certificate (only if dummy or expiring)
echo "Requesting real certificate for $DOMAIN..."
docker-compose run --rm certbot certonly --webroot -w /var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$DOMAIN" --force-renewal

# 5. Populate real SSL params
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > docker/nginx/ssl-params.conf

# 6. Reload Nginx
docker-compose exec nginx nginx -s reload
echo "SSL initialization complete for $DOMAIN"
