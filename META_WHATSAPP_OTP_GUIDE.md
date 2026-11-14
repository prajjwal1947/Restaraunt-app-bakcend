# Staff OTP Login with Meta WhatsApp Business API

## Quick Start

This guide implements staff OTP-based authentication using **Meta WhatsApp Business API** (or manual WhatsApp Business App for cost-free operation).

## Two Implementation Options

### Option 1: Manual WhatsApp Business App (FREE - Recommended for Small Teams)

**Best for:** 
- Teams with < 50 staff
- Manual OTP sending via WhatsApp Business App
- No API costs
- Simple setup

**How it works:**
1. Staff requests OTP on login page
2. Backend generates 6-digit OTP and logs it to console/admin panel
3. Admin receives OTP and sends manually via WhatsApp Business App
4. Staff enters OTP and logs in

**Setup:** Just use the system as-is, no configuration needed!

---

### Option 2: Meta WhatsApp Cloud API (AUTOMATED)

**Best for:**
- Teams with 50+ staff
- Automated OTP delivery
- Higher volume
- Professional setup

**Costs:**
- Free for first 1,000 messages/month
- $0.0025 per message after that
- No monthly fees

**Setup required:** ~15 minutes

---

## Implementation Details

### Architecture

```
┌─────────────────┐
│   Staff Login   │
│   (Browser)     │
└────────┬────────┘
         │ Request OTP
         ▼
┌──────────────────────────────────────┐
│   Backend                            │
│   POST /api/v1/otp/send              │
│   - Generate 6-digit OTP             │
│   - Validate staff phone             │
│   - Store OTP in database            │
└────────┬─────────────────────────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼ (if API configured)      ▼ (manual mode)
┌─────────────────┐      ┌────────────────┐
│ Meta API        │      │ Console Log    │
│ (Automated)     │      │ Admin Panel    │
└────────┬────────┘      └────────┬───────┘
         │                        │
         ▼                        ▼
    WhatsApp Message         Admin sends via
    (Instant)                WhatsApp Business App
         │                        │
         └────────────┬───────────┘
                      │
                  Staff receives OTP
                      │
                      ▼
            Staff enters OTP on login
            Backend verifies & issues JWT
```

---

## Step 1: Test Local Setup (Manual Mode)

### No configuration needed! OTPs appear in console.

```bash
cd Restaraunt-app-bakcend
npm run dev

# In another terminal
curl -X POST http://localhost:4000/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "restaurant-uuid",
    "phone": "+919876543210"
  }'

# Check console output:
# ⚠️  MANUAL WHATSAPP MODE OTP for 3210 is: 123456 Valid for 10 minutes
```

### Find your restaurant ID:

```bash
# In admin dashboard, Settings → Look at URL
# Or check database: SELECT id FROM "Restaurant" LIMIT 1;
```

### Add staff with phone:

1. Go to Admin Dashboard
2. Settings → OTP Settings
3. Enable OTP Feature
4. Add phone numbers to staff members
5. Test login at http://localhost:5173/staff-login

---

## Step 2: Enable Meta WhatsApp Cloud API (Optional)

### Prerequisites:
- Meta Business Account
- WhatsApp Business Phone Number
- Meta App with WhatsApp API enabled

### Get Credentials:

