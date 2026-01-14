# Orange Pi Setup Guide for GUI Dashboard

This guide covers setting up a brand new Orange Pi device with the complete GUI Dashboard system including MediaMTX streaming server.

## Prerequisites

- Orange Pi device with Ubuntu/Armbian installed
- Network connectivity (Ethernet or WiFi configured)
- SSH access enabled
- User: `orangepi` with sudo privileges

---

## 1. Install Required System Packages

```bash
sudo apt install -y \
  nginx \
  sqlite3 \
  nodejs \
  npm \
  sshpass \
  git
```

### Verify Node.js Version

Ensure Node.js is v18+ for ES module support:

```bash
node --version
```

If version is too old, install newer version:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Install PM2 Process Manager

```bash
sudo npm install -g pm2
```

Configure PM2 to start on boot:

```bash
pm2 startup
# Follow the command it outputs (copy/paste and run it)
```

---

## 3. Create Directory Structure

```bash
mkdir -p /home/orangepi/code
mkdir -p /home/orangepi/mmtx
mkdir -p /home/orangepi/guidashboard
```

---

## 4. Clone the GUI Dashboard Repository

```bash
cd /home/orangepi
git clone https://github.com/tarassych/guidashboard.git guidashboard-repo
```

---

## 5. Setup Backend Server

```bash
# Copy server files
cp -r /home/orangepi/guidashboard-repo/server/* /home/orangepi/guidashboard/

# Install dependencies
cd /home/orangepi/guidashboard
npm install
```

### Create Server Configuration

Edit `/home/orangepi/guidashboard/config.js` if needed to match your paths:

```javascript
export const config = {
  port: 3001,
  dbPath: '/home/orangepi/code/telemetry.db',
  profilesPath: '/home/orangepi/guidashboard/drone-profiles.json',
  mmtxDir: '/home/orangepi/mmtx',
  codeDir: '/home/orangepi/code'
};
```

### Create Initial Drone Profiles File

```bash
echo '{"profiles":{}}' > /home/orangepi/guidashboard/drone-profiles.json
```

---

## 6. Setup SQLite Database

### Create the Telemetry Database

```bash
sqlite3 /home/orangepi/code/telemetry.db <<'EOF'
CREATE TABLE IF NOT EXISTS telemetry (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id  INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    data      TEXT    NOT NULL,
    active    INTEGER NOT NULL DEFAULT 0
);
EOF
```

### Create Indexes (separate queries - runs even if table already exists)

```bash
sqlite3 /home/orangepi/code/telemetry.db <<'EOF'
CREATE INDEX IF NOT EXISTS idx_telemetry_drone_id ON telemetry(drone_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_active ON telemetry(active);
EOF
```

### Verify Database Schema

```bash
sqlite3 /home/orangepi/code/telemetry.db '.schema'
```

Expected output:
```sql
CREATE TABLE telemetry (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id  INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    data      TEXT    NOT NULL,
    active    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_telemetry_drone_id ON telemetry(drone_id);
CREATE INDEX idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX idx_telemetry_active ON telemetry(active);
```

---

## 7. Setup MediaMTX Streaming Server

### Download MediaMTX

```bash
cd /home/orangepi/mmtx

# Download latest MediaMTX for ARM64
wget https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_arm64v8.tar.gz
tar -xzf mediamtx_v1.9.3_linux_arm64v8.tar.gz
rm mediamtx_v1.9.3_linux_arm64v8.tar.gz
chmod +x mediamtx
```

### Copy MediaMTX Configuration Files from Repository

```bash
cp /home/orangepi/guidashboard-repo/tools/mediamtx/mediamtx.base.yml /home/orangepi/mmtx/
cp /home/orangepi/guidashboard-repo/tools/mediamtx/rebuild-config.sh /home/orangepi/mmtx/
chmod +x /home/orangepi/mmtx/rebuild-config.sh
```

### Create Initial paths.yml

```bash
cat > /home/orangepi/mmtx/paths.yml << 'EOF'
# Camera stream paths - managed by GUI Dashboard
# Do not edit manually
EOF
```

### Build Initial Configuration

```bash
cd /home/orangepi/mmtx
./rebuild-config.sh
```

### Create MediaMTX Systemd Service

```bash
sudo tee /etc/systemd/system/mediamtx.service << 'EOF'
[Unit]
Description=MediaMTX RTSP/WebRTC Server
After=network.target

[Service]
Type=simple
User=orangepi
WorkingDirectory=/home/orangepi/mmtx
ExecStart=/home/orangepi/mmtx/mediamtx /home/orangepi/mmtx/mediamtx.yml
Restart=always
RestartSec=5
StandardOutput=append:/home/orangepi/mmtx/mediamtx.log
StandardError=append:/home/orangepi/mmtx/mediamtx.log

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and Start MediaMTX Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
```

### Verify MediaMTX is Running

```bash
sudo systemctl status mediamtx
curl http://localhost:9997/v3/paths/list
```

---

## 8. Deploy Frontend

### Build Frontend (on development machine)

On your development machine:

```bash
cd /path/to/guidashboard
npm run build
```

### Copy Built Files to Orange Pi

```bash
scp -r dist/* orangepi@<ORANGE_PI_IP>:/tmp/guidashboard-dist/
ssh orangepi@<ORANGE_PI_IP> "sudo cp -r /tmp/guidashboard-dist/* /var/www/html/"
```

### Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # MediaMTX HLS Proxy (legacy)
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # MediaMTX WebRTC WHEP Proxy
    location /webrtc/ {
        proxy_pass http://127.0.0.1:8889/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF
```

### Restart Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 9. Start Backend Server with PM2

```bash
cd /home/orangepi/guidashboard
pm2 start index.js --name guidashboard-api
pm2 save
```

### Verify Backend is Running

```bash
pm2 status
curl http://localhost:3001/api/profiles
```

---

## 10. Setup Discovery Scripts (Optional)

If you have slave Orange Pi devices for drone discovery:

```bash
# Create discover.sh
cat > /home/orangepi/code/discover.sh << 'EOF'
#!/bin/bash
sshpass -p 'orangepi' ssh orangepi@10.8.0.9 "
  cd /home/orangepi/code
  ./discover.sh
"
EOF
chmod +x /home/orangepi/code/discover.sh

# Create pair.sh
cat > /home/orangepi/code/pair.sh << 'EOF'
#!/bin/bash
slave_ip=$1
drone_id=$2
sshpass -p 'orangepi' ssh orangepi@10.8.0.9 "
  cd /home/orangepi/code
  ./pair.sh $slave_ip $drone_id
"
EOF
chmod +x /home/orangepi/code/pair.sh
```

---

## 11. Firewall Configuration (if enabled)

```bash
sudo ufw allow 80/tcp      # Nginx HTTP
sudo ufw allow 3001/tcp    # Backend API (optional, if direct access needed)
sudo ufw allow 8554/tcp    # RTSP
sudo ufw allow 8888/tcp    # HLS (legacy)
sudo ufw allow 8889/tcp    # WebRTC
sudo ufw allow 9997/tcp    # MediaMTX API
```

---

## Service Management Commands

### Backend API (PM2)

```bash
pm2 status                    # Check status
pm2 logs guidashboard-api     # View logs
pm2 restart guidashboard-api  # Restart
pm2 stop guidashboard-api     # Stop
```

### MediaMTX (Systemd)

```bash
sudo systemctl status mediamtx   # Check status
sudo systemctl restart mediamtx  # Restart
sudo systemctl stop mediamtx     # Stop
journalctl -u mediamtx -f        # View logs
```

### Nginx

```bash
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t                    # Test configuration
```

---

## Updating the Application

### Update Backend

```bash
cd /home/orangepi/guidashboard-repo
git pull origin main

# Copy updated server files
cp -r server/* /home/orangepi/guidashboard/

# Copy updated MediaMTX tools
cp tools/mediamtx/* /home/orangepi/mmtx/

# Restart services
pm2 restart guidashboard-api
sudo systemctl restart mediamtx
```

### Update Frontend

On development machine, build and deploy:

```bash
npm run build
scp -r dist/* orangepi@<ORANGE_PI_IP>:/tmp/guidashboard-dist/
ssh orangepi@<ORANGE_PI_IP> "sudo cp -r /tmp/guidashboard-dist/* /var/www/html/"
```

---

## Troubleshooting

### Check All Services

```bash
pm2 status
sudo systemctl status mediamtx
sudo systemctl status nginx
```

### View Logs

```bash
# Backend API logs
pm2 logs guidashboard-api --lines 100

# MediaMTX logs
tail -f /home/orangepi/mmtx/mediamtx.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Database Issues

```bash
# Check database exists and has data
sqlite3 /home/orangepi/code/telemetry.db "SELECT COUNT(*) FROM telemetry;"

# Check indexes exist
sqlite3 /home/orangepi/code/telemetry.db ".indexes telemetry"
```

### MediaMTX Not Starting

```bash
# Check for port conflicts
sudo lsof -i :8554
sudo lsof -i :8888
sudo lsof -i :9997

# Test config file
/home/orangepi/mmtx/mediamtx /home/orangepi/mmtx/mediamtx.yml
```

---

## Port Reference

| Port | Service | Description |
|------|---------|-------------|
| 80   | Nginx   | Frontend + API proxy |
| 3001 | Node.js | Backend API |
| 8554 | MediaMTX | RTSP streams |
| 8888 | MediaMTX | HLS streams (legacy) |
| 8889 | MediaMTX | WebRTC streams (primary) |
| 9997 | MediaMTX | Control API |

---

## Directory Structure Reference

```
/home/orangepi/
├── guidashboard/           # Backend server
│   ├── index.js
│   ├── config.js
│   ├── lib/
│   ├── routes/
│   ├── drone-profiles.json
│   └── node_modules/
├── guidashboard-repo/      # Git repository clone
│   ├── server/
│   ├── src/
│   ├── tools/
│   │   └── mediamtx/
│   │       ├── mediamtx.base.yml
│   │       └── rebuild-config.sh
│   └── ...
├── mmtx/                   # MediaMTX installation
│   ├── mediamtx            # Binary
│   ├── mediamtx.yml        # Combined config (generated)
│   ├── mediamtx.base.yml   # Base config
│   ├── paths.yml           # Camera paths (managed by app)
│   ├── rebuild-config.sh
│   └── mediamtx.log
├── code/                   # Scripts and database
│   ├── telemetry.db
│   ├── discover.sh
│   ├── pair.sh
│   └── scan_cam.sh
└── ...

/var/www/html/              # Frontend static files
├── index.html
├── assets/
└── ...
```


