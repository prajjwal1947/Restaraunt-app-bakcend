# ✅ OTP Authorization Error - FIXED

## Problem
The OTP flow was giving `401 UNAUTHORIZED` error when trying to access OTP settings endpoints.

### Root Cause
**Missing database migrations** - The tables required for OTP functionality (`RestaurantOTPSettings`, `StaffOTP`, `RestaurantWhatsAppConnection`) were not created in the database.

```
Error: The table `public.RestaurantOTPSettings` does not exist in the current database
```

## Solution
Run the Prisma migrations to create the required tables:

```bash
npm run prisma:deploy
```

This applies the following migrations:
- `20261112084500_add_staff_otp` - Creates StaffOTP and RestaurantOTPSettings tables
- `20261113120000_restaurant_whatsapp_connection` - Creates WhatsApp connection table

## Verification
Test the OTP endpoints:

### 1. Login to get access token:
```bash
curl -X POST 'http://localhost:4000/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@demo.example",
    "password": "Demo@123456"
  }'
```

### 2. Enable OTP settings (requires Bearer token):
```bash
curl -X PATCH 'http://localhost:4000/api/v1/settings/otp' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>' \
  -d '{"isEnabled": true}'
```

Expected response:
```json
{
  "data": {
    "restaurantId": "3e309cff-8b43-4936-82e2-db64b1f1dc79",
    "isEnabled": true,
    "createdAt": "2026-11-13T05:24:17.968Z",
    "updatedAt": "2026-11-13T05:24:17.968Z"
  }
}
```

### 3. Get OTP settings:
```bash
curl -X GET 'http://localhost:4000/api/v1/settings/otp' \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>'
```

### 4. Get WhatsApp connection:
```bash
curl -X GET 'http://localhost:4000/api/v1/settings/whatsapp' \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>'
```

## OTP Endpoints

### Admin Endpoints (Require Authentication)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| GET    | `/api/v1/settings/otp` | Get OTP settings | Yes (Bearer Token) |
| PATCH  | `/api/v1/settings/otp` | Enable/disable OTP | Yes (Bearer Token) |
| GET    | `/api/v1/settings/whatsapp` | Get WhatsApp connection | Yes (Bearer Token) |
| POST   | `/api/v1/settings/whatsapp` | Connect WhatsApp account | Yes (Bearer Token) |

### Staff Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/v1/otp/send` | Send OTP to staff phone |
| POST   | `/api/v1/otp/verify` | Verify OTP and login |

## Key Points

✅ **Authentication**: Admin OTP settings endpoints require a Bearer token
✅ **Staff Login**: Staff OTP endpoints (send/verify) don't require authentication
✅ **WhatsApp**: WhatsApp must be configured before OTP can be sent
✅ **Database**: All OTP tables are now created with proper foreign keys and indexes

## Complete OTP Flow

1. **Admin Setup** (requires login):
   ```
   Login → Get Token → Enable OTP in Settings → Connect WhatsApp Account
   ```

2. **Staff Login** (public):
   ```
   Staff enters phone → OTP sent via WhatsApp → Staff verifies OTP → Gets JWT tokens
   ```

## Troubleshooting

### Still getting "Authentication is required" error?

**Make sure:**
- ✅ You're including the `Authorization: Bearer <token>` header
- ✅ The token hasn't expired (default: 15 minutes)
- ✅ The endpoint is an admin endpoint (requires auth)

### "OTP login is not enabled" error?

**Fix:**
```bash
# Enable OTP via PATCH /api/v1/settings/otp
curl -X PATCH 'http://localhost:4000/api/v1/settings/otp' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"isEnabled": true}'
```

### "WhatsApp account not configured" error?

**Fix:**
- Configure WhatsApp connection in admin settings
- Use valid Meta Graph API credentials
- Ensure WhatsApp Business account has approved OTP template

## Database Schema

### RestaurantOTPSettings Table
```sql
CREATE TABLE "RestaurantOTPSettings" (
    "restaurantId" UUID PRIMARY KEY,
    "isEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP
);
```

### StaffOTP Table
```sql
CREATE TABLE "StaffOTP" (
    "id" UUID PRIMARY KEY,
    "restaurantId" UUID,
    "phone" TEXT NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "attempts" INTEGER DEFAULT 0,
    "maxAttempts" INTEGER DEFAULT 3,
    "expiresAt" TIMESTAMP,
    "verifiedAt" TIMESTAMP,
    "createdAt" TIMESTAMP
);
```

### RestaurantWhatsAppConnection Table
```sql
CREATE TABLE "RestaurantWhatsAppConnection" (
    "restaurantId" UUID PRIMARY KEY,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP
);
```

## Next Steps

1. ✅ Run migrations: `npm run prisma:deploy`
2. ✅ Get admin token from login endpoint
3. ✅ Enable OTP via PATCH settings
4. ✅ Configure WhatsApp connection
5. ✅ Test staff OTP flow

---

**Status**: ✅ FIXED  
**Date**: 2026-11-13  
**Tested**: All OTP endpoints working correctly
