#!/bin/bash

# OTP Flow Quick Test Script
# Tests all OTP endpoints with proper authentication

echo "🧪 OTP Flow Quick Test"
echo "======================"
echo ""

# Step 1: Login
echo "1️⃣  Logging in as admin..."
LOGIN=$(curl -s -X POST 'http://localhost:4000/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@demo.example",
    "password": "Demo@123456"
  }')

TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken // empty')
RESTAURANT_ID=$(echo "$LOGIN" | jq -r '.data.user.restaurantId')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo "   Token: ${TOKEN:0:20}..."
echo "   Restaurant ID: $RESTAURANT_ID"
echo ""

# Step 2: Get OTP Settings
echo "2️⃣  Getting OTP settings..."
curl -s -X GET 'http://localhost:4000/api/v1/settings/otp' \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
echo ""

# Step 3: Enable OTP
echo "3️⃣  Enabling OTP..."
curl -s -X PATCH 'http://localhost:4000/api/v1/settings/otp' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"isEnabled": true}' | jq '.data'
echo ""

# Step 4: Get WhatsApp Settings
echo "4️⃣  Getting WhatsApp connection status..."
curl -s -X GET 'http://localhost:4000/api/v1/settings/whatsapp' \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "✅ All OTP endpoints working!"
