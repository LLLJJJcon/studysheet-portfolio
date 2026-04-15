#!/bin/bash
set -e

JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > /home/ubuntu/studysheet/.env << EOF
MONGODB_URI=mongodb://localhost:27017/studysheet
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://studysheet.sixiyida.me
EOF

echo "=== .env created ==="
cat /home/ubuntu/studysheet/.env

# Copy .env to server directory (where dotenv will pick it up)
cp /home/ubuntu/studysheet/.env /home/ubuntu/studysheet/server/.env

# Install server dependencies
echo "=== Installing server dependencies ==="
cd /home/ubuntu/studysheet/server
npm ci --omit=dev 2>&1 | tail -3

# Build server (TypeScript -> JS)
echo "=== Building server ==="
npm run build 2>&1 | tail -5

# Install client dependencies and build
echo "=== Installing client dependencies ==="
cd /home/ubuntu/studysheet/client
npm ci 2>&1 | tail -3

echo "=== Building client ==="
npm run build 2>&1 | tail -5

echo "=== Build complete ==="
ls -la /home/ubuntu/studysheet/client/dist/ | head -10
ls -la /home/ubuntu/studysheet/server/dist/ | head -10
