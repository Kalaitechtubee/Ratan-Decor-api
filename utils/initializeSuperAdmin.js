// utils/initializeSuperAdmin.js
const bcrypt = require('bcrypt');
const { User, UserType } = require('../models');

const initializeSuperAdmin = async () => {
  try {
    console.log('🔍 Checking for SuperAdmin user...');

    // Get credentials from env (with fallbacks)
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
    const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Super Administrator';

    // Ensure SuperAdmin UserType exists
    let superAdminUserType = await UserType.findOne({ where: { name: 'SuperAdmin' } });
    if (!superAdminUserType) {
      console.log('📝 Creating SuperAdmin UserType...');
      superAdminUserType = await UserType.create({
        name: 'SuperAdmin',
        description: 'Super Administrator - Developer access',
        isActive: true
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

    // Find or create user by EMAIL (avoids duplicate constraint error)
    const [superAdminUser, created] = await User.findOrCreate({
      where: { email: SUPERADMIN_EMAIL },
      defaults: {
        name: SUPERADMIN_NAME,
        email: SUPERADMIN_EMAIL,
        password: hashedPassword,
        role: 'SuperAdmin',
        status: 'Approved',
        mobile: '0000000000',
        country: 'India',
        state: 'Tamil Nadu',
        city: 'Chennai',
        address: 'System Generated',
        company: 'Ratan Decor',
        userTypeId: superAdminUserType.id
      }
    });

    if (created) {
      console.log('✅ SuperAdmin created successfully!');
      console.log('📧 Email:', SUPERADMIN_EMAIL);
      console.log('🔑 Password:', SUPERADMIN_PASSWORD);
      console.log('⚠️ Please change the password after first login!');
    } else {
      console.log('✅ SuperAdmin already exists:', superAdminUser.email);
    }

    return superAdminUser;

  } catch (error) {
    console.error('❌ Failed to initialize SuperAdmin:', error);
    throw error;
  }
};

module.exports = { initializeSuperAdmin };
