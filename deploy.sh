#!/bin/bash

# Deployment script for Inventory Intelligence
# Domain: inventory.pixelcraftedmedia.com

set -e

echo "=== Inventory Intelligence Deployment ==="

# 1. Build the app
echo "Building app..."
npm run build

# 2. Copy nginx config (run on server)
echo ""
echo "=== Server Setup Commands ==="
echo "Run these commands on your server (38.97.60.181):"
echo ""
echo "# 1. Copy nginx config"
echo "sudo cp nginx/inventory.pixelcraftedmedia.com.conf /etc/nginx/sites-available/"
echo "sudo ln -sf /etc/nginx/sites-available/inventory.pixelcraftedmedia.com.conf /etc/nginx/sites-enabled/"
echo ""
echo "# 2. Remove old imgproxy config if exists"
echo "sudo rm -f /etc/nginx/sites-enabled/imgproxy.conf  # or whatever the old config was"
echo ""
echo "# 3. Get SSL certificate"
echo "sudo certbot certonly --nginx -d inventory.pixelcraftedmedia.com"
echo ""
echo "# 4. Test and reload nginx"
echo "sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "# 5. Start the app with PM2"
echo "pm2 start npm --name 'inventory-intelligence' -- start"
echo "pm2 save"
echo ""
echo "=== DNS Setup ==="
echo "Add an A record in your DNS:"
echo "  inventory.pixelcraftedmedia.com -> 38.97.60.181"
echo ""
