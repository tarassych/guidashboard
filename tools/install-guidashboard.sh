#!/bin/bash
#
# GUI Dashboard Installer for Orange Pi
# https://github.com/tarassych/guidashboard
#
# This script sets up the complete GUI Dashboard system including:
# - Node.js backend API server
# - MediaMTX streaming server
# - Nginx web server
# - SQLite database (indexes only, preserves existing data)
# - PM2 process manager
#
# Usage: sudo ./install-guidashboard.sh
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

REPO_URL="https://github.com/tarassych/guidashboard.git"
MEDIAMTX_VERSION="v1.9.3"
MEDIAMTX_ARCH="linux_arm64v8"

# Directories
HOME_DIR="/home/orangepi"
REPO_DIR="$HOME_DIR/guidashboard-repo"
SERVER_DIR="$HOME_DIR/guidashboard"
MMTX_DIR="$HOME_DIR/mmtx"
CODE_DIR="$HOME_DIR/code"
WEB_DIR="/var/www/html"

# Database
DB_PATH="$CODE_DIR/telemetry.db"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'

# Tracking for rollback
ROLLBACK_ACTIONS=()
INSTALL_START_TIME=$(date +%s)

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}${BOLD}${WHITE}           GUI Dashboard Installer for Orange Pi              ${NC}${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}${DIM}                    github.com/tarassych/guidashboard           ${NC}${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    local step_num=$1
    local step_name=$2
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}${BOLD}  STEP $step_num:${NC} ${CYAN}$step_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_info() {
    echo -e "  ${DIM}→${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_progress() {
    echo -e "  ${CYAN}◦${NC} $1..."
}

add_rollback() {
    ROLLBACK_ACTIONS+=("$1")
}

