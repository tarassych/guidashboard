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
MEDIAMTX_VERSION_NUM="1.9.3"
MEDIAMTX_ARCH="linux_arm64v8"
MIN_NODE_VERSION=20

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
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'

# Tracking for rollback
ROLLBACK_ACTIONS=()
INSTALL_START_TIME=$(date +%s)
TOTAL_STEPS=11
CURRENT_STEP=0

# Spinner characters (ASCII compatible)
SPINNER_CHARS=('-' '\' '|' '/')
SPINNER_PID=""

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    clear
    echo ""
    echo -e "${CYAN}+==================================================================+${NC}"
    echo -e "${CYAN}|${NC}${BOLD}${WHITE}           GUI Dashboard Installer for Orange Pi              ${NC}${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}${DIM}                    github.com/tarassych/guidashboard           ${NC}${CYAN}|${NC}"
    echo -e "${CYAN}+==================================================================+${NC}"
    echo ""
}

# Progress bar (ASCII compatible)
print_progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r  ${GRAY}[${NC}"
    printf "${GREEN}%${filled}s${NC}" | tr ' ' '#'
    printf "${GRAY}%${empty}s${NC}" | tr ' ' '-'
    printf "${GRAY}]${NC} ${WHITE}%3d%%${NC} " "$percent"
}