1. **Create Meta App** (if you don't have one):
   - Visit https://developers.facebook.com/
   - Click "My Apps" → "Create App"
   - Choose "Business" type
   - Fill details and create

2. **Add WhatsApp Product**:
   - In your app, click "Add Product"
   - Find WhatsApp and add it
   - Go to WhatsApp → API Setup

3. **Create System User**:
   - Settings → Accounts → System Users
   - Create new system user with "Admin" role
   - Generate access token (never expires is better)
   - Copy the token → This is `META_WHATSAPP_API_TOKEN`

4. **Get Phone Number ID**:
   - WhatsApp → Phone Numbers
   - You'll see your phone number with ID
   - Copy the ID → This is `META_WHATSAPP_PHONE_NUMBER_ID`

### Format:
```
META_WHATSAPP_PHONE_NUMBER_ID: 123456789012345 (just digits)
META_WHATSAPP_API_TOKEN: EAABs... (long token)
```

### Add to .env:

```bash
# Meta WhatsApp Business API
META_WHATSAPP_API_TOKEN=your-token-here
META_WHATSAPP_PHONE_NUMBER_ID=your-phone-id-here
```

### Create Message Template:

You must create a message template in Meta Business:

1. WhatsApp → Message Templates
2. Click "Create Template"
3. Template name: `otp_login`
4. Language: English (US)
5. Category: OTP
6. Message body:
   ```
   Your Olive & Thyme staff login OTP is: {{1}}
   This code is valid for 10 minutes.
   ```
7. Click "Submit"

### Verify Template Approved:

```bash
# Check Meta Business console
# Status should be "APPROVED" before it works

# If rejected, Meta will show reason
# Common issues:
# - Greeting length > 160 chars
# - Too many parameters
# - Sales/promotional content (not allowed for OTP)
```

### Test with API:

```bash
# Restart backend with new .env
npm run dev

# Send OTP
curl -X POST http://localhost:4000/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "phone": "+919876543210"
  }'

# Staff should receive WhatsApp message with OTP instantly!
```

---

## API Reference

### Send OTP

```http
POST /api/v1/otp/send
Content-Type: application/json

{
  "restaurantId": "uuid",
  "phone": "+919876543210"
}
```

**Responses:**

✅ Success (201):
```json
{
  "data": {
    "message": "OTP sent successfully",
    "phone": "****3210"
  }
}
```

❌ Errors:
- `400` - OTP disabled, invalid phone, staff not found
- `422` - Invalid phone format (must be E.164)
- `500` - WhatsApp delivery failed

### Verify OTP

```http
POST /api/v1/otp/verify
Content-Type: application/json

{
  "restaurantId": "uuid",
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "base64...",
    "user": {
      "id": "staff-uuid",
      "name": "John Doe",
      "phone": "+919876543210",
      "role": "STAFF",
      "restaurantId": "restaurant-uuid"
    }
  }
}
```

---

## Admin Dashboard Features

### Settings → OTP Settings

✅ **Enable/Disable OTP**
- Toggle feature on/off instantly
- Applies to all staff

✅ **Manage Staff Phone Numbers**
- View all staff
- Add/update phone numbers (E.164 format)
- Multiple staff can share phone if needed

✅ **View OTP History**
- Last 100 login attempts
- See verified vs pending OTPs
- Attempt count tracking
- Timestamps for audit trail

### Admin Panel Flow:

```
1. Go to Settings
2. Find "OTP-Based Staff Login" section
3. Toggle "Enable OTP Login"
4. Click on staff name
5. Enter phone: +919876543210
6. Save
7. Staff can now login via /staff-login
```

---

## Security Features

### ✅ Built-in Protections

1. **OTP Expiry**: 10 minutes max
2. **Attempt Limiting**: Max 3 failed attempts
3. **Phone Validation**: E.164 format required
4. **Rate Limiting**: 20 requests per 15 minutes on auth endpoints
5. **JWT Tokens**: Secure access/refresh pair
6. **Restaurant Isolation**: Each restaurant's data separate
7. **Admin Control**: Feature on/off per restaurant
8. **Audit Trail**: All login attempts logged

### Security Best Practices:

```
✅ DO:
- Use E.164 format phone numbers (+country-code)
- Rotate JWT secrets regularly
- Monitor OTP history for suspicious activity
- Disable OTP for inactive staff
- Use HTTPS in production

❌ DON'T:
- Share admin credentials
- Log OTPs in production logs
- Use short expiry times (< 5 min causes friction)
- Allow unlimited OTP requests
```

---

## Troubleshooting

### Issue: "OTP sent but staff didn't receive it"

**Manual Mode:**
- ✅ Check backend console for OTP
- ✅ Copy OTP and send via WhatsApp Business App manually
- ✅ Verify phone number is correct

**API Mode:**
- ❌ Check Meta API token is valid
- ❌ Verify WhatsApp template "otp_login" is APPROVED
- ❌ Check phone number is in correct E.164 format
- ❌ View Meta error logs: https://developers.facebook.com/docs/

### Issue: "Staff not found"

```
1. Verify staff exists in system
2. Confirm staff isActive = true
3. Admin must assign phone first (Settings → OTP Settings)
4. Staff role must be STAFF or MANAGER
```

### Issue: "OTP expired"

```
1. OTP valid for 10 minutes only
2. Click "Resend OTP" button
3. Request new OTP
```

### Issue: "Too many attempts"

```
1. Max 3 failed attempts allowed
2. Wait 10 minutes for OTP to expire
3. Request new OTP
4. Check OTP history in admin panel
```

### Issue: Meta API Returns Error

**Common errors:**

```
"OTP_DISABLED" → Enable in Settings → OTP Settings
"INVALID_PHONE" → Use format: +919876543210
"STAFF_NOT_FOUND" → Admin must add phone to staff first
"WHATSAPP_ERROR" → Check Meta token, template approval
```

**Debug:**
```bash
# Check console for detailed error
tail -f logs/server.log

# Verify template is approved in Meta Business:
# https://business.facebook.com/ → WhatsApp → Message Templates

# Test Meta API directly:
curl -X POST https://graph.instagram.com/v18.0/YOUR_PHONE_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+919876543210",
    "type": "text",
    "text": {
      "preview_url": false,
      "body": "Test message"
    }
  }'
```

---

## Production Deployment

### Before Going Live:

1. **Backend:**
   ```bash
   npm run build
   npm run prisma:deploy  # Apply database migrations
   npm run start
   ```

2. **Frontend:**
   ```bash
   cd admin
   npm run build
   ```

3. **Environment Variables:**
   ```bash
   # Production .env
   NODE_ENV=production
   DATABASE_URL=your-production-db-url
   
   # JWT Secrets (generate new)
   JWT_ACCESS_SECRET=$(openssl rand -hex 32)
   JWT_REFRESH_SECRET=$(openssl rand -hex 32)
   
   # If using Meta API:
   META_WHATSAPP_API_TOKEN=your-production-token
   META_WHATSAPP_PHONE_NUMBER_ID=your-production-phone-id
   
   # CORS
   CLIENT_ADMIN_URL=https://admin.yourrestaurant.com
   CLIENT_CUSTOMER_URL=https://customer.yourrestaurant.com
   ```

4. **Verify Health:**
   ```bash
   curl https://your-api.com/health
   curl https://your-api.com/health/db
   ```

---

## Cost Analysis

### Option 1: Manual (FREE)
- Staff: Unlimited
- Messages: Manual (admin sends)
- Cost: $0/month
- Best for: Small teams (< 50 staff)

### Option 2: Meta API (CHEAP)
- First 1,000 messages/month: FREE
- Additional messages: $0.0025 each
- 10,000 messages/month: ~$22.50
- 50,000 messages/month: ~$122.50
- Best for: Growing restaurants

**Example costs:**
- 5 staff × 2 logins/day × 30 days = 300 messages/month = FREE
- 20 staff × 3 logins/day × 30 days = 1,800 messages/month = $2
- 100 staff × 2 logins/day × 30 days = 6,000 messages/month = $12.50

---

## Files Overview

### Backend
- `/src/routes/staff-otp.ts` - Core OTP logic (Meta API integrated)
- `/src/routes/admin-otp-settings.ts` - Admin controls
- `/prisma/schema.prisma` - Database models
- `/prisma/migrations/...` - Database setup

### Frontend
- `/admin/src/pages/StaffOTPLogin.jsx` - Staff login interface
- `/admin/src/components/OTPSettings.jsx` - Admin settings panel
- `/admin/src/App.jsx` - Route setup

---

## Next Steps

1. ✅ Test with manual OTP delivery
2. ⏭️ Set up Meta WhatsApp (when ready to automate)
3. ⏭️ Train staff on new login flow
4. ⏭️ Monitor OTP history in admin panel
5. ⏭️ Optimize onboarding process

---

## Support & Resources

### Documentation
- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)

### Testing
- Use Twilio sandbox: `+14155238886` (if testing manually)
- Meta sandbox supports testing before live

---

## Version

- Feature: Staff OTP Login v1.0
- Backend: Express.js + Prisma
- Frontend: React + Vite
- WhatsApp: Meta Business API
- Database: PostgreSQL
