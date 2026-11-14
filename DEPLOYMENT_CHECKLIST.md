# 🚀 Production Deployment Checklist

## Pre-Deployment (1-2 hours)

### Backend Setup
- [ ] Clone/pull latest code
- [ ] Run `npm install`
- [ ] Generate new JWT secrets:
  ```bash
  openssl rand -hex 32  # JWT_ACCESS_SECRET
  openssl rand -hex 32  # JWT_REFRESH_SECRET
  ```
- [ ] Update `.env` with production values:
  ```
  NODE_ENV=production
  DATABASE_URL=postgresql://user:pass@host:5432/dbname
  JWT_ACCESS_SECRET=<generated-value>
  JWT_REFRESH_SECRET=<generated-value>
  ```
- [ ] Test build: `npm run build`
- [ ] Verify dist folder: `ls dist/`
- [ ] Run database migrations: `npm run prisma:deploy`

### Frontend Setup
- [ ] Go to `admin` directory
- [ ] Run `npm install`
- [ ] Update `.env` with production API URL:
  ```
  VITE_API_URL=https://your-api-domain.com
  ```
- [ ] Test build: `npm run build`
- [ ] Verify dist folder: `ls dist/`

### Database Verification
- [ ] Database is running and accessible
- [ ] All migrations applied:
  ```bash
  npm run prisma:deploy
  ```
- [ ] Verify new tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('RestaurantOTPSettings', 'StaffOTP');
  ```

### Security Check
- [ ] HTTPS enabled on production domain
- [ ] JWT secrets are random and strong (32+ characters)
- [ ] Database password is secure
- [ ] Environment variables not in version control
- [ ] `.env` file is `.gitignored`
- [ ] No secrets in logs

---

## Meta WhatsApp Setup (Optional - 15 min)

Only if you want to enable automatic OTP delivery.

### Meta Business Account
- [ ] Go to https://developers.facebook.com
- [ ] Create Meta App
- [ ] Add WhatsApp product

### Get Credentials
- [ ] Create System User (Settings → Accounts → System Users)
- [ ] Generate access token (Bearer token)
- [ ] Get Phone Number ID (WhatsApp → Phone Numbers)

### Configure Application
- [ ] Add to `.env`:
  ```
  META_WHATSAPP_API_TOKEN=your-token
  META_WHATSAPP_PHONE_NUMBER_ID=your-phone-id
  ```
- [ ] Create message template in Meta Business:
  - Name: `otp_login`
  - Body: "Your Olive & Thyme staff login OTP is: {{1}}"
  - Language: English (US)
  - Category: OTP
- [ ] Wait for template approval (usually instant)
- [ ] Verify template status is "APPROVED"

### Test Meta Integration
```bash
# Restart backend
npm run start

# Send OTP
curl -X POST https://your-api-domain.com/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"xxx","phone":"+919876543210"}'

# Should receive WhatsApp message within 2 seconds
```

---

## Deployment Execution

### Backend Deployment

**Option 1: Docker**
```bash
# Build image
docker build -t restaurant-otp-api .

# Run container
docker run -d \
  -e NODE_ENV=production \
  -e DATABASE_URL=... \
  -e JWT_ACCESS_SECRET=... \
  -e JWT_REFRESH_SECRET=... \
  -e META_WHATSAPP_API_TOKEN=... \
  -e META_WHATSAPP_PHONE_NUMBER_ID=... \
  -p 4000:4000 \
  restaurant-otp-api
