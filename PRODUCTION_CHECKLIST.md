# Production Deployment Checklist

## Pre-Deployment

### Security

- [ ] **Generate new secrets**
  ```bash
  # Session Secret (64 bytes)
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

  # CSRF Secret (32 bytes)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Update .env.production with new secrets**
- [ ] **Never commit .env files to version control**
- [ ] **Set NODE_ENV=production**
- [ ] **Configure HTTPS/SSL certificates**
- [ ] **Set TRUST_PROXY=1 if behind reverse proxy**

### Database

- [ ] **Use managed PostgreSQL service** (AWS RDS, DigitalOcean, Supabase, etc.)
- [ ] **Enable SSL for database connection** (add `?sslmode=require` to DATABASE_URL)
- [ ] **Run database migrations**
  ```bash
  npm run db:migrate:prod
  ```
- [ ] **Create first admin account** via /auth/setup

### Email

- [ ] **Configure production SMTP** (SendGrid, Mailgun, AWS SES, etc.)
- [ ] **Verify email sending works**
- [ ] **Set proper FROM address**

### Rate Limiting

- [ ] **Review rate limit settings** for production traffic
- [ ] **Configure IP-based rate limiting** if behind proxy

---

## Deployment Steps

### Option A: Docker Deployment

```bash
# 1. Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# 2. Run migrations
docker-compose exec app npx prisma migrate deploy

# 3. Check health
docker-compose ps
```

### Option B: Traditional Deployment

```bash
# 1. Install dependencies
npm ci --only=production

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npm run db:migrate:prod

# 4. Start with PM2
pm2 start app.js --name webinar -i max
```

---

## Post-Deployment Verification

### Functional Tests

- [ ] Homepage loads correctly
- [ ] Registration form works
- [ ] Admin setup/login works
- [ ] Email confirmation sends
- [ ] Calendar links work
- [ ] CSV export works

### Security Tests

- [ ] **HTTPS is enforced**
- [ ] **Security headers present**
  ```bash
  curl -I https://your-domain.com
  ```
- [ ] **CSRF protection working** (try submitting form without token)
- [ ] **Rate limiting working** (try multiple failed logins)
- [ ] **Admin routes protected**

### Performance Tests

- [ ] Page load time < 3 seconds
- [ ] Database queries performant
- [ ] No memory leaks (monitor over time)

---

## Monitoring & Maintenance

### Recommended Tools

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry, LogRocket
- **APM**: New Relic, DataDog
- **Logs**: Papertrail, LogDNA

### Regular Tasks

- [ ] Monitor error logs daily
- [ ] Review rate limit hits weekly
- [ ] Backup database regularly
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly

---

## Security Incident Response

1. **Immediately** revoke compromised secrets
2. **Rotate** all session secrets
3. **Review** access logs
4. **Notify** affected users if needed
5. **Document** incident and remediation

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| SESSION_SECRET | Yes | 64-byte hex string |
| CSRF_SECRET | Yes | 32-byte hex string |
| NODE_ENV | Yes | Set to "production" |
| PORT | No | Default: 3000 |
| TRUST_PROXY | No | Set to 1 if behind proxy |
| SMTP_HOST | No | SMTP server hostname |
| SMTP_PORT | No | SMTP port (usually 587) |
| SMTP_USER | No | SMTP username |
| SMTP_PASS | No | SMTP password |
| EMAIL_FROM | No | Sender email address |

---

## Quick Commands

```bash
# Run tests
npm test

# Check dependencies for vulnerabilities
npm audit

# Start production server
npm run prod

# View logs (PM2)
pm2 logs webinar

# Restart server (PM2)
pm2 restart webinar
```
