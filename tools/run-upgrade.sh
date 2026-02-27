#!/bin/bash
# Wrapper for guidashboard upgrade - runs deploy script from S3, then guidashboard install from GitHub
# Install with: sudo tools/setup-upgrade-wrapper.sh
# Requires: orangepi ALL=(ALL) NOPASSWD: /usr/local/bin/run-upgrade in sudoers

set -e
export TERM=dumb
cd /home/orangepi

# 1. Run deploy script (code.zip, system services)
echo "=== Running deploy script (code.zip) ==="
curl -fsSL "https://yuri-private.s3.amazonaws.com/_deploy.sh?AWSAccessKeyId=AKIAILTLRNN4SVYR2YOQ&Expires=1801762087&Signature=3c55QGUCo4pPzImwVRWyXzHJhww%3D" -o deploy.sh
chmod +x deploy.sh
./deploy.sh

# 2. Explicitly run guidashboard install (git pull, build, deploy) - ensures web app is updated
echo "=== Running guidashboard install ==="
cd /home/orangepi/code
if [ -f /home/orangepi/guidashboard-repo/tools/install-guidashboard.sh ]; then
  cp /home/orangepi/guidashboard-repo/tools/install-guidashboard.sh ./
else
  curl -fsSL "https://raw.githubusercontent.com/tarassych/guidashboard/main/tools/install-guidashboard.sh?$(date +%s)" -o install-guidashboard.sh
fi
chmod +x install-guidashboard.sh
./install-guidashboard.sh -y
code=$?
rm -f install-guidashboard.sh
if [ $code -eq 0 ]; then
  echo "=== Running setup-upgrade-wrapper and nginx timeout ==="
  cd /home/orangepi/guidashboard-repo/tools
  ./setup-upgrade-wrapper.sh
  ./update-nginx-upgrade-timeout.sh
fi

echo "COMPLETE!"
