#!/bin/bash
# Wrapper for guidashboard upgrade - runs deploy script from S3
# Install with: sudo tools/setup-upgrade-wrapper.sh
# Requires: orangepi ALL=(ALL) NOPASSWD: /usr/local/bin/run-upgrade in sudoers

set -e
cd /home/orangepi

curl -fsSL "https://yuri-private.s3.amazonaws.com/_deploy.sh?AWSAccessKeyId=AKIAILTLRNN4SVYR2YOQ&Expires=1801762087&Signature=3c55QGUCo4pPzImwVRWyXzHJhww%3D" -o deploy.sh
chmod +x deploy.sh
./deploy.sh
