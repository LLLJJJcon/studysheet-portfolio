#!/bin/bash
set -e

echo "=== Rebuilding server (with dev deps for tsc) ==="
cd /home/ubuntu/studysheet/server

# Install ALL deps (including dev for tsc)
npm ci 2>&1 | tail -3

# Build
npx tsc 2>&1
echo "Server build OK"

# Remove dev deps to save space
npm prune --omit=dev 2>&1 | tail -3
echo "Dev deps pruned"

echo "=== Building client ==="
cd /home/ubuntu/studysheet/client
npm ci 2>&1 | tail -3
npx vite build 2>&1
echo "Client build OK"

echo "=== Verifying ==="
ls -la /home/ubuntu/studysheet/server/dist/index.js
ls -la /home/ubuntu/studysheet/client/dist/index.html
df -h /
