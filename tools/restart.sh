#!/bin/bash
#
# GUI Dashboard Restart Script
# Restarts all services and verifies they're running
#
# Usage: sudo ./restart.sh
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Paths
DB_PATH="/home/orangepi/code/telemetry.db"
MMTX_DIR="/home/orangepi/mmtx"
SERVER_DIR="/home/orangepi/guidashboard"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./restart.sh)${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}+------------------------------------------+${NC}"
echo -e "${CYAN}|${NC}${WHITE}     GUI Dashboard Restart               ${NC}${CYAN}|${NC}"
echo -e "${CYAN}+------------------------------------------+${NC}"
echo ""

# 1. Restart Nginx
echo -ne "  Restarting Nginx...        "
systemctl restart nginx 2>/dev/null
sleep 1
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# 2. Restart MediaMTX
echo -ne "  Restarting MediaMTX...     "
systemctl restart mediamtx 2>/dev/null
sleep 2
if systemctl is-active --quiet mediamtx; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# 3. Restart Backend (PM2)
echo -ne "  Restarting Backend...      "
sudo -u orangepi pm2 restart guidashboard-api > /dev/null 2>&1
sleep 2
if sudo -u orangepi pm2 list 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}OK${NC}"
else
    # Try starting if not found
    echo -ne "${YELLOW}starting...${NC} "
    cd "$SERVER_DIR"
    sudo -u orangepi pm2 start index.js --name guidashboard-api > /dev/null 2>&1
    sudo -u orangepi pm2 save > /dev/null 2>&1
    sleep 2
    if sudo -u orangepi pm2 list 2>/dev/null | grep -q "online"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
fi

echo ""
echo -e "  ${WHITE}Verifying services...${NC}"
echo ""

# Wait a moment for services to fully start
sleep 2

all_ok=true

# Check Nginx
echo -ne "  Nginx:          "
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# Check MediaMTX
echo -ne "  MediaMTX:       "
if systemctl is-active --quiet mediamtx 2>/dev/null; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# Check PM2 Backend
echo -ne "  Backend (PM2):  "
if sudo -u orangepi pm2 list 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# Check API responds
echo -ne "  API Endpoint:   "
if curl -s --max-time 5 http://localhost:3001/api/profiles 2>/dev/null | grep -q "success"; then
    echo -e "${GREEN}responding${NC}"
else
    echo -e "${RED}not responding${NC}"
    all_ok=false
fi

# Check Web interface
echo -ne "  Web Interface:  "
if curl -s --max-time 3 http://localhost/ 2>/dev/null | grep -q "html"; then
    echo -e "${GREEN}accessible${NC}"
else
    echo -e "${YELLOW}not accessible${NC}"
fi

echo ""
echo -e "${CYAN}+------------------------------------------+${NC}"

if [ "$all_ok" = true ]; then
    echo -e "  ${GREEN}All services restarted successfully${NC}"
else
    echo -e "  ${RED}Some services failed to restart${NC}"
    echo ""
    echo -e "  ${YELLOW}Troubleshooting:${NC}"
    echo -e "    sudo systemctl status nginx"
    echo -e "    sudo systemctl status mediamtx"
    echo -e "    sudo -u orangepi pm2 logs guidashboard-api"
fi

echo -e "${CYAN}+------------------------------------------+${NC}"
echo ""

# Get IP
ip=$(hostname -I | awk '{print $1}')
if [ -n "$ip" ]; then
    echo -e "  Dashboard: ${CYAN}http://$ip${NC}"
    echo ""
fi


