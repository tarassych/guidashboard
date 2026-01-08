#!/bin/bash
# Rebuild mediamtx.yml from base and paths configs
cd /home/orangepi/mmtx
cat mediamtx.base.yml paths.yml > mediamtx.yml
echo "Config rebuilt: mediamtx.yml"


