#!/bin/bash
set -e

REPO_DIR="/home/orangepi/guidashboard"
NGINX_ROOT="/var/www/html"
REPO_URL="https://github.com/tarassych/guidashboard.git"
BRANCH="main"
SERVER_NAME="guidashboard-server"
NGINX_CONF="/etc/nginx/sites-enabled/default"

# Function to check and install PM2
ensure_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing PM2..."
    sudo npm install -g pm2
    # Setup PM2 to start on boot
    pm2 startup systemd -u orangepi --hp /home/orangepi | tail -1 | sudo bash
  fi
}

# Function to ensure nginx has API proxy configured
ensure_nginx_proxy() {
  if ! grep -q "location /api/" "$NGINX_CONF" 2>/dev/null; then
    echo "Configuring nginx API proxy..."
    
    # Create nginx config with API proxy
    sudo tee "$NGINX_CONF" > /dev/null << 'NGINX_EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm;

    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX_EOF

    # Test and restart nginx
    echo "Testing nginx configuration..."
    sudo nginx -t && sudo systemctl restart nginx
    echo "Nginx API proxy configured and restarted."
  else
    echo "Nginx API proxy already configured."
  fi
}

# Function to verify deployment
verify_deployment() {
  echo ""
  echo "=========================================="
  echo "Verifying deployment..."
  echo "=========================================="
  
  # Check PM2 process
  echo -n "Checking PM2 server status: "
  if pm2 describe "$SERVER_NAME" > /dev/null 2>&1; then
    STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$STATUS" = "online" ]; then
      echo "✓ ONLINE"
    else
      echo "✗ Status: $STATUS"
    fi
  else
    echo "✗ NOT RUNNING"
  fi
  
  # Test direct API (localhost:3001)
  echo -n "Testing API directly (localhost:3001): "
  if curl -s --max-time 5 http://localhost:3001/api/health | grep -q '"status":"ok"'; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  # Test API via nginx proxy (localhost/api)
  echo -n "Testing API via nginx (localhost/api): "
  if curl -s --max-time 5 http://localhost/api/health | grep -q '"status":"ok"'; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  # Test telemetry endpoint
  echo -n "Testing telemetry endpoint: "
  if curl -s --max-time 5 http://localhost/api/telemetry | grep -q '"success":true'; then
    echo "✓ OK"
  else
    echo "✗ FAILED (may be empty database)"
  fi
  
  # Test frontend
  echo -n "Testing frontend (nginx): "
  if curl -s --max-time 5 -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  echo "=========================================="
  echo ""
}

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

  # Ensure nginx proxy is configured
  ensure_nginx_proxy

  # Ensure PM2 is installed
  ensure_pm2

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

  # Wait a moment for server to start
  sleep 2

  # Verify deployment
  verify_deployment

  echo "Deployment complete."
  exit 0
fi

echo "Local repo state unusual (ahead/diverged). Not auto-updating. Fake up"
exit 0
