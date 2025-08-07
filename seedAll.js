const sequelize = require('./config/database');
const seedCustomerTypes = require('./customerType/seedCustomerTypes');
const seedProductUsageTypes = require('./productUsageType/seedProductUsageTypes');

const seedAll = async () => {
  try {
    await sequelize.sync({ force: false });
    
    await seedCustomerTypes();
    await seedProductUsageTypes();
    
    console.log('✅ All seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
};

// Run if called directly
if (require.main === module) {
  seedAll();
}

module.exports = seedAll;