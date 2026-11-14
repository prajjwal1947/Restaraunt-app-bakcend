# Staff OTP Login - Complete Setup Guide

## Overview

This comprehensive guide walks through implementing staff OTP-based authentication for your Olive & Thyme restaurant ordering system.

## Architecture

### Backend Components

1. **Staff OTP Routes** (`/src/routes/staff-otp.ts`)
   - `POST /api/v1/otp/send` - Generate and send OTP via WhatsApp
   - `POST /api/v1/otp/verify` - Verify OTP and issue JWT tokens

2. **Admin OTP Settings Routes** (`/src/routes/admin-otp-settings.ts`)
   - `GET /api/v1/settings/otp` - Get OTP feature status
   - `PATCH /api/v1/settings/otp` - Enable/disable OTP feature
   - `GET /api/v1/staff` - List all staff members
   - `PATCH /api/v1/staff/:staffId/phone` - Assign phone to staff
   - `GET /api/v1/otp-history` - View OTP login attempts

3. **Database Schema** (`/prisma/schema.prisma`)
   - `RestaurantOTPSettings` - Toggle OTP feature on/off per restaurant
   - `StaffOTP` - Store OTP codes, attempts, and verification status

### Frontend Components

1. **Staff Login Page** (`/admin/src/pages/StaffOTPLogin.jsx`)
   - Two-step flow: Phone entry → OTP verification
   - WhatsApp OTP messaging display
   - Error handling and retry logic

2. **Admin OTP Settings Panel** (`/admin/src/components/OTPSettings.jsx`)
   - Toggle OTP feature on/off
   - Assign phone numbers to staff
   - View OTP login history
   - Staff list with phone numbers

## Step 1: Backend Setup

### 1.1 Install Dependencies

```bash
cd Restaraunt-app-bakcend
npm install twilio
```

### 1.2 Update Environment Variables

Add to `.env` file:

```env
# Twilio Configuration for WhatsApp OTP
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

**Get Twilio Credentials:**

1. Sign up at https://www.twilio.com/console
2. Get Account SID and Auth Token from the console
3. Set up WhatsApp Integration:
   - Go to Messaging > Try it out > Send an SMS
   - Choose WhatsApp as the channel
   - Get your WhatsApp-enabled number (or use sandbox)
4. Sandbox number format: `whatsapp:+14155238886` (default Twilio sandbox)
5. For production: Use your approved WhatsApp Business Phone Number

### 1.3 Run Database Migration

The migration files are ready at `/prisma/migrations/20261112084500_add_staff_otp/migration.sql`

```bash
# Option 1: Use Prisma migrate
npm run prisma:migrate

# Option 2: Apply manually (production)
psql -h your-host -U your-user -d your-db -f prisma/migrations/20261112084500_add_staff_otp/migration.sql
```

**Tables Created:**

- `RestaurantOTPSettings` - OTP feature toggle
- `StaffOTP` - OTP codes and verification records

### 1.4 Register Routes in App

In `/src/app.ts`, routes are already registered:

```typescript
import { staffOtpRouter } from "./routes/staff-otp";
import { adminOtpSettingsRouter } from "./routes/admin-otp-settings";

// ...

app.use("/api/v1", staffOtpRouter);
app.use("/api/v1", adminOtpSettingsRouter);
```

### 1.5 Build and Test Backend

```bash
npm run build

# Run development server
npm run dev

# Test the endpoints
curl http://localhost:4000/health
```

## Step 2: Frontend Setup - Admin Panel

### 2.1 Staff Login Route

Already added to `/admin/src/App.jsx`:

```jsx
<Route
  path="/staff-login"
  element={<StaffOTPLogin />}
/>
```

Access at: `http://localhost:5173/staff-login`

### 2.2 Admin Settings Panel

OTP settings integrated into `/admin/src/pages/Settings.jsx`:

- Toggle OTP feature on/off
- Manage staff phone numbers
- View OTP login history
- Admin can see all login attempts and failures

### 2.3 Build Admin Frontend

```bash
cd admin
npm install
npm run dev

# Or build for production
npm run build
```

## Step 3: Testing

### 3.1 Local Testing

#### Test without Twilio (Mock Mode)

If Twilio is not configured, OTPs are logged to console:

```bash
# Check your terminal for OTP output
# Console will show: OTP: 123456
```

#### Test with Twilio (WhatsApp Sandbox)

