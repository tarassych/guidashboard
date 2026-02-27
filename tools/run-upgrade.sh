#!/bin/bash
# Wrapper for guidashboard upgrade - runs deploy script from S3 (code.zip + install)
# Install with: sudo tools/setup-upgrade-wrapper.sh
# Requires: orangepi ALL=(ALL) NOPASSWD: /usr/local/bin/run-upgrade in sudoers
#
# deploy.sh handles code.zip + install-guidashboard + setup-upgrade-wrapper.

set -e
export TERM=dumb
cd /home/orangepi

log_time() { echo "[$(date '+%H:%M:%S')] $1"; }

# 1. Run deploy script (code.zip, install-guidashboard - deploy does both)
log_time "Starting deploy script (code.zip + install)"
curl -fsSL "https://yuri-private.s3.amazonaws.com/_deploy.sh?AWSAccessKeyId=AKIAILTLRNN4SVYR2YOQ&Expires=1801762087&Signature=3c55QGUCo4pPzImwVRWyXzHJhww%3D" -o deploy.sh
chmod +x deploy.sh
./deploy.sh
log_time "Deploy script finished"

# deploy.sh already runs setup-upgrade-wrapper and update-nginx-upgrade-timeout (via install)

log_time "Upgrade complete"