execute_rollback() {
    if [ ${#ROLLBACK_ACTIONS[@]} -eq 0 ]; then
        return
    fi
    
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}${BOLD}${WHITE}                    ROLLING BACK CHANGES                       ${NC}${RED}║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Execute rollback actions in reverse order
    for ((i=${#ROLLBACK_ACTIONS[@]}-1; i>=0; i--)); do
        local action="${ROLLBACK_ACTIONS[$i]}"
        print_info "Reverting: $action"
        eval "$action" 2>/dev/null || true
    done
    
    print_warning "Rollback completed. System restored to previous state."
}

fail() {
    print_error "$1"
    execute_rollback
    echo ""
    echo -e "${RED}Installation failed. Please check the errors above.${NC}"
    exit 1
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
        exit 1
    fi
}

check_user_exists() {
    if ! id "orangepi" &>/dev/null; then
        fail "User 'orangepi' does not exist"
    fi
}

run_as_orangepi() {
    sudo -u orangepi bash -c "$1"
}

# =============================================================================
# Installation Steps
# =============================================================================

install_system_packages() {
    print_step 1 "Installing System Packages"
    
    print_progress "Installing nginx, sqlite3, nodejs, npm, sshpass, git"
    
    if ! apt install -y nginx sqlite3 nodejs npm sshpass git > /tmp/apt-install.log 2>&1; then
        cat /tmp/apt-install.log
        fail "Failed to install system packages"
    fi
    
    print_success "System packages installed"
    
    # Check Node.js version
    local node_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ -z "$node_version" ] || [ "$node_version" -lt 18 ]; then
        print_warning "Node.js version is too old (need v18+)"
        print_progress "Installing Node.js 20.x"
        
        if ! curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /tmp/node-setup.log 2>&1; then
            fail "Failed to setup Node.js repository"
        fi
        
        if ! apt install -y nodejs > /tmp/node-install.log 2>&1; then
            fail "Failed to install Node.js"
        fi
        
        print_success "Node.js $(node --version) installed"
    else
        print_success "Node.js v$node_version detected (OK)"
    fi
}

install_pm2() {
    print_step 2 "Installing PM2 Process Manager"
    
    if command -v pm2 &>/dev/null; then
        print_success "PM2 already installed"
    else
        print_progress "Installing PM2 globally"
        
        if ! npm install -g pm2 > /tmp/pm2-install.log 2>&1; then
            cat /tmp/pm2-install.log
            fail "Failed to install PM2"
        fi
        
        add_rollback "npm uninstall -g pm2"
        print_success "PM2 installed"
    fi
    
    # Setup PM2 startup
    print_progress "Configuring PM2 startup"
    sudo -u orangepi bash -c "pm2 startup systemd -u orangepi --hp $HOME_DIR" > /tmp/pm2-startup.log 2>&1 || true
    
    # Extract and run the sudo command from output
    local startup_cmd=$(grep -o "sudo .*" /tmp/pm2-startup.log | head -1)
    if [ -n "$startup_cmd" ]; then
        eval "$startup_cmd" > /dev/null 2>&1 || true
    fi
    
    print_success "PM2 startup configured"
}

create_directories() {
    print_step 3 "Creating Directory Structure"
    
    local dirs=("$CODE_DIR" "$MMTX_DIR" "$SERVER_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            print_progress "Creating $dir"
            mkdir -p "$dir"
            chown orangepi:orangepi "$dir"
            add_rollback "[ -d '$dir' ] && rmdir '$dir' 2>/dev/null"
            print_success "Created $dir"
        else
            print_success "$dir already exists"
        fi
    done
}

clone_repository() {
    print_step 4 "Cloning GUI Dashboard Repository"
    
    if [ -d "$REPO_DIR" ]; then
        print_info "Repository already exists, updating..."
        print_progress "Pulling latest changes"
        
        if ! run_as_orangepi "cd $REPO_DIR && git pull origin main" > /tmp/git-pull.log 2>&1; then
            print_warning "Git pull failed, attempting fresh clone"
            rm -rf "$REPO_DIR"
        else
            print_success "Repository updated"
            return
        fi
    fi
    
    print_progress "Cloning from $REPO_URL"
    
    if ! run_as_orangepi "git clone $REPO_URL $REPO_DIR" > /tmp/git-clone.log 2>&1; then
        cat /tmp/git-clone.log
        fail "Failed to clone repository"
    fi
    
    add_rollback "rm -rf '$REPO_DIR'"
    print_success "Repository cloned to $REPO_DIR"
}

setup_backend() {
    print_step 5 "Setting Up Backend Server"
    
    print_progress "Copying server files"
    
    # Copy server files
    if [ -d "$REPO_DIR/server" ]; then
        cp -r "$REPO_DIR/server/"* "$SERVER_DIR/"
        chown -R orangepi:orangepi "$SERVER_DIR"
        print_success "Server files copied"
    else
        fail "Server directory not found in repository"
    fi
    
    # Create drone-profiles.json if not exists
    if [ ! -f "$SERVER_DIR/drone-profiles.json" ]; then
        print_progress "Creating initial drone-profiles.json"
        echo '{"profiles":{}}' > "$SERVER_DIR/drone-profiles.json"
        chown orangepi:orangepi "$SERVER_DIR/drone-profiles.json"
        print_success "Created drone-profiles.json"
    else
        print_success "drone-profiles.json already exists"
    fi
    
    # Install npm dependencies
    print_progress "Installing npm dependencies"
    
    if ! run_as_orangepi "cd $SERVER_DIR && npm install" > /tmp/npm-install.log 2>&1; then
        cat /tmp/npm-install.log
        fail "Failed to install npm dependencies"
    fi
    
    print_success "Backend dependencies installed"
}

setup_database() {
    print_step 6 "Setting Up SQLite Database"
    
    # Create database file if not exists
    if [ ! -f "$DB_PATH" ]; then
        print_progress "Creating telemetry database"
        touch "$DB_PATH"
        chown orangepi:orangepi "$DB_PATH"
        print_success "Database file created"
    else
        print_success "Database file already exists"
    fi
    
    # Create table if not exists
    print_progress "Ensuring telemetry table exists"
    
    sqlite3 "$DB_PATH" <<'EOSQL'
CREATE TABLE IF NOT EXISTS telemetry (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id  INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    data      TEXT    NOT NULL,
    active    INTEGER NOT NULL DEFAULT 0
);
EOSQL
    
    print_success "Telemetry table ready"
    
    # Create indexes (separate queries - idempotent)
    print_progress "Creating database indexes"
    
    sqlite3 "$DB_PATH" <<'EOSQL'
CREATE INDEX IF NOT EXISTS idx_telemetry_drone_id ON telemetry(drone_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_active ON telemetry(active);
EOSQL
    
    chown orangepi:orangepi "$DB_PATH"*
    print_success "Database indexes created"
    
    # Verify schema
    local tables=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null)
    local indexes=$(sqlite3 "$DB_PATH" ".indexes telemetry" 2>/dev/null | wc -l)
    
    print_info "Tables: $tables"
    print_info "Indexes: $indexes index(es) on telemetry"
}

setup_mediamtx() {
    print_step 7 "Setting Up MediaMTX Streaming Server"
    
    local mmtx_binary="$MMTX_DIR/mediamtx"
    local mmtx_tarball="mediamtx_${MEDIAMTX_VERSION}_${MEDIAMTX_ARCH}.tar.gz"
    local mmtx_url="https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/${mmtx_tarball}"
    
    # Download MediaMTX if not present
    if [ ! -f "$mmtx_binary" ]; then
        print_progress "Downloading MediaMTX $MEDIAMTX_VERSION"
        
        cd "$MMTX_DIR"
        
        if ! wget -q "$mmtx_url" -O "$mmtx_tarball"; then
            fail "Failed to download MediaMTX"
        fi
        
        print_progress "Extracting MediaMTX"
        tar -xzf "$mmtx_tarball"
        rm -f "$mmtx_tarball"
        chmod +x mediamtx
        chown orangepi:orangepi mediamtx
        
        add_rollback "rm -f '$mmtx_binary'"
        print_success "MediaMTX binary installed"
    else
        print_success "MediaMTX binary already exists"
    fi
    
    # Copy configuration files from repository
    print_progress "Copying MediaMTX configuration"
    
    if [ -f "$REPO_DIR/tools/mediamtx/mediamtx.base.yml" ]; then
        cp "$REPO_DIR/tools/mediamtx/mediamtx.base.yml" "$MMTX_DIR/"
        print_success "Copied mediamtx.base.yml"
    else
        fail "mediamtx.base.yml not found in repository"
    fi
    
    if [ -f "$REPO_DIR/tools/mediamtx/rebuild-config.sh" ]; then
        cp "$REPO_DIR/tools/mediamtx/rebuild-config.sh" "$MMTX_DIR/"
        chmod +x "$MMTX_DIR/rebuild-config.sh"
        print_success "Copied rebuild-config.sh"
    else
        fail "rebuild-config.sh not found in repository"
    fi
    
    # Create paths.yml if not exists
    if [ ! -f "$MMTX_DIR/paths.yml" ]; then
        print_progress "Creating initial paths.yml"
        cat > "$MMTX_DIR/paths.yml" << 'EOF'
# Camera stream paths - managed by GUI Dashboard
# Do not edit manually
EOF
        print_success "Created paths.yml"
    else
        print_success "paths.yml already exists"
    fi
    
    # Set ownership
    chown -R orangepi:orangepi "$MMTX_DIR"
    
    # Build configuration
    print_progress "Building MediaMTX configuration"
    run_as_orangepi "cd $MMTX_DIR && ./rebuild-config.sh" > /dev/null 2>&1
    print_success "Configuration built"
    
    # Create systemd service
    print_progress "Creating MediaMTX systemd service"
    
    cat > /etc/systemd/system/mediamtx.service << EOF
[Unit]
Description=MediaMTX RTSP/HLS Server
After=network.target

[Service]
Type=simple
User=orangepi
WorkingDirectory=$MMTX_DIR
ExecStart=$MMTX_DIR/mediamtx $MMTX_DIR/mediamtx.yml
Restart=always
RestartSec=5
StandardOutput=append:$MMTX_DIR/mediamtx.log
StandardError=append:$MMTX_DIR/mediamtx.log

[Install]
WantedBy=multi-user.target
EOF
    
    add_rollback "systemctl disable mediamtx 2>/dev/null; rm -f /etc/systemd/system/mediamtx.service"
    
    systemctl daemon-reload
    systemctl enable mediamtx > /dev/null 2>&1
    
    print_success "MediaMTX service created and enabled"
    
    # Start MediaMTX
    print_progress "Starting MediaMTX"
    
    if systemctl is-active --quiet mediamtx; then
        systemctl restart mediamtx
    else
        systemctl start mediamtx
    fi
    
    sleep 2
    
    if systemctl is-active --quiet mediamtx; then
        print_success "MediaMTX started successfully"
    else
        print_warning "MediaMTX may not have started correctly"
    fi
}

deploy_frontend() {
    print_step 8 "Deploying Frontend"
    
    # Check if dist folder exists in repo
    if [ -d "$REPO_DIR/dist" ]; then
        print_progress "Copying frontend files to web root"
        
        # Backup existing if any
        if [ -d "$WEB_DIR" ] && [ "$(ls -A $WEB_DIR 2>/dev/null)" ]; then
            print_info "Backing up existing web files"
            mkdir -p /tmp/web-backup-$$
            cp -r "$WEB_DIR"/* /tmp/web-backup-$$/ 2>/dev/null || true
            add_rollback "rm -rf '$WEB_DIR'/* && cp -r /tmp/web-backup-$$/* '$WEB_DIR'/"
        fi
        
        # Copy dist files
        mkdir -p "$WEB_DIR"
        cp -r "$REPO_DIR/dist/"* "$WEB_DIR/"
        chown -R www-data:www-data "$WEB_DIR"
        
        print_success "Frontend files deployed"
    else
        print_warning "No dist folder found - frontend needs to be built and deployed separately"
        print_info "Run 'npm run build' on dev machine and copy dist/ to $WEB_DIR"
    fi
}

configure_nginx() {
    print_step 9 "Configuring Nginx"
    
    print_progress "Creating Nginx configuration"
    
    # Backup existing config
    if [ -f /etc/nginx/sites-available/default ]; then
        cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup-$$
        add_rollback "mv /etc/nginx/sites-available/default.backup-$$ /etc/nginx/sites-available/default"
    fi
    
    cat > /etc/nginx/sites-available/default << 'EOF'
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

    # MediaMTX HLS Proxy
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
    
    print_success "Nginx configuration created"
    
    # Test and restart
    print_progress "Testing Nginx configuration"
    
    if ! nginx -t > /tmp/nginx-test.log 2>&1; then
        cat /tmp/nginx-test.log
        fail "Nginx configuration test failed"
    fi
    
    print_success "Nginx configuration valid"
    
    print_progress "Restarting Nginx"
    systemctl restart nginx
    print_success "Nginx restarted"
}

start_backend() {
    print_step 10 "Starting Backend Server"
    
    # Stop existing if running
    run_as_orangepi "pm2 delete guidashboard-api 2>/dev/null" || true
    
    print_progress "Starting backend with PM2"
    
    if ! run_as_orangepi "cd $SERVER_DIR && pm2 start index.js --name guidashboard-api" > /tmp/pm2-start.log 2>&1; then
        cat /tmp/pm2-start.log
        fail "Failed to start backend server"
    fi
    
    add_rollback "sudo -u orangepi pm2 delete guidashboard-api 2>/dev/null"
    
    print_progress "Saving PM2 process list"
    run_as_orangepi "pm2 save" > /dev/null 2>&1
    
    print_success "Backend server started"
    
    # Wait for startup
    sleep 3
}

verify_installation() {
    print_step 11 "Verifying Installation"
    
    local all_ok=true
    
    # Check PM2 process
    print_progress "Checking backend API"
    if run_as_orangepi "pm2 show guidashboard-api" > /dev/null 2>&1; then
        local status=$(run_as_orangepi "pm2 jlist" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ "$status" = "online" ]; then
            print_success "Backend API: running"
        else
            print_error "Backend API: $status"
            all_ok=false
        fi
    else
        print_error "Backend API: not found in PM2"
        all_ok=false
    fi
    
    # Check backend responds
    print_progress "Testing backend API endpoint"
    if curl -s http://localhost:3001/api/profiles > /dev/null 2>&1; then
        print_success "Backend API: responding"
    else
        print_error "Backend API: not responding"
        all_ok=false
    fi
    
    # Check MediaMTX
    print_progress "Checking MediaMTX"
    if systemctl is-active --quiet mediamtx; then
        print_success "MediaMTX: running"
    else
        print_error "MediaMTX: not running"
        all_ok=false
    fi
    
    # Check MediaMTX API
    print_progress "Testing MediaMTX API"
    if curl -s http://localhost:9997/v3/paths/list > /dev/null 2>&1; then
        print_success "MediaMTX API: responding"
    else
        print_warning "MediaMTX API: not responding (may need a moment)"
    fi
    
    # Check Nginx
    print_progress "Checking Nginx"
    if systemctl is-active --quiet nginx; then
        print_success "Nginx: running"
    else
        print_error "Nginx: not running"
        all_ok=false
    fi
    
    # Check web interface
    print_progress "Testing web interface"
    if curl -s http://localhost/ | grep -q "<!DOCTYPE html>" > /dev/null 2>&1; then
        print_success "Web interface: accessible"
    else
        print_warning "Web interface: may need frontend deployment"
    fi
    
    # Check database
    print_progress "Checking database"
    if [ -f "$DB_PATH" ]; then
        local table_exists=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='telemetry';" 2>/dev/null)
        if [ -n "$table_exists" ]; then
            print_success "Database: ready"
        else
            print_error "Database: telemetry table missing"
            all_ok=false
        fi
    else
        print_error "Database: file not found"
        all_ok=false
    fi
    
    if [ "$all_ok" = false ]; then
        fail "Some components failed verification"
    fi
}

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - INSTALL_START_TIME))
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}${BOLD}${WHITE}              INSTALLATION COMPLETED SUCCESSFULLY              ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${WHITE}Duration:${NC} ${duration}s"
    echo ""
    echo -e "  ${CYAN}Services:${NC}"
    echo -e "    • Backend API    → http://localhost:3001"
    echo -e "    • Web Interface  → http://localhost"
    echo -e "    • MediaMTX API   → http://localhost:9997"
    echo -e "    • HLS Streams    → http://localhost:8888"
    echo ""
    echo -e "  ${CYAN}Useful Commands:${NC}"
    echo -e "    ${DIM}pm2 status${NC}                    → Check backend status"
    echo -e "    ${DIM}pm2 logs guidashboard-api${NC}     → View backend logs"
    echo -e "    ${DIM}sudo systemctl status mediamtx${NC} → Check MediaMTX status"
    echo -e "    ${DIM}tail -f $MMTX_DIR/mediamtx.log${NC} → View MediaMTX logs"
    echo ""
    echo -e "  ${CYAN}Directories:${NC}"
    echo -e "    • Repository   : $REPO_DIR"
    echo -e "    • Backend      : $SERVER_DIR"
    echo -e "    • MediaMTX     : $MMTX_DIR"
    echo -e "    • Web Root     : $WEB_DIR"
    echo -e "    • Database     : $DB_PATH"
    echo ""
    
    # Get Orange Pi IP
    local ip=$(hostname -I | awk '{print $1}')
    if [ -n "$ip" ]; then
        echo -e "  ${GREEN}Access the dashboard at:${NC} ${BOLD}http://$ip${NC}"
    fi
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    print_banner
    
    check_root
    check_user_exists
    
    echo -e "  ${WHITE}Starting installation...${NC}"
    echo -e "  ${DIM}This may take a few minutes${NC}"
    
    install_system_packages
    install_pm2
    create_directories
    clone_repository
    setup_backend
    setup_database
    setup_mediamtx
    deploy_frontend
    configure_nginx
    start_backend
    verify_installation
    print_summary
}

# Run main with error handling
trap 'fail "Installation interrupted"' INT TERM

main "$@"

