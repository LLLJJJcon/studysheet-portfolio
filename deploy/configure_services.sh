#!/bin/bash
set -e

# 1. Create systemd service for the backend
echo "=== Creating systemd service ==="
sudo tee /etc/systemd/system/studysheet.service > /dev/null << 'EOF'
[Unit]
Description=StudySheet Backend Server
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/studysheet/server
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/home/ubuntu/studysheet/server/.env

[Install]
WantedBy=multi-user.target
EOF

# Ensure uploads directory exists
mkdir -p /home/ubuntu/studysheet/server/uploads

# Start the backend service
sudo systemctl daemon-reload
sudo systemctl enable studysheet
sudo systemctl start studysheet
sleep 2
echo "Backend status: $(sudo systemctl is-active studysheet)"

# 2. Configure Nginx
echo "=== Configuring Nginx ==="
sudo tee /etc/nginx/sites-available/studysheet > /dev/null << 'NGINX'
server {
    listen 80;
    server_name studysheet.sixiyida.me;

    # Client static files
    root /home/ubuntu/studysheet/client/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support
        proxy_buffering off;
        proxy_read_timeout 300s;

        # File uploads
        client_max_body_size 50m;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Enable site
sudo ln -sf /etc/nginx/sites-available/studysheet /etc/nginx/sites-enabled/studysheet
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx status: $(sudo systemctl is-active nginx)"

# 3. SSL with Let's Encrypt
echo "=== Setting up SSL ==="
sudo certbot --nginx -d studysheet.sixiyida.me --non-interactive --agree-tos --email admin@sixiyida.me --redirect
echo "SSL setup complete"

# 4. Verify
echo "=== Final verification ==="
echo "Backend: $(sudo systemctl is-active studysheet)"
echo "Nginx: $(sudo systemctl is-active nginx)"
echo "MongoDB: $(sudo systemctl is-active mongod)"
curl -s http://127.0.0.1:3001/api/health
echo ""
echo "=== DEPLOYMENT COMPLETE ==="
