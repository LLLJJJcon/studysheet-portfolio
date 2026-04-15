#!/bin/bash
echo "=== Service Status ==="
echo "Backend: $(sudo systemctl is-active studysheet)"
echo "Nginx: $(sudo systemctl is-active nginx)"
echo "MongoDB: $(sudo systemctl is-active mongod)"
echo ""
echo "=== Health Check (localhost) ==="
curl -s http://127.0.0.1:3001/api/health
echo ""
echo "=== Health Check (HTTPS) ==="
curl -s https://studysheet.sixiyida.me/api/health
echo ""
echo "=== Frontend (HTTPS) ==="
curl -s https://studysheet.sixiyida.me/ | head -5
echo ""
echo "=== Disk Usage ==="
df -h /
