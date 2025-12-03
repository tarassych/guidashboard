#!/bin/bash
set -e

REPO_DIR="/home/orangepi/guidashboard"
NGINX_ROOT="/var/www/html"
REPO_URL="https://github.com/tarassych/guidashboard.git"
BRANCH="main"   # change if your branch is different

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
  # echo "Already up to date."
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

  echo "Deploying new dist/ to nginx root..."

  sudo rm -rf "$NGINX_ROOT"/*
  sudo cp -r "$REPO_DIR/dist/"* "$NGINX_ROOT"/
  sudo chown -R www-data:www-data "$NGINX_ROOT"

  echo "Deployment complete."
  exit 0
fi

# Local ahead or diverged (do nothing)
echo "Local repo state unusual (ahead/diverged). Not auto-updating."
exit 0
