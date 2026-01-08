#!/bin/bash
#
# GUI Dashboard Status Check
# Checks if all services are running
#
# Usage: ./status.sh
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

echo ""
echo -e "${CYAN}+------------------------------------------+${NC}"
echo -e "${CYAN}|${NC}${WHITE}     GUI Dashboard Status Check          ${NC}${CYAN}|${NC}"
echo -e "${CYAN}+------------------------------------------+${NC}"
echo ""

all_ok=true

# 1. Check Nginx
echo -ne "  Nginx:          "
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# 2. Check MediaMTX
echo -ne "  MediaMTX:       "
if systemctl is-active --quiet mediamtx 2>/dev/null; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# 3. Check PM2 Backend
echo -ne "  Backend (PM2):  "
if sudo -u orangepi pm2 list 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}stopped${NC}"
    all_ok=false
fi

# 4. Check API responds
echo -ne "  API Endpoint:   "
if curl -s --max-time 3 http://localhost:3001/api/profiles 2>/dev/null | grep -q "success"; then
    echo -e "${GREEN}responding${NC}"
else
    echo -e "${RED}not responding${NC}"
    all_ok=false
fi

# 5. Check Web interface
echo -ne "  Web Interface:  "
if curl -s --max-time 3 http://localhost/ 2>/dev/null | grep -q "html"; then
    echo -e "${GREEN}accessible${NC}"
else
    echo -e "${YELLOW}not accessible${NC}"
fi

# 6. Check Database
echo -ne "  Database:       "
if [ -f "$DB_PATH" ]; then
    size=$(du -h "$DB_PATH" 2>/dev/null | cut -f1)
    echo -e "${GREEN}exists ($size)${NC}"
else
    echo -e "${RED}not found${NC}"
    all_ok=false
fi

# 7. Check ports
echo ""
echo -e "  ${WHITE}Ports:${NC}"
echo -ne "    Port 80 (HTTP):   "
if ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo -e "${GREEN}listening${NC}"
else
    echo -e "${RED}not listening${NC}"
fi

echo -ne "    Port 3001 (API):  "
if ss -tlnp 2>/dev/null | grep -q ":3001 "; then
    echo -e "${GREEN}listening${NC}"
else
    echo -e "${RED}not listening${NC}"
fi

echo -ne "    Port 8554 (RTSP): "
if ss -tlnp 2>/dev/null | grep -q ":8554 "; then
    echo -e "${GREEN}listening${NC}"
else
    echo -e "${YELLOW}not listening${NC}"
fi

echo -ne "    Port 8888 (HLS):  "
if ss -tlnp 2>/dev/null | grep -q ":8888 "; then
    echo -e "${GREEN}listening${NC}"
else
    echo -e "${YELLOW}not listening${NC}"
fi

echo ""
echo -e "${CYAN}+------------------------------------------+${NC}"

if [ "$all_ok" = true ]; then
    echo -e "  ${GREEN}All services OK${NC}"
else
    echo -e "  ${RED}Some services have issues${NC}"
fi

echo -e "${CYAN}+------------------------------------------+${NC}"
echo ""

# Get IP
ip=$(hostname -I | awk '{print $1}')
if [ -n "$ip" ]; then
    echo -e "  Dashboard: ${CYAN}http://$ip${NC}"
    echo ""
fi


