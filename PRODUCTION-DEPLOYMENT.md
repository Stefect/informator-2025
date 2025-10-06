# 🌐 Production Deployment Guide - capturestream.com

## 📋 Overview

Domain: **http://capturestream.com/**  
Status: **Production Ready** ✅  
Stack: Node.js + MongoDB + RTMP + WebSocket

---

## 🚀 Current Deployment

### Server Configuration:
```
Domain:      capturestream.com
WebSocket:   Port 3001
RTMP:        Port 1935
HLS/HTTP:    Port 8888
Database:    MongoDB (localhost:27017)
```

### Access URLs:
```
Main Site:   http://capturestream.com
Studio:      http://capturestream.com/studio.html
Watch:       http://capturestream.com/watch.html
API:         http://capturestream.com/api
```

### RTMP Streaming:
```
OBS Server:  rtmp://capturestream.com:1935/live
HLS URL:     http://capturestream.com:8888/live
FLV URL:     http://capturestream.com:8888/live
```

---

## 🔧 Environment Configuration

### Production .env:
```env
# Production Mode
NODE_ENV=production
DOMAIN=capturestream.com

# Public URLs
PUBLIC_URL=http://capturestream.com
RTMP_URL=rtmp://capturestream.com:1935/live
HLS_URL=http://capturestream.com:8888/live

# Server Ports
PORT=3001
HOST=0.0.0.0
RTMP_PORT=1935
HTTP_PORT=8888

# MongoDB (Choose one)
MONGODB_URI=mongodb://localhost:27017/capturestream
# OR Atlas Cloud
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/capturestream

# Logging
LOG_LEVEL=info

# Security
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION_TO_STRONG_SECRET
```

---

## 🌐 DNS & Domain Setup

### DNS Records:
```
Type    Name    Value               TTL
A       @       YOUR_SERVER_IP      3600
A       www     YOUR_SERVER_IP      3600
CNAME   rtmp    capturestream.com   3600
CNAME   hls     capturestream.com   3600
```

### Port Forwarding (Router):
```
External Port → Internal Port → Protocol
80            → 3001          → TCP
1935          → 1935          → TCP
8888          → 8888          → TCP
```

---

## 🔒 Firewall Configuration

### Windows Firewall:
```powershell
# WebSocket Server
New-NetFirewallRule -DisplayName "CaptureStream WebSocket" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

# RTMP Server
New-NetFirewallRule -DisplayName "CaptureStream RTMP" -Direction Inbound -LocalPort 1935 -Protocol TCP -Action Allow

# HLS/HTTP Server
New-NetFirewallRule -DisplayName "CaptureStream HLS" -Direction Inbound -LocalPort 8888 -Protocol TCP -Action Allow
```

### Linux (ufw):
```bash
sudo ufw allow 3001/tcp comment 'CaptureStream WebSocket'
sudo ufw allow 1935/tcp comment 'CaptureStream RTMP'
sudo ufw allow 8888/tcp comment 'CaptureStream HLS'
sudo ufw enable
```

---

## 🚀 Deployment Steps

### 1. Prepare Server:
```powershell
# Update code
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Configure Environment:
```powershell
# Copy and edit .env
cp .env.example .env
notepad .env
```

### 3. Start MongoDB:
```powershell
# Windows Service
net start MongoDB

# Or manual
mongod --dbpath C:\data\db
```

### 4. Start Application:
```powershell
# Development
npm run start:all

# Production (with PM2)
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📦 PM2 Production Setup

### Install PM2:
```powershell
npm install -g pm2
```

### ecosystem.config.js:
```javascript
module.exports = {
  apps: [
    {
      name: 'capturestream-web',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'capturestream-rtmp',
      script: './dist/rtmp-server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '500M'
    }
  ]
};
```

### PM2 Commands:
```powershell
# Start
pm2 start ecosystem.config.js

# Status
pm2 status

# Logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Monitor
pm2 monit

# Save config
pm2 save

# Auto-start on boot
pm2 startup
```

---

## 🔐 SSL/HTTPS Setup (Recommended)

### Using Cloudflare (Free):
1. Add domain to Cloudflare
2. Update nameservers
3. Enable SSL/TLS (Full)
4. Enable Always Use HTTPS
5. Update URLs in .env:
   ```env
   PUBLIC_URL=https://capturestream.com
   HLS_URL=https://capturestream.com:8888/live
   ```

### Using Let's Encrypt:
```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d capturestream.com -d www.capturestream.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 📊 Monitoring

### Health Check Endpoints:
```
http://capturestream.com/api/status
http://capturestream.com/api/health
```

### Response:
```json
{
  "server": {
    "uptime": 3600,
    "connections": 15,
    "version": "2.0.0"
  },
  "database": {
    "connected": true,
    "database": "capturestream"
  },
  "capture": {
    "isActive": true,
    "viewers": 10
  }
}
```

### PM2 Monitoring:
```powershell
# Web dashboard
pm2 web

