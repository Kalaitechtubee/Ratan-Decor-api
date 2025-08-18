// 5. UserType Seeder (utils/userTypeSeeder.js)
// ==========================================
const { UserType } = require('../models');

const defaultUserTypes = [
  { name: 'Residential', description: 'Individual residential customers' },
  { name: 'Commercial', description: 'Business and commercial customers' },
  { name: 'Modular Kitchen', description: 'Customers interested in modular kitchen solutions' },
  { name: 'General', description: 'Default user type' },  // Added this line
  { name: 'Others', description: 'Other types of customers' }
];

const initializeUserTypes = async () => {
  try {
    console.log('🔧 Initializing user types...');
    
    for (const typeData of defaultUserTypes) {
      const [userType, created] = await UserType.findOrCreate({
        where: { name: typeData.name },
        defaults: typeData
      });
      
      if (created) {
        console.log(`✅ Created user type: ${typeData.name}`);
      }
    }
    
    console.log('✅ User types initialization completed');
  } catch (error) {
    console.error('❌ Error initializing user types:', error);
  }
};

module.exports = { initializeUserTypes };