#!/bin/bash
set -e

echo "=== Building client ==="
cd /home/ubuntu/studysheet/client
npx vite build 2>&1
echo "Client build OK"

echo "=== Verifying ==="
ls -la /home/ubuntu/studysheet/client/dist/index.html
df -h /
