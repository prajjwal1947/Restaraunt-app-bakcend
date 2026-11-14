# ✅ Demo Admin Setup Complete

## 🎯 Demo Admin Account Created Successfully!

Your demo admin account has been created and is ready to use for testing and development.

### 📋 Login Credentials

```
Email:    admin@demo.example
Password: Demo@123456
```

### 🚀 Quick Start

1. **Start the backend server:**
   ```bash
   npm run dev
   ```

2. **Start the frontend admin app** (in a separate terminal):
   ```bash
   cd ../restaurant-app-frontend
   npm run dev
   ```

3. **Open the admin app in your browser:**
   - URL: [http://localhost:5173](http://localhost:5173)

4. **Login with the demo credentials above**

### 🍽️ Restaurant Details

- **Name:** Olive & Thyme Demo
- **Email:** demo@olive-thyme.example
- **ID:** 3e309cff-8b43-4936-82e2-db64b1f1dc79
- **Currency:** INR
- **Timezone:** Asia/Kolkata

### 👤 Admin User Details

- **Name:** Demo Admin
- **Email:** admin@demo.example
- **Role:** OWNER
- **ID:** 34e616f7-c2d9-4ee4-a014-e447ed806bde

### 🔧 API Information

- **Backend API:** http://localhost:4000
- **Admin App:** http://localhost:5173
- **Customer App:** http://localhost:5174

### 📚 Files Created/Modified

1. **src/create-demo-admin.ts** - Script to create demo admin accounts
2. **package.json** - Added `npm run create:admin` script
3. **DEMO_CREDENTIALS.md** - Credentials reference document
4. **.env** - Updated with secure JWT and encryption keys

### 🔐 Security Reminders

⚠️ **Important:** These are demo credentials for development only:

- Change the password after first login
- Do NOT use these credentials in production
- Do NOT commit credentials to version control
- Use strong, unique passwords for real user accounts
- Keep `.env` file secure and never share it

### 🔄 Regenerating Demo Admin

To create a new admin account or reset the password:

```bash
npm run create:admin
```

### 📖 Additional Resources

- See [DEMO_CREDENTIALS.md](./DEMO_CREDENTIALS.md) for detailed credentials
- See [.env](./env) for environment configuration
- See [QUICK_START.md](./QUICK_START.md) for complete setup guide
- Use `npm run prisma:studio` to view/manage database directly

### ✨ What You Can Do Now

With the demo admin account, you can:

- ✅ Login to the admin dashboard
- ✅ Create and manage restaurant information
- ✅ Add menu items and categories
- ✅ Manage tables
- ✅ View orders and order status
- ✅ Manage staff users
- ✅ Configure restaurant settings

### 🐛 Troubleshooting

**Login fails with "Invalid email or password":**
- Verify you're using the correct email and password
- Check that the backend server is running (`npm run dev`)
- Check the `.env` file has correct `DATABASE_URL`

**Can't connect to database:**
- Start PostgreSQL: `docker-compose up -d`
- Run migrations: `npm run prisma:migrate`
- Check DATABASE_URL in `.env`

**Forgot password:**
- Simply run `npm run create:admin` to regenerate

---

**Setup Date:** 2026-11-13  
**Status:** ✅ Ready for development
