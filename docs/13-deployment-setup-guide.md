# Deployment and Setup Guide

## Overview

This guide provides comprehensive instructions for deploying and setting up the Node.js SPA Business Management Application in various environments including development, staging, and production.

## Prerequisites

### System Requirements

#### Minimum Hardware
- **CPU**: 2-core processor (4-core recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 10GB available space
- **Network**: Stable internet connection

#### Supported Operating Systems
- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **macOS**: 11.0+ (Big Sur or later)
- **Windows**: 10+ with WSL2 or native Node.js

### Software Dependencies

#### Required Software
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **SQLite**: Turso cloud database (no local installation needed)

#### Optional but Recommended
- **Git**: For version control
- **Docker**: For containerized deployment
- **Nginx**: For production web server
- **PM2**: For process management
- **Redis**: For session caching (future enhancement)

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/business-management-app.git
cd business-management-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create `.env` file in the root directory:

```env
# Application Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (Turso)
TURSO_DATABASE_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token

# JWT Configuration
ACCESS_TOKEN_SECRET=your-256-bit-access-token-secret-key-here-change-in-production
REFRESH_TOKEN_SECRET=your-256-bit-refresh-token-secret-key-here-change-in-production

# External API Keys
RAPIDAPI_KEY=your-rapidapi-key-for-gst-lookup

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Security Configuration
CSP_ENABLED=true
XSS_PROTECTION=true

# Logging Configuration
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Development Features
ENABLE_SWAGGER=false
ENABLE_CORS=true
```

### 4. Database Setup

#### Turso Database Setup

1. **Install Turso CLI**:
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

2. **Login to Turso**:
```bash
turso auth login
```

3. **Create Database**:
```bash
turso db create business-app-db
```

4. **Get Database URL**:
```bash
turso db show business-app-db
```

5. **Create Authentication Token**:
```bash
turso db tokens create business-app-db
```

### 5. Database Migration

The application uses automatic schema creation. On first run, tables will be created automatically.

For manual database setup:

```bash
# Run database migrations (if available)
npm run migrate

# Or initialize database
npm run db:init
```

### 6. Start Development Server

```bash
# Development mode with hot reload
npm run dev

# Or standard start
npm start
```

The application will be available at `http://localhost:3000`

### 7. Verify Installation

1. **Check Application Health**:
```bash
curl http://localhost:3000/api/health
```

2. **Test Authentication**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Production Deployment

### Option 1: Direct Node.js Deployment

#### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/business-app
sudo chown -R $USER:$USER /var/www/business-app
```

#### 2. Application Deployment

```bash
# Clone repository
cd /var/www/business-app
git clone https://github.com/your-org/business-management-app.git .
git checkout main  # or your production branch

# Install dependencies
npm ci --production

# Create production environment file
cp .env.example .env.production
# Edit .env.production with production values
```

#### 3. Environment Configuration for Production

```env
NODE_ENV=production
PORT=3000

# Production database
TURSO_DATABASE_URL=your-production-turso-url
TURSO_AUTH_TOKEN=your-production-turso-token

# Strong JWT secrets (generate using openssl rand -base64 32)
ACCESS_TOKEN_SECRET=your-256-bit-access-token-secret-key-here
REFRESH_TOKEN_SECRET=your-256-bit-refresh-token-secret-key-here

# External services
RAPIDAPI_KEY=your-production-rapidapi-key

# Security (stricter in production)
CSP_ENABLED=true
XSS_PROTECTION=true
SECURE_COOKIES=true
SAME_SITE=strict

# Logging
LOG_LEVEL=warn
LOG_FILE=/var/log/business-app/app.log

# Performance
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
```

#### 4. Process Management with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'business-app',
    script: 'server/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/business-app/app.log',
    out_file: '/var/log/business-app/out.log',
    error_file: '/var/log/business-app/error.log',
    merge_logs: true,
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

#### 5. Nginx Reverse Proxy Setup

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/business-app << EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files
    location /public/ {
        alias /var/www/business-app/client/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API and application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/business-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. SSL Certificate Setup

```bash
# Install Certbot
sudo apt install snapd -y
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Docker Deployment

#### 1. Docker Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Docker Configuration

**Dockerfile**:
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

# Change ownership
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TURSO_DATABASE_URL=${TURSO_DATABASE_URL}
      - TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
      - ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET}
      - REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - app
    restart: unless-stopped
```

**nginx.conf**:
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_proxy"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Performance
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss;

    server {
        listen 80;
        server_name localhost;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;

        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

#### 3. Docker Deployment

```bash
# Create environment file
cat > .env << EOF
TURSO_DATABASE_URL=your-production-turso-url
TURSO_AUTH_TOKEN=your-production-turso-token
ACCESS_TOKEN_SECRET=your-256-bit-access-secret
REFRESH_TOKEN_SECRET=your-256-bit-refresh-secret
EOF

