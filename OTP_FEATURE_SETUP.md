# Staff OTP-Based Ordering Feature

## Overview
Admins can enable/disable OTP-based login for staff ordering. Staff enter their phone number, receive an OTP via WhatsApp, verify it, and gain access to the ordering interface.

## Database Schema

### RestaurantOTPSettings
```
- restaurantId (UUID, PK)
- isEnabled (Boolean) - Toggle feature on/off
- createdAt, updatedAt
```

### StaffOTP
```
- id (UUID, PK)
- restaurantId (FK)
- phone (String)
- otp (String, 6 digits)
- attempts (Int)
- maxAttempts (Int, default 3)
- expiresAt (DateTime, 10 minutes)
- verifiedAt (DateTime, nullable)
- createdAt
```

## Backend API Endpoints

### Staff Endpoints (Public)
```
POST /api/v1/otp/send
- body: { restaurantId, phone }
- response: { message, phone (masked) }

POST /api/v1/otp/verify
- body: { restaurantId, phone, otp }
- response: { user: { id, name, phone, role, restaurantId } }
```

### Admin Endpoints (Protected)
```
GET /api/v1/settings/otp
- response: { isEnabled, createdAt, updatedAt }

PATCH /api/v1/settings/otp
- body: { isEnabled }
- response: OTP settings

GET /api/v1/staff
- response: [ { id, name, email, phone, role, isActive } ]

PATCH /api/v1/staff/:staffId/phone
- body: { phone }
- response: Updated staff user

GET /api/v1/otp-history
- response: [ { phone, attempts, maxAttempts, verifiedAt, expiresAt, createdAt } ]
```

## Integration Steps

### 1. Register Routes in app.ts
```typescript
import { staffOtpRouter } from "./routes/staff-otp";
import { adminOtpRouter } from "./routes/admin-otp-settings";

app.use("/api/v1", staffOtpRouter);
app.use("/api/v1", adminOtpRouter);
```

### 2. Database Migration
```bash
# Run migration
cd prisma/migrations/20261112084500_add_staff_otp
psql -U postgres -d restaurant < migration.sql

# OR use Prisma
npx prisma db push --accept-data-loss
```

### 3. WhatsApp Integration (TODO)
Add WhatsApp API integration to send OTP:
```typescript
// In staff-otp.ts, replace TODO comment
async function sendWhatsAppOTP(phone: string, otp: string) {
  // Call WhatsApp Business API
  // Example: Twilio, Meta WhatsApp Business API, etc.
}
```

### 4. JWT Token Generation (TODO)
Generate JWT for verified staff:
```typescript
// In staff-otp.ts, replace TODO comment
const token = generateToken(staff);
```

## Frontend Implementation

### Staff Login Screen
```jsx
<OTPLoginForm
  onSendOTP={(phone) => POST /otp/send { restaurantId, phone }}
  onVerifyOTP={(phone, otp) => POST /otp/verify { restaurantId, phone, otp }}
/>
```

### Admin Settings Panel
```jsx
<OTPSettings
  enabled={otpSettings.isEnabled}
  onToggle={(isEnabled) => PATCH /settings/otp { isEnabled }}
/>

<StaffList
  staff={staffList}
  onUpdatePhone={(staffId, phone) => PATCH /staff/{staffId}/phone { phone }}
/>

<OTPHistory otpAttempts={otpHistory} />
```

## Security Features

✅ 6-digit OTP (10-minute expiry)
✅ Max 3 failed attempts
✅ Phone validation
✅ Staff existence verification
✅ OTP stored separately from user password
✅ Can be enabled/disabled by admin

## Testing

### Test OTP Send
```bash
curl -X POST http://localhost:4000/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "phone": "+919876543210"
  }'
```

### Test OTP Verify
```bash
curl -X POST http://localhost:4000/api/v1/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "phone": "+919876543210",
    "otp": "123456"
  }'
```

### Test Admin Settings
```bash
# Get settings
curl -X GET http://localhost:4000/api/v1/settings/otp \
  -H "Authorization: Bearer {token}"

# Enable OTP
curl -X PATCH http://localhost:4000/api/v1/settings/otp \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "isEnabled": true }'
```

## Next Steps

1. ✅ Database schema (DONE)
2. ✅ Backend API routes (DONE)
3. ⏳ WhatsApp integration
4. ⏳ JWT token generation
5. ⏳ Frontend staff login screen
6. ⏳ Frontend admin settings panel
7. ⏳ Testing & deployment

## Files Created
- `/src/routes/staff-otp.ts` - Staff OTP endpoints
- `/src/routes/admin-otp-settings.ts` - Admin OTP settings
- `/prisma/migrations/20261112084500_add_staff_otp/migration.sql` - Database migration
- `/prisma/schema.prisma` - Updated schema with OTP models