```

**Option 2: Direct Server**
```bash
# Copy files
scp -r dist/* user@server:/var/www/api/

# SSH into server
ssh user@server

# Install dependencies
npm install --production

# Start with PM2
pm2 start dist/server.js --name "restaurant-api"
pm2 save
```

**Option 3: Render/Heroku/Railway**
```bash
# Push to GitHub
git push origin main

# Platform will auto-build and deploy
# Configure environment variables in platform dashboard
```

### Frontend Deployment

**Option 1: Static Hosting (Recommended)**
```bash
# Deploy to Vercel
vercel deploy admin/dist

# Deploy to Netlify
netlify deploy --prod --dir=admin/dist

# Deploy to AWS S3 + CloudFront
aws s3 sync admin/dist s3://your-bucket/
```

**Option 2: Web Server**
```bash
# Copy files to web server
scp -r admin/dist/* user@server:/var/www/admin/

# Configure Nginx
sudo systemctl restart nginx
```

---

## Post-Deployment Verification

### Health Checks
- [ ] Backend health: `curl https://your-api.com/health`
- [ ] Database check: `curl https://your-api.com/health/db`
- [ ] API documentation: `https://your-api.com/docs`

### Functionality Tests

**Test Staff Login:**
1. [ ] Go to `https://your-domain.com/staff-login`
2. [ ] Enter test Restaurant ID and phone
3. [ ] Click "Send OTP"
4. [ ] Check backend logs for OTP (or WhatsApp if using Meta)
5. [ ] Enter OTP and verify login
6. [ ] Confirm JWT tokens received
7. [ ] Verify redirect to dashboard

**Test Admin Settings:**
1. [ ] Go to admin dashboard
2. [ ] Navigate to Settings
3. [ ] Find OTP Settings section
4. [ ] Toggle OTP on/off
5. [ ] View and edit staff phone numbers
6. [ ] View OTP login history
7. [ ] Verify all functions work

### Security Verification
- [ ] HTTPS enforced (no HTTP)
- [ ] CORS headers correct
- [ ] JWT verification working
- [ ] Rate limiting active (check headers)
- [ ] Database backups configured
- [ ] Logs not exposing secrets

### Performance Check
```bash
# Test API response time
time curl https://your-api.com/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"test","phone":"+919876543210"}'

# Should respond in < 500ms
```

---

## Monitoring Setup

### Logging
- [ ] Configure centralized logging (Datadog, LogRocket, etc.)
- [ ] Log OTP send attempts
- [ ] Log failed verifications
- [ ] Log database errors
- [ ] Alert on > 10 failed attempts/minute

### Metrics
- [ ] Track OTP send success rate
- [ ] Monitor API response times
- [ ] Alert on database connection issues
- [ ] Monitor JWT token generation
- [ ] Track concurrent users

### Alerts
- [ ] Email alert on API errors
- [ ] Slack alert on Meta API failures
- [ ] Database connection alerts
- [ ] High failed OTP rate alert (> 50% failures)
- [ ] High CPU/memory usage alerts

---

## Backup & Disaster Recovery

### Database Backups
- [ ] Daily automated backups configured
- [ ] Backup retention: minimum 30 days
- [ ] Test restore process
- [ ] Backup encryption enabled
- [ ] Off-site backup storage

### Application Backups
- [ ] GitHub as primary repository
- [ ] Tag stable releases
- [ ] Document deployment process
- [ ] Keep older versions available

### Disaster Recovery Plan
- [ ] Database recovery time: < 1 hour
- [ ] API restart time: < 5 minutes
- [ ] Frontend CDN failover: automatic
- [ ] Staff login fallback: manual OTP mode

---

## Production Operations

### Day 1 Monitoring
- [ ] Watch OTP send/verify success rates
- [ ] Monitor error logs
- [ ] Check database performance
- [ ] Verify staff can login
- [ ] Confirm notifications working

### Weekly Checks
- [ ] Review OTP history for anomalies
- [ ] Check database disk usage
- [ ] Verify backups completed
- [ ] Monitor JWT token expiry
- [ ] Check rate limiting stats

### Monthly Tasks
- [ ] Review and update JWT secrets (optional)
- [ ] Audit OTP login attempts
- [ ] Update dependencies
- [ ] Performance optimization
- [ ] Security patch review

---

## Rollback Procedure (If Needed)

### Quick Rollback
```bash
# Revert to previous version
git checkout previous-tag
npm run build
npm run prisma:deploy
npm run start
```

### Database Rollback
```bash
# Only if migrations failed
npm run prisma:migrate resolve --rolled-back <migration-name>
# Then redeploy previous version
```

### Frontend Rollback
```bash
# Revert DNS/CDN to previous deployment
# Vercel: Select previous deployment
# Netlify: Roll back site
# S3/CloudFront: Invalidate cache
```

---

## Communication

### Notify Stakeholders
- [ ] Inform admin users of new staff login feature
- [ ] Send staff login instructions
- [ ] Share documentation links
- [ ] Provide support contact info

### Staff Training
- [ ] Record login demo video
- [ ] Create written guide with screenshots
- [ ] Conduct brief training session
- [ ] Provide help documentation
- [ ] Set up support email for questions

### Admin Instructions
- [ ] How to enable OTP feature
- [ ] How to add staff phone numbers
- [ ] How to view OTP history
- [ ] How to troubleshoot
- [ ] Emergency contact procedures

---

## Documentation

### Update Production Docs
- [ ] Document API endpoints deployed
- [ ] List environment variables used
- [ ] Record deployment timestamp
- [ ] Document any custom configurations
- [ ] Create runbook for common tasks

### Create Runbooks
- [ ] How to restart backend
- [ ] How to check logs
- [ ] How to view database
- [ ] How to rollback
- [ ] Emergency procedures

---

## Performance Optimization

### Database
- [ ] Create indexes on frequently queried fields
- [ ] Analyze and optimize slow queries
- [ ] Set up query caching
- [ ] Monitor connection pool

### Application
- [ ] Enable compression (gzip)
- [ ] Set up caching headers
- [ ] Optimize asset size
- [ ] Enable HTTP/2

### Infrastructure
- [ ] Use CDN for static files
- [ ] Load balancing (if applicable)
- [ ] Database replication (if applicable)
- [ ] Auto-scaling configuration

---

## Final Checklist Before Going Live

### Critical
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] Database migrations applied
- [ ] Staff login works end-to-end
- [ ] Admin settings accessible
- [ ] HTTPS working
- [ ] Environment variables set correctly

### Important
- [ ] OTP history visible in admin
- [ ] Phone number validation working
- [ ] Error messages display properly
- [ ] Mobile responsive design works
- [ ] Rate limiting active

### Nice to Have
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Logs centralized
- [ ] Documentation complete
- [ ] Training materials ready

---

## Success Criteria

✅ **Deployment is successful when:**
- Staff can login via `/staff-login`
- Admins can manage OTP in Settings
- OTPs arrive within 5 seconds
- All error messages display correctly
- Mobile login works
- No crashes or errors in logs
- Database backups functioning
- Monitoring alerts working

---

## Support Resources

### If Something Goes Wrong

1. **Check logs first:**
   ```bash
   # Backend logs
   docker logs <container-id>
   # or
   pm2 logs
   ```

2. **Verify database:**
   ```bash
   # Connect to DB and check tables
   psql your-database-url
   \dt
   ```

3. **Test API:**
   ```bash
   curl https://your-api.com/health
   curl https://your-api.com/api/v1/otp/send ...
   ```

4. **Check configuration:**
   ```bash
   # Verify .env is loaded
   echo $DATABASE_URL
   echo $JWT_ACCESS_SECRET
   ```

5. **Read documentation:**
   - `IMPLEMENTATION_SUMMARY.md`
   - `META_WHATSAPP_OTP_GUIDE.md`
   - `QUICK_START.md`

---

**Deployment Checklist Version:** 1.0  
**Last Updated:** November 13, 2026  
**Status:** Ready for Production