# Spinner functions
start_spinner() {
    local msg="$1"
    printf "\r  ${CYAN}*${NC} %s " "$msg"
    
    # Start spinner in background
    (
        local chars=('-' '\' '|' '/')
        local i=0
        while true; do
            printf "\r  ${CYAN}%s${NC} %s " "${chars[$i]}" "$msg"
            i=$(( (i + 1) % 4 ))
            sleep 0.15
        done
    ) &
    SPINNER_PID=$!
    disown $SPINNER_PID 2>/dev/null
}

stop_spinner() {
    if [ -n "$SPINNER_PID" ]; then
        kill $SPINNER_PID 2>/dev/null || true
        wait $SPINNER_PID 2>/dev/null || true
        SPINNER_PID=""
    fi
    printf "\r"
}

print_step() {
    local step_num=$1
    local step_name=$2
    CURRENT_STEP=$step_num
    
    stop_spinner
    echo ""
    echo ""
    print_progress_bar $step_num $TOTAL_STEPS
    echo ""
    echo -e "${BLUE}--------------------------------------------------------------------${NC}"
    echo -e "${WHITE}${BOLD}  STEP $step_num/$TOTAL_STEPS:${NC} ${CYAN}$step_name${NC}"
    echo -e "${BLUE}--------------------------------------------------------------------${NC}"
}

print_info() {
    stop_spinner
    echo -e "  ${GRAY}>${NC} $1"
}

print_success() {
    stop_spinner
    echo -e "  ${GREEN}[OK]${NC} $1"
}

print_warning() {
    stop_spinner
    echo -e "  ${YELLOW}[!]${NC} $1"
}

print_error() {
    stop_spinner
    echo -e "  ${RED}[X]${NC} $1"
}

print_detail() {
    echo -e "    ${GRAY}$1${NC}"
}

print_skip() {
    echo -e "  ${CYAN}[-]${NC} $1 ${DIM}(skipped)${NC}"
}

print_installed() {
    echo -e "  ${GREEN}[OK]${NC} $1 ${DIM}(already installed)${NC}"
}

# Run command with live output in a box
run_boxed() {
    local cmd="$1"
    echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
    eval "$cmd" 2>&1 | while IFS= read -r line; do
        echo -e "    ${GRAY}|${NC} ${DIM}$line${NC}"
    done
    local result=${PIPESTATUS[0]}
    echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
    return $result
}

# Download file with progress indicator
download_with_progress() {
    local url="$1"
    local output="$2"
    local desc="${3:-file}"
    
    local dl_start=$(date +%s)
    local logfile="/tmp/wget-$$.log"
    
    # Start download in background
    wget --progress=dot:giga "$url" -O "$output" > "$logfile" 2>&1 &
    local dl_pid=$!
    
    echo -ne "  ${CYAN}>${NC} Downloading $desc"
    
    while kill -0 $dl_pid 2>/dev/null; do
        sleep 1
        local elapsed=$(( $(date +%s) - dl_start ))
        printf "\r  ${CYAN}>${NC} Downloading $desc... [%02ds] " "$elapsed"
        
        # Try to get progress percentage
        local progress=$(grep -oE '[0-9]+%' "$logfile" 2>/dev/null | tail -1)
        if [ -n "$progress" ]; then
            echo -ne "${GREEN}$progress${NC} "
        fi
    done
    
    wait $dl_pid
    local dl_exit=$?
    
    local dl_duration=$(( $(date +%s) - dl_start ))
    echo ""
    
    if [ $dl_exit -eq 0 ]; then
        local filesize=$(ls -lh "$output" 2>/dev/null | awk '{print $5}')
        print_success "Downloaded $desc ($filesize in ${dl_duration}s)"
    else
        print_error "Download failed"
        tail -5 "$logfile" | while IFS= read -r line; do
            echo -e "    ${GRAY}|${NC} $line"
        done
    fi
    
    rm -f "$logfile"
    return $dl_exit
}

# Check if a command exists
cmd_exists() {
    command -v "$1" &>/dev/null
}

# Get version of a command (first number group)
get_version() {
    local cmd="$1"
    local version_flag="${2:---version}"
    $cmd $version_flag 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1
}

# Get major version number
get_major_version() {
    local version="$1"
    echo "$version" | cut -d. -f1
}

# Compare versions: returns 0 if $1 >= $2
version_gte() {
    local v1="$1"
    local v2="$2"
    [ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" = "$v2" ]
}

add_rollback() {
    ROLLBACK_ACTIONS+=("$1")
}

execute_rollback() {
    if [ ${#ROLLBACK_ACTIONS[@]} -eq 0 ]; then
        return
    fi
    
    stop_spinner
    echo ""
    echo -e "${RED}+==================================================================+${NC}"
    echo -e "${RED}|${NC}${BOLD}${WHITE}                    ROLLING BACK CHANGES                       ${NC}${RED}|${NC}"
    echo -e "${RED}+==================================================================+${NC}"
    echo ""
    
    for ((i=${#ROLLBACK_ACTIONS[@]}-1; i>=0; i--)); do
        local action="${ROLLBACK_ACTIONS[$i]}"
        print_info "Reverting: $action"
        eval "$action" 2>/dev/null || true
    done
    
    print_warning "Rollback completed. System restored to previous state."
}

fail() {
    stop_spinner
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
# Package Check Functions
# =============================================================================

check_and_install_package() {
    local pkg_name="$1"
    local check_cmd="${2:-$pkg_name}"
    local install_cmd="${3:-apt install -y $pkg_name}"
    
    if cmd_exists "$check_cmd"; then
        local version=$(get_version "$check_cmd" 2>/dev/null || echo "unknown")
        print_installed "$pkg_name v$version"
        return 0
    else
        start_spinner "Installing $pkg_name"
        if eval "$install_cmd" > /tmp/install-$pkg_name.log 2>&1; then
            stop_spinner
            local version=$(get_version "$check_cmd" 2>/dev/null || echo "installed")
            print_success "$pkg_name v$version installed"
            return 0
        else
            stop_spinner
            print_error "Failed to install $pkg_name"
            cat /tmp/install-$pkg_name.log
            return 1
        fi
    fi
}

# =============================================================================
# Installation Steps
# =============================================================================

install_system_packages() {
    print_step 1 "Checking System Packages"
    
    local packages_to_install=()
    
    # Check each package
    echo ""
    print_info "Checking required packages..."
    echo ""
    
    # nginx
    if cmd_exists nginx; then
        local ver=$(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        print_installed "nginx v$ver"
    else
        packages_to_install+=("nginx")
        print_info "nginx: not found, will install"
    fi
    
    # sqlite3
    if cmd_exists sqlite3; then
        local ver=$(sqlite3 --version | awk '{print $1}')
        print_installed "sqlite3 v$ver"
    else
        packages_to_install+=("sqlite3")
        print_info "sqlite3: not found, will install"
    fi
    
    # git
    if cmd_exists git; then
        local ver=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        print_installed "git v$ver"
    else
        packages_to_install+=("git")
        print_info "git: not found, will install"
    fi
    
    # sshpass
    if cmd_exists sshpass; then
        local ver=$(sshpass -V 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "installed")
        print_installed "sshpass v$ver"
    else
        packages_to_install+=("sshpass")
        print_info "sshpass: not found, will install"
    fi
    
    # curl (needed for nodesetup)
    if cmd_exists curl; then
        local ver=$(curl --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        print_installed "curl v$ver"
    else
        packages_to_install+=("curl")
        print_info "curl: not found, will install"
    fi
    
    # nodejs - check version (MUST be v20+ for better-sqlite3)
    local need_node=false
    if cmd_exists node; then
        local node_ver=$(node --version | sed 's/v//')
        local node_major=$(echo "$node_ver" | cut -d. -f1)
        if [ "$node_major" -ge "$MIN_NODE_VERSION" ]; then
            print_installed "nodejs v$node_ver"
        else
            print_warning "nodejs v$node_ver found (REQUIRES v$MIN_NODE_VERSION+, will upgrade)"
            need_node=true
        fi
    else
        print_info "nodejs: not found, will install v$MIN_NODE_VERSION"
        need_node=true
    fi
    
    # npm version will be updated with node
    if cmd_exists npm; then
        local ver=$(npm --version)
        if [ "$need_node" = true ]; then
            print_info "npm v$ver (will be upgraded with Node.js)"
        else
            print_installed "npm v$ver"
        fi
    else
        print_info "npm: will be installed with Node.js"
    fi
    
    echo ""
    
    # Install missing packages via apt (excluding nodejs - handled separately)
    if [ ${#packages_to_install[@]} -gt 0 ]; then
        print_info "Installing: ${packages_to_install[*]}"
        echo ""
        echo -e "  ${CYAN}>${NC} Running apt install..."
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        apt install -y ${packages_to_install[*]} 2>&1 | while IFS= read -r line; do
            echo -e "    ${GRAY}|${NC} $line"
        done
        local apt_exit=${PIPESTATUS[0]}
        
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        if [ $apt_exit -eq 0 ]; then
            print_success "Packages installed"
        else
            fail "Failed to install packages"
        fi
    else
        print_success "All apt packages already installed"
    fi
    
    # Handle Node.js installation/upgrade (REQUIRED for better-sqlite3)
    if [ "$need_node" = true ]; then
        echo ""
        echo -e "  ${YELLOW}[!]${NC} ${WHITE}Node.js v$MIN_NODE_VERSION+ is REQUIRED for better-sqlite3${NC}"
        print_info "Installing Node.js v20.x from NodeSource..."
        echo ""
        
        echo -e "  ${CYAN}>${NC} Adding NodeSource repository..."
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>&1 | bash - 2>&1 | while IFS= read -r line; do
            echo -e "    ${GRAY}|${NC} $line"
        done
        
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        echo ""
        echo -e "  ${CYAN}>${NC} Installing Node.js v20..."
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        apt install -y nodejs 2>&1 | while IFS= read -r line; do
            echo -e "    ${GRAY}|${NC} $line"
        done
        local node_exit=${PIPESTATUS[0]}
        
        echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
        
        if [ $node_exit -eq 0 ]; then
            local new_ver=$(node --version)
            local new_npm=$(npm --version)
            print_success "Node.js $new_ver installed"
            print_success "npm v$new_npm installed"
        else
            fail "Failed to install Node.js"
        fi
    fi
}

install_pm2() {
    print_step 2 "Checking PM2 Process Manager"
    
    if cmd_exists pm2; then
        local ver=$(pm2 --version 2>/dev/null)
        print_installed "pm2 v$ver"
        
        # Check if update available
        start_spinner "Checking for PM2 updates"
        local latest=$(npm view pm2 version 2>/dev/null || echo "")
        stop_spinner
        
        if [ -n "$latest" ] && [ "$ver" != "$latest" ]; then
            print_info "Update available: v$ver -> v$latest"
            start_spinner "Updating PM2"
            if npm update -g pm2 > /tmp/pm2-update.log 2>&1; then
                stop_spinner
                print_success "PM2 updated to v$(pm2 --version)"
            else
                stop_spinner
                print_warning "PM2 update failed, continuing with v$ver"
            fi
        else
            print_success "PM2 is up to date"
        fi
    else
        print_info "PM2 not found, installing..."
        echo ""
        echo -e "  ${CYAN}>${NC} Installing PM2 globally..."
        
        if ! run_boxed "npm install -g pm2 2>&1 | tail -5"; then
            fail "Failed to install PM2"
        fi
        
        add_rollback "npm uninstall -g pm2"
        print_success "PM2 v$(pm2 --version) installed"
    fi
    
    # Setup PM2 startup
    start_spinner "Configuring PM2 startup service"
    sudo -u orangepi bash -c "pm2 startup systemd -u orangepi --hp $HOME_DIR" > /tmp/pm2-startup.log 2>&1 || true
    
    local startup_cmd=$(grep -o "sudo .*" /tmp/pm2-startup.log | head -1)
    if [ -n "$startup_cmd" ]; then
        eval "$startup_cmd" > /dev/null 2>&1 || true
    fi
    stop_spinner
    print_success "PM2 startup configured"
}

create_directories() {
    print_step 3 "Creating Directory Structure"
    
    local dirs=("$CODE_DIR" "$MMTX_DIR" "$SERVER_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_installed "$dir"
        else
            start_spinner "Creating $dir"
            mkdir -p "$dir"
            chown orangepi:orangepi "$dir"
            add_rollback "[ -d '$dir' ] && [ -z \"\$(ls -A '$dir')\" ] && rmdir '$dir' 2>/dev/null"
            stop_spinner
            print_success "Created $dir"
        fi
    done
}

clone_repository() {
    print_step 4 "Cloning GUI Dashboard Repository"
    
    if [ -d "$REPO_DIR/.git" ]; then
        print_installed "Repository at $REPO_DIR"
        print_info "Pulling latest changes..."
        
        start_spinner "Fetching updates"
        if run_as_orangepi "cd $REPO_DIR && git fetch origin" > /tmp/git-fetch.log 2>&1; then
            stop_spinner
            
            # Check if update needed
            local local_rev=$(run_as_orangepi "cd $REPO_DIR && git rev-parse HEAD")
            local remote_rev=$(run_as_orangepi "cd $REPO_DIR && git rev-parse origin/main")
            
            if [ "$local_rev" = "$remote_rev" ]; then
                print_success "Repository is up to date"
            else
                start_spinner "Pulling changes"
                if run_as_orangepi "cd $REPO_DIR && git pull origin main" > /tmp/git-pull.log 2>&1; then
                    stop_spinner
                    print_success "Repository updated"
                else
                    stop_spinner
                    print_warning "Pull failed, using existing version"
                fi
            fi
        else
            stop_spinner
            print_warning "Fetch failed, using existing version"
        fi
        return
    fi
    
    print_info "Cloning from: $REPO_URL"
    print_info "This may take a minute depending on network speed..."
    echo ""
    
    local clone_start=$(date +%s)
    local logfile="/tmp/git-clone-$$.log"
    
    # Start clone in background
    sudo -u orangepi git clone --progress "$REPO_URL" "$REPO_DIR" > "$logfile" 2>&1 &
    local clone_pid=$!
    
    echo -ne "  ${CYAN}>${NC} Cloning repository"
    
    while kill -0 $clone_pid 2>/dev/null; do
        sleep 1
        local elapsed=$(( $(date +%s) - clone_start ))
        printf "\r  ${CYAN}>${NC} Cloning repository... [%02ds] " "$elapsed"
        
        # Show last line of progress
        local progress=$(tail -1 "$logfile" 2>/dev/null | grep -oE '[0-9]+%' | tail -1)
        if [ -n "$progress" ]; then
            echo -ne "${GREEN}$progress${NC} "
        fi
    done
    
    wait $clone_pid
    local clone_exit=$?
    
    echo ""
    
    if [ $clone_exit -eq 0 ]; then
        local clone_duration=$(( $(date +%s) - clone_start ))
        add_rollback "rm -rf '$REPO_DIR'"
        print_success "Repository cloned (${clone_duration}s)"
    else
        echo -e "  ${RED}Git clone failed:${NC}"
        tail -10 "$logfile" | while IFS= read -r line; do
            echo -e "    ${GRAY}|${NC} $line"
        done
        rm -f "$logfile"
        fail "Failed to clone repository"
    fi
    
    rm -f "$logfile"
}

setup_backend() {
    print_step 5 "Setting Up Backend Server"
    
    # Copy server files
    if [ -d "$REPO_DIR/server" ]; then
        start_spinner "Copying server files to $SERVER_DIR"
        cp -r "$REPO_DIR/server/"* "$SERVER_DIR/"
        chown -R orangepi:orangepi "$SERVER_DIR"
        stop_spinner
        print_success "Server files copied to $SERVER_DIR"
    else
        fail "Server directory not found in repository"
    fi
    
    # Verify package.json exists
    if [ ! -f "$SERVER_DIR/package.json" ]; then
        fail "package.json not found in $SERVER_DIR"
    fi
    print_success "package.json found"
    
    # Create drone-profiles.json if not exists
    if [ -f "$SERVER_DIR/drone-profiles.json" ]; then
        print_installed "drone-profiles.json (preserved)"
    else
        start_spinner "Creating initial drone-profiles.json"
        echo '{"profiles":{}}' > "$SERVER_DIR/drone-profiles.json"
        chown orangepi:orangepi "$SERVER_DIR/drone-profiles.json"
        stop_spinner
        print_success "Created drone-profiles.json"
    fi
    
    # Install npm dependencies with live output
    echo ""
    echo -e "  ${CYAN}>${NC} Running npm install..."
    echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
    
    cd "$SERVER_DIR"
    local npm_exit=0
    
    # Run npm install with live output
    sudo -u orangepi npm install 2>&1 | while IFS= read -r line; do
        echo -e "    ${GRAY}|${NC} $line"
    done
    npm_exit=${PIPESTATUS[0]}
    
    echo -e "    ${GRAY}+----------------------------------------------------------${NC}"
    
    if [ $npm_exit -eq 0 ]; then
        print_success "Dependencies installed"
    else
        # Check if node_modules was created anyway (sometimes npm reports errors but works)
        if [ -d "$SERVER_DIR/node_modules" ] && [ -d "$SERVER_DIR/node_modules/express" ]; then
            print_warning "npm reported warnings but dependencies appear installed"
        else
            fail "Failed to install npm dependencies (exit code: $npm_exit)"
        fi
    fi
}

setup_database() {
    print_step 6 "Setting Up SQLite Database"
    
    # Create database file if not exists
    if [ -f "$DB_PATH" ]; then
        local size=$(du -h "$DB_PATH" | cut -f1)
        print_installed "Database file ($size)"
    else
        start_spinner "Creating telemetry database"
        touch "$DB_PATH"
        chown orangepi:orangepi "$DB_PATH"
        stop_spinner
        print_success "Database file created"
    fi
    
    # Check if database is locked by another process
    print_info "Checking database access..."
    
    local db_locked=false
    if ! sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
        db_locked=true
        print_warning "Database is locked by another process"
        
        # Find what's using it
        local locking_procs=$(lsof "$DB_PATH" 2>/dev/null | tail -n +2 | awk '{print $1, $2}' | sort -u)
        if [ -n "$locking_procs" ]; then
            print_info "Processes using database:"
            echo "$locking_procs" | while read -r proc; do
                print_detail "$proc"
            done
        fi
        
        # Try to stop common culprits
        print_info "Attempting to free database..."
        
        # Stop PM2 managed processes
        if command -v pm2 &>/dev/null; then
            run_as_orangepi "pm2 stop all" > /dev/null 2>&1 || true
            print_detail "Stopped PM2 processes"
        fi
        
        # Wait a moment for locks to release
        sleep 2
        
        # Check again
        if ! sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
            print_warning "Database still locked. Waiting 5 seconds..."
            sleep 5
            
            if ! sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
                print_warning "Database remains locked - skipping schema changes"
                print_detail "Indexes will be created on next restart when DB is free"
                return 0
            fi
        fi
        
        print_success "Database lock released"
    fi
    
    # Check if table exists
    local table_exists=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='telemetry';" 2>/dev/null)
    
    if [ -n "$table_exists" ]; then
        print_installed "telemetry table"
    else
        start_spinner "Creating telemetry table"
        if sqlite3 "$DB_PATH" <<'EOSQL' 2>/dev/null
CREATE TABLE IF NOT EXISTS telemetry (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id  INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    data      TEXT    NOT NULL,
    active    INTEGER NOT NULL DEFAULT 0
);
EOSQL
        then
            stop_spinner
            print_success "Telemetry table created"
        else
            stop_spinner
            print_warning "Could not create table (database may be locked)"
        fi
    fi
    
    # Check and create indexes (always idempotent)
    print_info "Creating/verifying indexes..."
    
    local index_errors=0
    
    if ! sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_telemetry_drone_id ON telemetry(drone_id);" 2>/dev/null; then
        ((index_errors++))
    fi
    
    if ! sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);" 2>/dev/null; then
        ((index_errors++))
    fi
    
    if ! sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_telemetry_active ON telemetry(active);" 2>/dev/null; then
        ((index_errors++))
    fi
    
    chown orangepi:orangepi "$DB_PATH"* 2>/dev/null || true
    
    if [ $index_errors -eq 0 ]; then
        print_success "Database indexes verified"
    else
        print_warning "Some indexes could not be created (database busy)"
        print_detail "They will be created automatically on next run"
    fi
    
    # Show stats
    local row_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM telemetry;" 2>/dev/null || echo "?")
    local index_count=$(sqlite3 "$DB_PATH" ".indexes telemetry" 2>/dev/null | wc -w || echo "?")
    print_detail "Rows: $row_count | Indexes: $index_count"
}

setup_mediamtx() {
    print_step 7 "Setting Up MediaMTX Streaming Server"
    
    local mmtx_binary="$MMTX_DIR/mediamtx"
    local mmtx_tarball="mediamtx_${MEDIAMTX_VERSION}_${MEDIAMTX_ARCH}.tar.gz"
    local mmtx_url="https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/${mmtx_tarball}"
    
    # Check if MediaMTX binary exists and version
    if [ -f "$mmtx_binary" ]; then
        local current_ver=$("$mmtx_binary" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
        
        if [ "$current_ver" = "$MEDIAMTX_VERSION_NUM" ]; then
            print_installed "MediaMTX v$current_ver"
        elif version_gte "$current_ver" "$MEDIAMTX_VERSION_NUM"; then
            print_installed "MediaMTX v$current_ver (newer than required v$MEDIAMTX_VERSION_NUM)"
        else
            print_warning "MediaMTX v$current_ver found (need v$MEDIAMTX_VERSION_NUM)"
            print_info "Upgrading MediaMTX..."
            
            # Backup old binary
            mv "$mmtx_binary" "$mmtx_binary.old"
            
            cd "$MMTX_DIR"
            download_with_progress "$mmtx_url" "$mmtx_tarball" "MediaMTX $MEDIAMTX_VERSION"
            
            if [ ! -f "$mmtx_tarball" ]; then
                mv "$mmtx_binary.old" "$mmtx_binary"
                fail "Failed to download MediaMTX"
            fi
            
            start_spinner "Extracting MediaMTX"
            tar -xzf "$mmtx_tarball"
            rm -f "$mmtx_tarball" "$mmtx_binary.old"
            chmod +x mediamtx
            chown orangepi:orangepi mediamtx
            stop_spinner
            print_success "MediaMTX upgraded to v$MEDIAMTX_VERSION_NUM"
        fi
    else
        print_info "MediaMTX not found, installing v$MEDIAMTX_VERSION_NUM..."
        print_info "Downloading ~15MB binary..."
        echo ""
        
        cd "$MMTX_DIR"
        download_with_progress "$mmtx_url" "$mmtx_tarball" "MediaMTX $MEDIAMTX_VERSION"
        
        if [ ! -f "$mmtx_tarball" ]; then
            fail "Failed to download MediaMTX"
        fi
        
        start_spinner "Extracting MediaMTX"
        tar -xzf "$mmtx_tarball"
        rm -f "$mmtx_tarball"
        chmod +x mediamtx
        chown orangepi:orangepi mediamtx
        stop_spinner
        
        add_rollback "rm -f '$mmtx_binary'"
        print_success "MediaMTX v$MEDIAMTX_VERSION_NUM installed"
    fi
    
    # Copy configuration files from repository
    if [ -f "$REPO_DIR/tools/mediamtx/mediamtx.base.yml" ]; then
        start_spinner "Copying mediamtx.base.yml"
        cp "$REPO_DIR/tools/mediamtx/mediamtx.base.yml" "$MMTX_DIR/"
        stop_spinner
        print_success "mediamtx.base.yml updated"
    else
        fail "mediamtx.base.yml not found in repository"
    fi
    
    if [ -f "$REPO_DIR/tools/mediamtx/rebuild-config.sh" ]; then
        start_spinner "Copying rebuild-config.sh"
        cp "$REPO_DIR/tools/mediamtx/rebuild-config.sh" "$MMTX_DIR/"
        chmod +x "$MMTX_DIR/rebuild-config.sh"
        stop_spinner
        print_success "rebuild-config.sh updated"
    else
        fail "rebuild-config.sh not found in repository"
    fi
    
    # Create paths.yml if not exists
    if [ -f "$MMTX_DIR/paths.yml" ]; then
        print_installed "paths.yml (preserved)"
    else
        start_spinner "Creating initial paths.yml"
        cat > "$MMTX_DIR/paths.yml" << 'EOF'
# Camera stream paths - managed by GUI Dashboard
# Do not edit manually
EOF
        stop_spinner
        print_success "Created paths.yml"
    fi
    
    # Set ownership
    chown -R orangepi:orangepi "$MMTX_DIR"
    
    # Build configuration
    start_spinner "Building MediaMTX configuration"
    run_as_orangepi "cd $MMTX_DIR && ./rebuild-config.sh" > /dev/null 2>&1
    stop_spinner
    print_success "Configuration built (mediamtx.yml)"
    
    # Check if systemd service exists
    if [ -f /etc/systemd/system/mediamtx.service ]; then
        print_installed "MediaMTX systemd service"
    else
        start_spinner "Creating MediaMTX systemd service"
        
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
        stop_spinner
        print_success "MediaMTX service created"
    fi
    
    systemctl daemon-reload
    systemctl enable mediamtx > /dev/null 2>&1
    
    # Start/restart MediaMTX
    if systemctl is-active --quiet mediamtx; then
        start_spinner "Restarting MediaMTX service"
        systemctl restart mediamtx
        sleep 2
        stop_spinner
        print_success "MediaMTX restarted"
    else
        start_spinner "Starting MediaMTX service"
        systemctl start mediamtx
        sleep 2
        stop_spinner
        print_success "MediaMTX started"
    fi
    
    print_detail "Ports: RTSP=8554, HLS=8888, API=9997"
}

deploy_frontend() {
    print_step 8 "Deploying Frontend"
    
    # Check if dist folder exists in repo
    if [ -d "$REPO_DIR/dist" ]; then
        local new_files=$(find "$REPO_DIR/dist" -type f | wc -l)
        
        # Check if already deployed and same
        if [ -d "$WEB_DIR" ] && [ -f "$WEB_DIR/index.html" ]; then
            print_installed "Frontend files in $WEB_DIR"
            print_info "Updating frontend files..."
        fi
        
        # Backup existing
        if [ -d "$WEB_DIR" ] && [ "$(ls -A $WEB_DIR 2>/dev/null)" ]; then
            start_spinner "Backing up existing web files"
            mkdir -p /tmp/web-backup-$$
            cp -r "$WEB_DIR"/* /tmp/web-backup-$$/ 2>/dev/null || true
            add_rollback "rm -rf '$WEB_DIR'/* && cp -r /tmp/web-backup-$$/* '$WEB_DIR'/"
            stop_spinner
            print_success "Backup created"
        fi
        
        # Copy dist files
        start_spinner "Copying frontend files"
        mkdir -p "$WEB_DIR"
        cp -r "$REPO_DIR/dist/"* "$WEB_DIR/"
        chown -R www-data:www-data "$WEB_DIR"
        stop_spinner
        print_success "Frontend deployed ($new_files files)"
    else
        print_warning "No dist/ folder found in repository"
        print_detail "Build on dev machine: npm run build"
        print_detail "Then deploy: scp -r dist/* orangepi@IP:$WEB_DIR/"
    fi
}

configure_nginx() {
    print_step 9 "Configuring Nginx"
    
    local config_file="/etc/nginx/sites-available/default"
    local config_hash=""
    local new_hash=""
    
    # Check if our config is already in place
    if [ -f "$config_file" ]; then
        if grep -q "guidashboard" "$config_file" 2>/dev/null || grep -q "proxy_pass http://127.0.0.1:3001" "$config_file" 2>/dev/null; then
            print_installed "Nginx configuration (API proxy configured)"
            
            # Still restart to apply any changes
            start_spinner "Reloading Nginx"
            nginx -t > /dev/null 2>&1 && systemctl reload nginx
            stop_spinner
            print_success "Nginx reloaded"
            return
        fi
    fi
    
    # Backup existing config
    if [ -f "$config_file" ]; then
        start_spinner "Backing up existing Nginx config"
        cp "$config_file" "${config_file}.backup-$$"
        add_rollback "mv '${config_file}.backup-$$' '$config_file'"
        stop_spinner
        print_success "Config backed up"
    fi
    
    start_spinner "Writing Nginx configuration"
    
    cat > "$config_file" << 'EOF'
# GUI Dashboard Nginx Configuration
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
    
    stop_spinner
    print_success "Configuration written"
    
    # Test and restart
    start_spinner "Testing Nginx configuration"
    
    if ! nginx -t > /tmp/nginx-test.log 2>&1; then
        stop_spinner
        print_error "Nginx configuration invalid"
        cat /tmp/nginx-test.log
        fail "Nginx configuration test failed"
    fi
    stop_spinner
    print_success "Configuration valid"
    
    start_spinner "Restarting Nginx"
    systemctl restart nginx
    stop_spinner
    print_success "Nginx restarted"
}

start_backend() {
    print_step 10 "Starting Backend Server"
    
    # Check if already running
    if run_as_orangepi "pm2 show guidashboard-api" > /dev/null 2>&1; then
        local status=$(run_as_orangepi "pm2 jlist" 2>/dev/null | grep -o '"name":"guidashboard-api"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$status" = "online" ]; then
            print_installed "Backend server (running)"
            
            start_spinner "Restarting to apply updates"
            run_as_orangepi "pm2 restart guidashboard-api" > /dev/null 2>&1
            stop_spinner
            print_success "Backend restarted"
            
            start_spinner "Saving PM2 state"
            run_as_orangepi "pm2 save" > /dev/null 2>&1
            stop_spinner
            print_success "PM2 state saved"
            
            sleep 2
            return
        fi
    fi
    
    # Stop any existing instance
    run_as_orangepi "pm2 delete guidashboard-api 2>/dev/null" || true
    
    print_info "Starting backend with PM2..."
    echo ""
    echo -e "  ${CYAN}>${NC} Launching Node.js server..."
    
    if ! run_boxed "cd $SERVER_DIR && sudo -u orangepi pm2 start index.js --name guidashboard-api 2>&1 | tail -10"; then
        fail "Failed to start backend server"
    fi
    
    add_rollback "sudo -u orangepi pm2 delete guidashboard-api 2>/dev/null"
    
    start_spinner "Saving PM2 process list"
    run_as_orangepi "pm2 save" > /dev/null 2>&1
    stop_spinner
    print_success "Backend started and saved"
    
    sleep 3
}

verify_installation() {
    print_step 11 "Verifying Installation"
    
    local all_ok=true
    local checks_passed=0
    local total_checks=6
    
    # Check PM2 process
    start_spinner "Checking backend API (PM2)"
    sleep 1
    if run_as_orangepi "pm2 show guidashboard-api" > /dev/null 2>&1; then
        local status=$(run_as_orangepi "pm2 jlist" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        stop_spinner
        if [ "$status" = "online" ]; then
            print_success "Backend API: online"
            ((checks_passed++))
        else
            print_error "Backend API: $status"
            all_ok=false
        fi
    else
        stop_spinner
        print_error "Backend API: not found"
        all_ok=false
    fi
    
    # Check backend responds
    start_spinner "Testing API endpoint"
    sleep 1
    if curl -s --max-time 5 http://localhost:3001/api/profiles > /dev/null 2>&1; then
        stop_spinner
        print_success "API responding at :3001"
        ((checks_passed++))
    else
        stop_spinner
        print_error "API not responding"
        all_ok=false
    fi
    
    # Check MediaMTX
    start_spinner "Checking MediaMTX service"
    if systemctl is-active --quiet mediamtx; then
        stop_spinner
        print_success "MediaMTX: running"
        ((checks_passed++))
    else
        stop_spinner
        print_error "MediaMTX: not running"
        all_ok=false
    fi
    
    # Check MediaMTX API
    start_spinner "Testing MediaMTX API"
    if curl -s --max-time 5 http://localhost:9997/v3/paths/list > /dev/null 2>&1; then
        stop_spinner
        print_success "MediaMTX API responding at :9997"
        ((checks_passed++))
    else
        stop_spinner
        print_warning "MediaMTX API: starting up..."
    fi
    
    # Check Nginx
    start_spinner "Checking Nginx"
    if systemctl is-active --quiet nginx; then
        stop_spinner
        print_success "Nginx: running"
        ((checks_passed++))
    else
        stop_spinner
        print_error "Nginx: not running"
        all_ok=false
    fi
    
    # Check web interface
    start_spinner "Testing web interface"
    if curl -s --max-time 5 http://localhost/ | grep -q "html" > /dev/null 2>&1; then
        stop_spinner
        print_success "Web interface: accessible"
        ((checks_passed++))
    else
        stop_spinner
        print_warning "Web interface: needs frontend deployment"
    fi
    
    echo ""
    print_info "Checks passed: $checks_passed/$total_checks"
    
    if [ "$all_ok" = false ]; then
        fail "Some critical components failed verification"
    fi
}

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - INSTALL_START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    stop_spinner
    echo ""
    echo ""
    print_progress_bar $TOTAL_STEPS $TOTAL_STEPS
    echo ""
    echo ""
    echo -e "${GREEN}+==================================================================+${NC}"
    echo -e "${GREEN}|${NC}${BOLD}${WHITE}              INSTALLATION COMPLETED SUCCESSFULLY              ${NC}${GREEN}|${NC}"
    echo -e "${GREEN}+==================================================================+${NC}"
    echo ""
    echo -e "  ${WHITE}Duration:${NC} ${minutes}m ${seconds}s"
    echo ""
    echo -e "  ${CYAN}Services:${NC}"
    echo -e "    ${GREEN}*${NC} Backend API    : http://localhost:3001"
    echo -e "    ${GREEN}*${NC} Web Interface  : http://localhost"
    echo -e "    ${GREEN}*${NC} MediaMTX API   : http://localhost:9997"
    echo -e "    ${GREEN}*${NC} HLS Streams    : http://localhost:8888"
    echo ""
    echo -e "  ${CYAN}Quick Commands:${NC}"
    echo -e "    ${DIM}pm2 status${NC}                     - Backend status"
    echo -e "    ${DIM}pm2 logs guidashboard-api${NC}      - Backend logs"
    echo -e "    ${DIM}sudo systemctl status mediamtx${NC} - MediaMTX status"
    echo ""
    
    # Get Orange Pi IP
    local ip=$(hostname -I | awk '{print $1}')
    if [ -n "$ip" ]; then
        echo -e "  ${GREEN}------------------------------------------------------------${NC}"
        echo -e "  ${WHITE}${BOLD}Access dashboard at:${NC} ${CYAN}http://$ip${NC}"
        echo -e "  ${GREEN}------------------------------------------------------------${NC}"
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
    echo -e "  ${DIM}Checking existing packages and installing only what's needed${NC}"
    echo ""
    
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
trap 'stop_spinner; fail "Installation interrupted"' INT TERM

main "$@"
