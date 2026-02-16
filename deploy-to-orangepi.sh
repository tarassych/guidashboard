#!/bin/bash
# Deploy guidashboard to Orange Pi at 192.168.88.15
# Run from project root. Requires SSH access to orangepi@192.168.88.15

set -e
ORANGE_PI="orangepi@192.168.88.15"
WEB_DIR="/var/www/html"
SERVER_DIR="/home/orangepi/guidashboard"

echo "Building frontend..."
npm run build

echo "Deploying frontend to $ORANGE_PI:$WEB_DIR..."
rsync -avz --delete dist/ "$ORANGE_PI:/tmp/guidashboard-dist/"
ssh "$ORANGE_PI" "sudo cp -r /tmp/guidashboard-dist/* $WEB_DIR/ && sudo chown -R www-data:www-data $WEB_DIR"

echo "Deploying server to $ORANGE_PI:$SERVER_DIR..."
rsync -avz server/ "$ORANGE_PI:$SERVER_DIR/"

echo "Restarting backend..."
ssh "$ORANGE_PI" "cd $SERVER_DIR && (pm2 restart guidashboard-api 2>/dev/null || pm2 restart guidashboard-server 2>/dev/null || pm2 restart all)"

echo "Done. Test at http://192.168.88.15/"