1. **Connect to Twilio Sandbox:**
   - Go to https://console.twilio.com/us/messaging/whatsapp/learn
   - Send the sandbox code to Twilio number

2. **Test Staff Login:**

```bash
# Send OTP
curl -X POST http://localhost:4000/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "phone": "+14155238886"
  }'

# Check WhatsApp for OTP message
# Get OTP from message

# Verify OTP
curl -X POST http://localhost:4000/api/v1/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "phone": "+14155238886",
    "otp": "123456"
  }'

# Response includes JWT tokens:
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "base64-encoded-token",
    "user": {
      "id": "staff-id",
      "name": "John Doe",
      "phone": "+14155238886",
      "role": "STAFF",
      "restaurantId": "restaurant-id"
    }
  }
}
```

### 3.2 Admin Dashboard Testing

1. **Go to Settings page** (http://localhost:5173/settings)
2. **Find OTP Settings section**
3. **Enable OTP feature**
4. **Assign phone numbers to staff:**
   - Select a staff member
   - Enter phone number in E.164 format
   - Save
5. **View OTP history:**
   - Click "Show History"
   - See all login attempts and status

### 3.3 Staff Login Flow

1. **Go to Staff Login** (http://localhost:5173/staff-login)
2. **Enter Restaurant ID** (get from settings)
3. **Enter Phone Number** (assigned to staff)
4. **Click "Send OTP"**
5. **Check WhatsApp for OTP code**
6. **Enter OTP** (6 digits)
7. **Click "Verify OTP"**
8. **Success!** Redirected to dashboard with staff access

## API Documentation

### Send OTP

```http
POST /api/v1/otp/send
Content-Type: application/json

{
  "restaurantId": "string",
  "phone": "string (E.164 format)"
}
```

**Success Response (201):**
```json
{
  "data": {
    "message": "OTP sent successfully",
    "phone": "*****3210"
  }
}
```

**Error Responses:**
- `400` - OTP disabled, invalid phone, staff not found
- `422` - Invalid phone format
- `500` - WhatsApp delivery failed

### Verify OTP

```http
POST /api/v1/otp/verify
Content-Type: application/json

{
  "restaurantId": "string",
  "phone": "string (E.164 format)",
  "otp": "string (6 digits)"
}
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "JWT token",
    "refreshToken": "refresh token",
    "user": {
      "id": "string",
      "name": "string",
      "phone": "string",
      "role": "STAFF | MANAGER | OWNER",
      "restaurantId": "string"
    }
  }
}
```

**Error Responses:**
- `400` - OTP expired, not found
- `401` - Invalid OTP, staff not found
- `429` - Too many attempts (max 3)

### Get OTP Settings

```http
GET /api/v1/settings/otp
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "data": {
    "restaurantId": "string",
    "isEnabled": boolean,
    "createdAt": "ISO-8601 timestamp",
    "updatedAt": "ISO-8601 timestamp"
  }
}
```

### Update OTP Settings

```http
PATCH /api/v1/settings/otp
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "isEnabled": boolean
}
```

### List Staff

```http
GET /api/v1/staff
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "phone": "string | null",
      "role": "STAFF | MANAGER",
      "isActive": boolean,
      "createdAt": "ISO-8601 timestamp"
    }
  ]
}
```

### Update Staff Phone

```http
PATCH /api/v1/staff/:staffId/phone
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "phone": "string (E.164 format)"
}
```

### Get OTP History

```http
GET /api/v1/otp-history
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "phone": "string",
      "attempts": 0,
      "maxAttempts": 3,
      "verifiedAt": "ISO-8601 timestamp | null",
      "expiresAt": "ISO-8601 timestamp",
      "createdAt": "ISO-8601 timestamp"
    }
  ]
}
```

## Security Features

### Implemented

✅ **OTP Expiry** - 10 minutes max
✅ **Attempt Limiting** - Max 3 failed attempts
✅ **Phone Validation** - E.164 format required
✅ **Rate Limiting** - Applied to auth endpoints
✅ **JWT Tokens** - Secure access/refresh token pair
✅ **Restaurant Isolation** - Multi-tenancy support
✅ **Admin Control** - Enable/disable feature per restaurant

### Best Practices

1. **OTP Delivery:**
   - Never log OTPs in production
   - Use WhatsApp for delivery (encrypted)
   - OTP valid for 10 minutes only

2. **Passwords:**
   - Staff login via OTP (no password required)
   - JWT tokens handle authentication
   - Refresh tokens rotate on use

3. **Phone Numbers:**
   - Store in E.164 format
   - Validate before sending OTP
   - Allow updates via admin panel

4. **Admin Access:**
   - Admin must authenticate before viewing staff
   - OTP history audit trail
   - Can disable feature anytime

## Production Deployment

### 1. Environment Setup

```bash
# Production .env
NODE_ENV=production
PORT=4000
DATABASE_URL=your-production-db-url

# JWT Secrets (generate new random values)
JWT_ACCESS_SECRET=<generate-with-openssl-rand-hex-32>
JWT_REFRESH_SECRET=<generate-with-openssl-rand-hex-32>

# Twilio Production
TWILIO_ACCOUNT_SID=your-production-account-sid
TWILIO_AUTH_TOKEN=your-production-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+your-approved-number

# CORS Origins
CLIENT_VERCEL_PROJECTS=restaurent-app-frontend
CLIENT_ADMIN_URL=https://admin.yourrestaurant.com
CLIENT_CUSTOMER_URL=https://customer.yourrestaurant.com
```

### 2. Database Migration

```bash
npm run prisma:deploy
```

### 3. Build & Deploy

```bash
npm run build
npm run start
```

### 4. Verify Deployment

```bash
curl https://your-api-url/health
curl https://your-api-url/health/db
```

## Troubleshooting

### OTP Not Sending

**Issue:** WhatsApp OTP not received
**Solutions:**
1. Verify Twilio credentials in `.env`
2. Check WhatsApp sandbox number is connected
3. Verify phone number format (E.164)
4. Check Twilio logs: https://console.twilio.com/us/messaging/logs

### OTP Expired

**Issue:** "OTP has expired or not found" error
**Solutions:**
1. OTP valid for 10 minutes only
2. Request new OTP
3. Use "Resend OTP" button in UI

### Too Many Attempts

**Issue:** "Too many OTP attempts" error
**Solutions:**
1. Max 3 failed attempts allowed
2. Wait 10 minutes for OTP to expire
3. Request new OTP
4. Check OTP history in admin panel

### Staff Not Found

**Issue:** "Staff member not found" error
**Solutions:**
1. Verify staff exists in system
2. Confirm staff is marked as active
3. Admin must assign phone to staff first
4. Check staff role is STAFF or MANAGER

### Database Connection

**Issue:** Migration fails
**Solutions:**
1. Verify DATABASE_URL is correct
2. Check database is running
3. Verify credentials
4. For production: use `prisma migrate deploy`

## Files Modified/Created

### Backend
- ✅ `/src/routes/staff-otp.ts` - Staff OTP endpoints
- ✅ `/src/routes/admin-otp-settings.ts` - Admin settings endpoints
- ✅ `/src/app.ts` - Route registration
- ✅ `/prisma/schema.prisma` - Database models
- ✅ `/prisma/migrations/20261112084500_add_staff_otp/migration.sql` - Database migration
- ✅ `/.env.example` - Environment template

### Frontend (Admin)
- ✅ `/admin/src/pages/StaffOTPLogin.jsx` - Staff login page
- ✅ `/admin/src/components/OTPSettings.jsx` - Admin settings component
- ✅ `/admin/src/styles/StaffOTPLogin.css` - Staff login styles
- ✅ `/admin/src/styles/OTPSettings.css` - Settings styles
- ✅ `/admin/src/App.jsx` - Route addition
- ✅ `/admin/src/pages/Settings.jsx` - Integration

## Next Steps

1. ✅ Backend routes registered in app.ts
2. ✅ Twilio WhatsApp integration implemented
3. ✅ JWT token generation added
4. ✅ Frontend staff login page created
5. ✅ Frontend admin settings panel created
6. 📋 Deploy to production
7. 📋 Configure Twilio for production WhatsApp
8. 📋 Train staff on OTP login flow

## Support

For issues:
1. Check this guide's troubleshooting section
2. Review server logs
3. Check Twilio console for message delivery status
4. Verify database migrations were applied

## Version

- Feature Version: 1.0.0
- Backend: Express.js + Prisma
- Frontend: React + Vite
- Auth: JWT (access + refresh tokens)
- OTP Delivery: Twilio WhatsApp
