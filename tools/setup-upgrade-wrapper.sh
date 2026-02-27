#!/bin/bash
# One-time setup: install run-upgrade wrapper, systemd service, and sudoers
# Run on Orange Pi: sudo ./setup-upgrade-wrapper.sh
# Upgrade runs via systemd (survives API restart). API triggers: systemctl start guidashboard-upgrade

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_SRC="${SCRIPT_DIR}/run-upgrade.sh"
WRAPPER_DEST="/usr/local/bin/run-upgrade"
SERVICE_SRC="${SCRIPT_DIR}/guidashboard-upgrade.service"
SERVICE_DEST="/etc/systemd/system/guidashboard-upgrade.service"
# Two lines: some sudoers versions mishandle comma-separated NOPASSWD
SUDOERS_FILE="/etc/sudoers.d/guidashboard-upgrade"

if [ ! -f "$WRAPPER_SRC" ]; then
  echo "Error: run-upgrade.sh not found at $WRAPPER_SRC"
  exit 1
fi

echo "Installing run-upgrade wrapper to $WRAPPER_DEST..."
cp "$WRAPPER_SRC" "$WRAPPER_DEST"
chmod 755 "$WRAPPER_DEST"
chown root:root "$WRAPPER_DEST"

if [ -f "$SERVICE_SRC" ]; then
  echo "Installing systemd service..."
  cp "$SERVICE_SRC" "$SERVICE_DEST"
  chmod 644 "$SERVICE_DEST"
  systemctl daemon-reload
  echo "Service guidashboard-upgrade installed."
else
  echo "Warning: guidashboard-upgrade.service not found, skipping."
fi

echo "Configuring sudoers for systemctl start guidashboard-upgrade..."
cat > "$SUDOERS_FILE" << 'SUDOERS_EOF'
orangepi ALL=(ALL) NOPASSWD: /usr/bin/systemctl start guidashboard-upgrade
orangepi ALL=(ALL) NOPASSWD: /usr/bin/systemctl start --no-block guidashboard-upgrade
SUDOERS_EOF
chmod 440 "$SUDOERS_FILE"
echo "Sudoers configured."

echo "Done. Upgrade runs via: sudo systemctl start guidashboard-upgrade"
