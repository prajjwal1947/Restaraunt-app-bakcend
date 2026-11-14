# 🍽️ Demo Admin Credentials

## Admin Login Details

| Field | Value |
|-------|-------|
| **Email** | `admin@demo.example` |
| **Password** | `Demo@123456` |
| **Name** | Demo Admin |
| **Restaurant** | Olive & Thyme Demo |
| **Role** | OWNER |

## How to Use

1. **Start the backend server:**
   ```bash
   npm run dev
   ```

2. **Start the admin frontend:**
   ```bash
   cd ../restaurant-app-frontend
   npm run dev
   ```

3. **Visit the admin app:**
   - Open [http://localhost:5173](http://localhost:5173)

4. **Login with demo credentials:**
   - Email: `admin@demo.example`
   - Password: `Demo@123456`

## Restaurant Details

| Field | Value |
|-------|-------|
| **Restaurant Name** | Olive & Thyme Demo |
| **Email** | demo@olive-thyme.example |
| **Restaurant ID** | `3e309cff-8b43-4936-82e2-db64b1f1dc79` |
| **Currency** | INR |
| **Timezone** | Asia/Kolkata |

## Admin User Details

| Field | Value |
|-------|-------|
| **User ID** | `34e616f7-c2d9-4ee4-a014-e447ed806bde` |
| **Email** | admin@demo.example |
| **Name** | Demo Admin |
| **Role** | OWNER |

## API Base URL

- **Base URL:** `http://localhost:4000`
- **Admin App:** `http://localhost:5173`
- **Customer App:** `http://localhost:5174`

## 🔐 Security Notes

- ⚠️ **Change the password immediately after first login**
- ⚠️ **Do NOT use these credentials in production**
- ⚠️ **Do NOT commit credentials to version control**
- ⚠️ **Use strong, unique passwords for real accounts**

## Creating Additional Admin Users

To create more demo users, edit `src/create-demo-admin.ts` or use Prisma Studio:

```bash
npm run prisma:studio
```

## Regenerating Demo Admin

To reset/regenerate the demo admin account with a fresh password:

```bash
npm run create:admin
```

This will:
- Update the existing admin password, OR
- Create a new admin account if it doesn't exist

---

**Last Generated:** 2026-11-13
