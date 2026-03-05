#!/bin/bash
# Deploy guidashboard to Orange Pi
# Run from project root.
#
# Requires SSH access. Options (env vars):
#   ORANGE_PI_HOST=192.168.88.15   (default)
#   ORANGE_PI_USER=orangepi        (default)
#   SSH_KEY=/path/to/key           (optional - use specific key)
#   ORANGE_PI_PASSWORD=xxx         (optional - use sshpass for password auth)

set -e
ORANGE_PI_HOST="${ORANGE_PI_HOST:-192.168.88.15}"
ORANGE_PI_USER="${ORANGE_PI_USER:-orangepi}"
ORANGE_PI="${ORANGE_PI_USER}@${ORANGE_PI_HOST}"
WEB_DIR="/var/www/html"
SERVER_DIR="/home/orangepi/guidashboard"

# Build SSH options for rsync and ssh
RSYNC_SSH="ssh -o StrictHostKeyChecking=accept-new"
if [ -n "${SSH_KEY:-}" ] && [ -f "$SSH_KEY" ]; then
  RSYNC_SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
elif [ -n "${ORANGE_PI_PASSWORD:-}" ]; then
  if command -v sshpass &>/dev/null; then
    RSYNC_SSH="sshpass -p $ORANGE_PI_PASSWORD ssh -o StrictHostKeyChecking=accept-new"
  else
    echo "ORANGE_PI_PASSWORD set but sshpass not installed. Install: brew install sshpass"
    exit 1
  fi
fi

echo "Building frontend..."
npm run build

echo "Deploying frontend to $ORANGE_PI:$WEB_DIR..."
rsync -avz --delete -e "$RSYNC_SSH" dist/ "$ORANGE_PI:/tmp/guidashboard-dist/"
if [ -n "${ORANGE_PI_PASSWORD:-}" ]; then
  echo "$ORANGE_PI_PASSWORD" | $RSYNC_SSH "$ORANGE_PI" "sudo -S bash -c 'cp -r /tmp/guidashboard-dist/* $WEB_DIR/ && chown -R www-data:www-data $WEB_DIR'"
else
  $RSYNC_SSH "$ORANGE_PI" "sudo cp -r /tmp/guidashboard-dist/* $WEB_DIR/ && sudo chown -R www-data:www-data $WEB_DIR"
fi

echo "Deploying server to $ORANGE_PI:$SERVER_DIR..."
rsync -avz -e "$RSYNC_SSH" server/ "$ORANGE_PI:$SERVER_DIR/"

echo "Restarting backend..."
$RSYNC_SSH "$ORANGE_PI" "cd $SERVER_DIR && (pm2 restart guidashboard-api 2>/dev/null || pm2 restart guidashboard-server 2>/dev/null || pm2 restart all)"

echo "Done. Test at http://${ORANGE_PI_HOST}/"
