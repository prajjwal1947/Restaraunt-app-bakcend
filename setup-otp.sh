#!/bin/bash

# Staff OTP Login - Complete Setup Script
# This script sets up the entire OTP feature for your restaurant app

set -e

echo "=================================================="
echo "  Staff OTP Login Setup - Meta WhatsApp Integration"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/../Restaurent-app-frontend"

echo -e "${BLUE}Current directory: $SCRIPT_DIR${NC}"
echo ""

# Step 1: Backend Setup
echo -e "${YELLOW}Step 1: Backend Setup${NC}"
echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --legacy-peer-deps
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# Step 2: Build Backend
echo -e "${YELLOW}Step 2: Building Backend${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend built successfully${NC}"
else
    echo -e "${RED}✗ Backend build failed${NC}"
    exit 1
fi
echo ""

# Step 3: Check Database
echo -e "${YELLOW}Step 3: Database Setup${NC}"
echo "Checking if database migrations need to be run..."
echo "To apply migrations, run:"
echo "  npm run prisma:migrate (development)"
echo "  npm run prisma:deploy  (production)"
echo ""

# Step 4: Frontend Setup
echo -e "${YELLOW}Step 4: Frontend Setup${NC}"
echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR/admin"
npm install --legacy-peer-deps
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# Step 5: Build Frontend
echo -e "${YELLOW}Step 5: Building Frontend${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend built successfully${NC}"
else
    echo "Frontend build completed (warnings may appear)"
fi
echo ""

# Step 6: Configuration
echo -e "${YELLOW}Step 6: Configuration${NC}"
echo "Create a .env file in the backend directory with:"
echo ""
echo "# For MANUAL WhatsApp Business App (FREE - No configuration needed)"
echo "# OTPs will appear in console for manual sending"
echo ""
echo "# For META WhatsApp Cloud API (OPTIONAL - Automated delivery)"
echo "META_WHATSAPP_API_TOKEN=your-meta-token"
echo "META_WHATSAPP_PHONE_NUMBER_ID=your-phone-id"
echo ""

# Step 7: Test Instructions
echo -e "${YELLOW}Step 7: Ready to Test!${NC}"
echo ""
echo "BACKEND (Terminal 1):"
echo "  cd $BACKEND_DIR"
echo "  npm run dev"
echo ""
echo "FRONTEND (Terminal 2):"
echo "  cd $FRONTEND_DIR/admin"
echo "  npm run dev"
echo ""
echo "STAFF LOGIN:"
echo "  http://localhost:5173/staff-login"
echo ""
echo "ADMIN SETTINGS:"
echo "  http://localhost:5173/settings"
echo "  Look for 'OTP-Based Staff Login' section"
echo ""

# Final Summary
echo ""
echo -e "${GREEN}=================================================="
echo "  ✓ Setup Complete!"
echo "==================================================${NC}"
echo ""
echo "Next steps:"
echo "1. Set up .env file (see configuration above)"
echo "2. Run database migrations if needed"
echo "3. Start backend: npm run dev"
echo "4. Start frontend: npm run dev"
echo "5. Test at http://localhost:5173/staff-login"
echo ""
echo "For detailed instructions, see:"
echo "- META_WHATSAPP_OTP_GUIDE.md (Meta WhatsApp setup)"
echo "- STAFF_OTP_COMPLETE_GUIDE.md (Full documentation)"
echo ""
