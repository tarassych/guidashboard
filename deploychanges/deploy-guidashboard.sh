#!/bin/bash
set -e

REPO_DIR="/home/orangepi/guidashboard"
NGINX_ROOT="/var/www/html"
REPO_URL="https://github.com/tarassych/guidashboard.git"
BRANCH="main"
SERVER_NAME="guidashboard-server"

# Clone repo if missing
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Cloning repository..."
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

git fetch origin "$BRANCH" >/dev/null 2>&1

LOCAL=$(git rev-parse "$BRANCH")
REMOTE=$(git rev-parse "origin/$BRANCH")
BASE=$(git merge-base "$BRANCH" "origin/$BRANCH")

# Already up-to-date
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

# Behind remote → perform pull
if [ "$LOCAL" = "$BASE" ]; then
  echo "Updating from GitHub..."
  git pull --ff-only >/dev/null 2>&1

  # Check dist exists
  if [ ! -d "$REPO_DIR/dist" ]; then
    echo "ERROR: dist directory not found. Build and commit dist locally."
    exit 1
  fi

  # Deploy frontend to nginx
  echo "Deploying frontend to nginx..."
  sudo rm -rf "$NGINX_ROOT"/*
  sudo cp -r "$REPO_DIR/dist/"* "$NGINX_ROOT"/
  sudo chown -R www-data:www-data "$NGINX_ROOT"

  # Install/update server dependencies
  echo "Installing server dependencies..."
  cd "$REPO_DIR"
  npm install --production --omit=dev

  # Restart backend server with PM2
  echo "Restarting backend server..."
  if pm2 describe "$SERVER_NAME" > /dev/null 2>&1; then
    pm2 restart "$SERVER_NAME"
  else
    pm2 start server/index.js --name "$SERVER_NAME"
  fi
  pm2 save

  echo "Deployment complete."
  exit 0
fi

echo "Local repo state unusual (ahead/diverged). Not auto-updating. Exiting. Fake update"
exit 0