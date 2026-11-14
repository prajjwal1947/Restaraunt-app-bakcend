import "dotenv/config";
import { prisma } from "./lib/prisma";
import { hashPassword } from "./lib/auth";

async function createDemoAdmin() {
  try {
    // Define demo credentials
    const demoRestaurantEmail = "demo@olive-thyme.example";
    const demoRestaurantName = "Olive & Thyme Demo";
    const demoAdminEmail = "admin@demo.example";
    const demoAdminPassword = "Demo@123456";
    const demoAdminName = "Demo Admin";

    console.log("🍽️  Creating demo admin credentials for Restaurant App...\n");

    // Step 1: Create or get restaurant
    let restaurant = await prisma.restaurant.findUnique({
      where: { email: demoRestaurantEmail },
    });

    if (!restaurant) {
      console.log(`📝 Creating restaurant: ${demoRestaurantName}`);
      restaurant = await prisma.restaurant.create({
        data: {
          email: demoRestaurantEmail,
          name: demoRestaurantName,
          currency: "INR",
          timezone: "Asia/Kolkata",
        },
      });
      console.log(`✅ Restaurant created with ID: ${restaurant.id}\n`);
    } else {
      console.log(`✅ Restaurant already exists: ${restaurant.name}\n`);
    }

    // Step 2: Create or update admin user
    const passwordHash = await hashPassword(demoAdminPassword);

    let adminUser = await prisma.user.findUnique({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email: demoAdminEmail,
        },
      },
    });

    if (!adminUser) {
      console.log(`👤 Creating admin user: ${demoAdminEmail}`);
      adminUser = await prisma.user.create({
        data: {
          restaurantId: restaurant.id,
          name: demoAdminName,
          email: demoAdminEmail,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
      });
      console.log(`✅ Admin user created with ID: ${adminUser.id}\n`);
    } else {
      console.log(`⚠️  Admin user already exists, updating password...`);
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash },
      });
      console.log(`✅ Admin user updated\n`);
    }

    // Step 3: Display credentials
    console.log("═══════════════════════════════════════════════════════");
    console.log("✨ DEMO ADMIN LOGIN CREDENTIALS");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`📧 Email:       ${demoAdminEmail}`);
    console.log(`🔑 Password:    ${demoAdminPassword}`);
    console.log(`👤 Name:        ${demoAdminName}`);
    console.log(`🏪 Restaurant:  ${restaurant.name}`);
    console.log(`🎯 Role:        OWNER`);
    console.log("═══════════════════════════════════════════════════════\n");

    console.log("🔐 Security Notes:");
    console.log("   • Change this password after first login");
    console.log("   • Do not use these credentials in production");
    console.log("   • Use strong, unique passwords for real accounts\n");

    console.log("✅ Demo admin account is ready to use!");
    console.log(`🚀 Visit: http://localhost:5173 to login\n`);

  } catch (error) {
    console.error("❌ Error creating demo admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoAdmin();