# Build and start services
docker-compose up -d --build

# Check logs
docker-compose logs -f app
```

## Monitoring and Maintenance

### Application Monitoring

#### PM2 Monitoring (Direct Deployment)

```bash
# Monitor application
pm2 monit

# Check logs
pm2 logs business-app

# Restart application
pm2 restart business-app

# Check status
pm2 status
```

#### Docker Monitoring

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f app

# Restart services
docker-compose restart

# Update deployment
docker-compose pull && docker-compose up -d
```

### Health Checks

#### Application Health Endpoint

```bash
# Check application health
curl http://your-domain.com/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "uptime": "2 days, 4 hours"
}
```

#### Database Health Check

```bash
# Test database connection
curl http://your-domain.com/api/admin/health/db

# Check Turso status
turso db show your-database-name
```

### Backup Strategy

#### Database Backup

```bash
# Turso database backup (automatic via Turso)
# Turso provides automatic backups and point-in-time recovery

# Manual backup (if needed)
turso db shell your-database-name ".backup /path/to/backup.db"
```

#### File Backup

```bash
# Backup uploads and logs
tar -czf backup_$(date +%Y%m%d).tar.gz \
  /var/www/business-app/uploads \
  /var/www/business-app/logs

# Upload to cloud storage
aws s3 cp backup_$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

### Log Management

#### Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Nginx log rotation
sudo cat > /etc/logrotate.d/nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        [ ! -f /var/run/nginx.pid ] || kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
EOF
```

### Performance Optimization

#### Database Optimization

```javascript
// Enable query logging in production
const db = new Database('production.db', {
  verbose: console.log
});

// Connection pooling (future enhancement)
const pool = new Pool({
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000
});
```

#### Caching Strategy

```javascript
// Implement Redis caching (future enhancement)
const redis = require('redis');
const client = redis.createClient();

// Cache frequently accessed data
app.use(cache('5 minutes'));
```

## Security Hardening

### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Firewall Configuration

```bash
# UFW firewall rules
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Fail2Ban for SSH protection
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Security Headers

```javascript
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check Node.js version
node --version

# Check environment variables
cat .env

# Check PM2 status
pm2 status

# Check application logs
pm2 logs business-app --lines 100
```

#### Database Connection Issues

```bash
# Test Turso connection
turso db ping your-database-name

# Check database URL
echo $TURSO_DATABASE_URL

# Verify authentication token
turso db tokens list
```

#### High Memory Usage

```bash
# Check PM2 memory usage
pm2 monit

# Restart application
pm2 restart business-app

# Check for memory leaks
npm install -g memwatch-next
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -text

# Renew certificate
sudo certbot renew

# Reload Nginx
sudo systemctl reload nginx
```

### Performance Issues

#### Slow Response Times

```bash
# Check database query performance
EXPLAIN QUERY PLAN SELECT * FROM master_rolls WHERE firm_id = ?;

# Enable query logging
const db = new Database(':memory:', { verbose: console.log });

# Check server resources
htop
df -h
free -h
```

#### High CPU Usage

```bash
# Profile application
npm install -g clinic
clinic doctor -- node server/server.js

# Check for infinite loops
pm2 logs business-app | grep -i error
```

## Scaling Considerations

### Horizontal Scaling

```javascript
// Cluster mode for multi-core utilization
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Worker process
  app.listen(port);
}
```

### Database Scaling

- **Turso**: Automatically handles scaling
- **Connection Pooling**: Implement for high traffic
- **Read Replicas**: Consider for read-heavy workloads
- **Caching Layer**: Redis for frequently accessed data

### CDN Integration

```javascript
// Static asset CDN (future enhancement)
app.use('/public', express.static('public', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));
```

## Backup and Recovery

### Automated Backups

```bash
# Daily backup script
cat > /usr/local/bin/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/var/backups/business-app"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
turso db shell business-app-db ".backup $BACKUP_DIR/db_$DATE.db"

# File backup
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/business-app/uploads

# Upload to cloud
aws s3 sync $BACKUP_DIR s3://business-app-backups/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
EOF

# Make executable and schedule
chmod +x /usr/local/bin/backup.sh
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup.sh
```

### Disaster Recovery

1. **Application Recovery**:
   ```bash
   # Quick restore from backup
   docker-compose down
   docker-compose pull
   docker-compose up -d
   ```

2. **Database Recovery**:
   ```bash
   # Restore from Turso backup
   turso db restore business-app-db --from backup.db
   ```

3. **Data Recovery**:
   ```bash
   # Restore files from backup
   aws s3 sync s3://business-app-backups /var/www/business-app/
   ```

This comprehensive deployment guide covers all aspects of setting up and maintaining the business management application in production environments.
