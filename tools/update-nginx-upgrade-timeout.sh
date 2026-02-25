#!/bin/bash
# Update nginx to allow long-running upgrade API (15 min timeout)
# Run on Orange Pi: sudo ./update-nginx-upgrade-timeout.sh
# Required for slow network downloads during upgrade
# Ensures proxy_read_timeout and proxy_send_timeout are set in the /api/ block specifically.

NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-enabled/default}"

if [ ! -f "$NGINX_CONF" ]; then
  echo "Error: Nginx config not found at $NGINX_CONF"
  exit 1
fi

# Extract only the /api/ location block and check if it has our timeout settings
api_block=$(awk '/location[[:space:]]+\/api\//,/^[[:space:]]*}/' "$NGINX_CONF" 2>/dev/null)
if [ -z "$api_block" ]; then
  echo "Error: No 'location /api/' block found in $NGINX_CONF"
  exit 1
fi
if echo "$api_block" | grep -q "proxy_read_timeout 900" && echo "$api_block" | grep -q "proxy_send_timeout 900"; then
  echo "The /api/ location block already has the required timeout settings (900s)."
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
  exit 0
fi

echo "Adding proxy_read_timeout 900 and proxy_send_timeout 900 to the /api/ location block..."

# Add before the closing } of the /api/ block (use brace counter to find the right })
awk '
  /location[[:space:]]+\/api\// { in_api=1; brace=0 }
  in_api {
    n = gsub(/{/, "&"); brace += n
    n = gsub(/}/, "&"); brace -= n
  }
  in_api && brace == 0 && /}/ && !added {
    print "        proxy_read_timeout 900;"
    print "        proxy_send_timeout 900;"
    added=1
  }
  { print }
  in_api && brace == 0 && /}/ { in_api=0 }
' "$NGINX_CONF" > "$NGINX_CONF.tmp" && mv "$NGINX_CONF.tmp" "$NGINX_CONF"

if nginx -t 2>/dev/null; then
  systemctl reload nginx && echo "Nginx updated and reloaded. The /api/ block now has 15-minute timeouts."
else
  echo "Auto-patch failed. Manually add to the 'location /api/' block:"
  echo "  proxy_read_timeout 900;"
  echo "  proxy_send_timeout 900;"
  echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
  exit 1
fi