# Access: http://localhost:9615
```

---

## 📝 Logging

### Log Files:
```
logs/
├── combined-YYYY-MM-DD.log       # All logs
├── error-YYYY-MM-DD.log          # Errors only
├── rtmp-YYYY-MM-DD.log           # RTMP events
├── websocket-YYYY-MM-DD.log      # WebSocket events
└── pm2-*.log                     # PM2 logs
```

### View Logs:
```powershell
# Real-time all logs
Get-Content logs\combined-2024-10-06.log -Wait -Tail 100

# Errors only
Get-Content logs\error-2024-10-06.log -Wait -Tail 50

# PM2 logs
pm2 logs
```

---

## 🔄 Backup Strategy

### Database Backup:
```powershell
# Daily backup script
$date = Get-Date -Format "yyyy-MM-dd"
mongodump --uri="mongodb://localhost:27017/capturestream" --out="./backups/$date"

# Restore
mongorestore --uri="mongodb://localhost:27017/capturestream" ./backups/2024-10-06/capturestream
```

### Automated Backup (Task Scheduler):
```powershell
# Create backup script: backup.ps1
$date = Get-Date -Format "yyyy-MM-dd"
$backupPath = "C:\backups\capturestream\$date"
New-Item -ItemType Directory -Path $backupPath -Force
& "C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe" --uri="mongodb://localhost:27017/capturestream" --out=$backupPath

# Add to Task Scheduler
# Run daily at 3 AM
```

---

## 🚨 Troubleshooting

### Server Not Accessible:
```powershell
# Check if running
pm2 status

# Check ports
netstat -an | findstr "3001 1935 8888"

# Check firewall
Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*CaptureStream*" }

# Restart
pm2 restart all
```

### MongoDB Connection Issues:
```powershell
# Check MongoDB service
Get-Service MongoDB

# Start MongoDB
net start MongoDB

# Check connection
mongosh
```

### High Memory Usage:
```powershell
# Check PM2 memory
pm2 monit

# Restart if needed
pm2 restart all

# Set memory limit in ecosystem.config.js
max_memory_restart: '500M'
```

---

## 📈 Performance Optimization

### 1. Enable Compression:
```typescript
// Already implemented in config.ts
{
  websocket: {
    perMessageDeflate: {
      level: 3,
      threshold: 1024
    }
  }
}
```

### 2. CDN Setup (Cloudflare):
- Cache static files (CSS, JS, images)
- Minify HTML/CSS/JS
- Enable Brotli compression

### 3. Database Indexing:
```javascript
// Already implemented in models
db.streams.getIndexes()
```

### 4. Load Balancing:
```javascript
// PM2 Cluster mode (already configured)
instances: 'max'
exec_mode: 'cluster'
```

---

## 🔧 Updates & Maintenance

### Update Application:
```powershell
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart all

# Check status
pm2 status
```

### Database Maintenance:
```javascript
// Compact database
db.runCommand({ compact: 'streams' })

// Rebuild indexes
db.streams.reIndex()

// Check size
db.stats()
```

---

## 📊 Production Checklist

- [x] Domain configured (capturestream.com)
- [x] DNS records set
- [x] Ports forwarded (3001, 1935, 8888)
- [x] Firewall rules added
- [x] MongoDB running
- [x] .env configured for production
- [ ] SSL certificate installed
- [ ] PM2 configured for auto-restart
- [ ] Backup strategy implemented
- [ ] Monitoring dashboard set up
- [ ] Error alerting configured
- [ ] CDN enabled (optional)
- [ ] Load testing completed

---

## 🎯 Testing Production

### 1. Test Main Site:
```
http://capturestream.com
```

### 2. Test Streaming:
- Open Studio: http://capturestream.com/studio.html
- Start stream
- Open Watch: http://capturestream.com/watch.html
- Verify video playing

### 3. Test OBS:
- Configure OBS with production URL
- Start streaming
- Check HLS URL in browser

### 4. Load Test:
```powershell
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://capturestream.com
```

---

## 📞 Support

- Logs: `logs/error-*.log`
- Status: `http://capturestream.com/api/status`
- PM2: `pm2 logs`
- MongoDB: `mongosh`

---

## 🌟 Production URLs Summary

```
Main Application:
  http://capturestream.com
  http://capturestream.com/studio.html
  http://capturestream.com/watch.html

RTMP Streaming:
  rtmp://capturestream.com:1935/live

HLS Playback:
  http://capturestream.com:8888/live/{stream_name}/index.m3u8

API:
  http://capturestream.com/api/status
  http://capturestream.com/api/streams
  http://capturestream.com/api/health
```

---

**Production deployment for capturestream.com is ready! 🚀🌐**
