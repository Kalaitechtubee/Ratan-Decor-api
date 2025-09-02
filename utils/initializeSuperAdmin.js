// utils/initializeSuperAdmin.js - Auto-create SuperAdmin on startup
const bcrypt = require('bcrypt');
const { User, UserType } = require('../models');

const initializeSuperAdmin = async () => {
  try {
    console.log('🔍 Checking for SuperAdmin user...');
    
    // Check if any SuperAdmin exists
    const existingSuperAdmin = await User.findOne({ 
      where: { role: 'SuperAdmin' } 
    });

    if (existingSuperAdmin) {
      console.log('✅ SuperAdmin already exists:', existingSuperAdmin.email);
      return;
    }

    console.log('🔧 No SuperAdmin found. Creating default SuperAdmin...');

    // Get SuperAdmin credentials from environment
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

    // Hash the password
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

    // Create SuperAdmin user
    const superAdminUser = await User.create({
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
      company: 'Ratan Decor'
    });

    console.log('✅ SuperAdmin created successfully!');
    console.log('📧 Email:', SUPERADMIN_EMAIL);
    console.log('🔑 Password:', SUPERADMIN_PASSWORD);
    console.log('⚠️  Please change the password after first login!');

    return superAdminUser;

  } catch (error) {
    console.error('❌ Failed to initialize SuperAdmin:', error);
    throw error;
  }
};

module.exports = { initializeSuperAdmin };