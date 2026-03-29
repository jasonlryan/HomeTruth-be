const { User } = require("../models/index");

const seedAdminUser = async () => {
  try {
    // Check if admin user already exists
    const adminExists = await User.findOne({
      where: { role: "admin" }
    });

    if (adminExists) {
      console.log("Admin user already exists!");
      console.log(`Email: ${adminExists.email}`);
      return;
    }

    // Default admin credentials (change these in production!)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@hometruth.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";

    // Create admin user (password will be hashed by User model's beforeSave hook)
    const adminUser = await User.create({
      email: adminEmail,
      password: adminPassword, // Will be automatically hashed by the model hook
      first_name: "Admin",
      last_name: "User",
      role: "admin",
      is_verified: true
    });

    console.log("Admin user created successfully!");
    console.log(`Email: ${adminUser.email}`);
    console.log(`Password: ${adminPassword}`);
    console.log("\n⚠️  IMPORTANT: Change the default password after first login!");
    
    return adminUser;
  } catch (error) {
    console.error("Error seeding admin user:", error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  seedAdminUser()
    .then(() => {
      console.log("Admin seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Admin seeding failed:", error);
      process.exit(1);
    });
}

module.exports = { seedAdminUser };

