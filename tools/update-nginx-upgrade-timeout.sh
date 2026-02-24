#!/bin/bash
# Update nginx to allow long-running upgrade API (15 min timeout)
# Run on Orange Pi: sudo ./update-nginx-upgrade-timeout.sh
# Required for slow network downloads during upgrade

NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-enabled/default}"

if [ ! -f "$NGINX_CONF" ]; then
  echo "Error: Nginx config not found at $NGINX_CONF"
  exit 1
fi

if grep -q "proxy_read_timeout" "$NGINX_CONF" 2>/dev/null; then
  echo "Nginx already has proxy timeout configured."
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
  exit 0
fi

echo "Adding proxy_read_timeout and proxy_send_timeout (900s) to /api/ location..."
# Add after proxy_set_header X-Forwarded-For in location /api/ block
sed -i '/location \/api\//,/}/{
  /proxy_set_header X-Forwarded-For.*proxy_add_x_forwarded_for/a\
        proxy_read_timeout 900;\
        proxy_send_timeout 900;
}' "$NGINX_CONF"

if nginx -t 2>/dev/null; then
  systemctl reload nginx && echo "Nginx updated and reloaded."
else
  echo "Auto-patch failed. Manually add to the 'location /api/' block:"
  echo "  proxy_read_timeout 900;"
  echo "  proxy_send_timeout 900;"
  echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
fi
