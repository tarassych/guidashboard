#!/bin/bash
# One-time setup: install run-upgrade wrapper and configure sudoers for passwordless upgrade
# Run on Orange Pi: sudo ./setup-upgrade-wrapper.sh
# Must be run from repo root (or pass path to run-upgrade.sh)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_SRC="${SCRIPT_DIR}/run-upgrade.sh"
WRAPPER_DEST="/usr/local/bin/run-upgrade"
SUDOERS_ENTRY="orangepi ALL=(ALL) NOPASSWD: /usr/local/bin/run-upgrade"

if [ ! -f "$WRAPPER_SRC" ]; then
  echo "Error: run-upgrade.sh not found at $WRAPPER_SRC"
  exit 1
fi

echo "Installing run-upgrade wrapper to $WRAPPER_DEST..."
cp "$WRAPPER_SRC" "$WRAPPER_DEST"
chmod 755 "$WRAPPER_DEST"
chown root:root "$WRAPPER_DEST"

if grep -q "NOPASSWD: /usr/local/bin/run-upgrade" /etc/sudoers 2>/dev/null || \
   grep -q "NOPASSWD: /usr/local/bin/run-upgrade" /etc/sudoers.d/* 2>/dev/null; then
  echo "Sudoers entry already exists."
else
  echo "Adding sudoers entry for passwordless upgrade..."
  echo "$SUDOERS_ENTRY" | tee /etc/sudoers.d/guidashboard-upgrade > /dev/null
  chmod 440 /etc/sudoers.d/guidashboard-upgrade
  echo "Sudoers configured."
fi

echo "Done. Upgrade can now be run without password via: sudo /usr/local/bin/run-upgrade"
