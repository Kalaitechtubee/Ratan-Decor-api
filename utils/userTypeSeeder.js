const { UserType, User } = require('../models');

const seedUserTypes = async () => {
  try {
    console.log('🌱 Seeding user types...');

    const defaultUserTypes = [
      { id: 1, name: 'General', description: 'General user type', isActive: true },
      { id: 2, name: 'Customer', description: 'Regular customer', isActive: true },
      { id: 3, name: 'Architect', description: 'Architect user type', isActive: true },
      { id: 4, name: 'Dealer', description: 'Dealer user type', isActive: true },
      { id: 5, name: 'Admin', description: 'Administrator', isActive: true },
      { id: 6, name: 'Manager', description: 'Manager user type', isActive: true },
      { id: 7, name: 'Sales', description: 'Sales representative', isActive: true },
      { id: 8, name: 'Support', description: 'Support staff', isActive: true },
      { id: 9, name: 'SuperAdmin', description: 'Super administrator', isActive: true }
    ];

    // Get all existing user type IDs
    const existingUserTypes = await UserType.findAll({ attributes: ['id'] });
    const existingIds = existingUserTypes.map(ut => ut.id);

    // Get all userTypeIds used in users table
    const usersWithTypes = await User.findAll({
      attributes: ['userTypeId'],
      where: { userTypeId: { [require('sequelize').Op.ne]: null } }
    });
    const usedUserTypeIds = [...new Set(usersWithTypes.map(u => u.userTypeId))];

    // Find missing user types
    const missingIds = usedUserTypeIds.filter(id => !existingIds.includes(id));

    if (missingIds.length > 0) {
      console.log(`🔧 Found missing user types with IDs: ${missingIds.join(', ')}`);

      // Create missing user types
      for (const id of missingIds) {
        const defaultType = defaultUserTypes.find(ut => ut.id === id);
        if (defaultType) {
          try {
            await UserType.create(defaultType);
            console.log(`✅ Created missing user type: ${defaultType.name} (ID: ${id})`);
          } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
              console.log(`User type ID ${id} already exists, skipping...`);
              continue;
            }
            throw createError;
          }
        } else {
          // Create a generic user type for missing ID
          try {
            await UserType.create({
              id: id,
              name: `User Type ${id}`,
              description: `Auto-generated user type for ID ${id}`,
              isActive: true
            });
            console.log(`✅ Created generic user type for ID: ${id}`);
          } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
              console.log(`User type ID ${id} already exists, skipping...`);
              continue;
            }
            throw createError;
          }
        }
      }
    } else {
      console.log('✅ All required user types exist');
    }

    // Ensure default user types exist (for future use)
    for (const userType of defaultUserTypes) {
      if (!existingIds.includes(userType.id)) {
        try {
          await UserType.create(userType);
          console.log(`✅ Created default user type: ${userType.name}`);
        } catch (createError) {
          if (createError.name === 'SequelizeUniqueConstraintError') {
            console.log(`User type ${userType.name} already exists, skipping...`);
            continue;
          }
          throw createError;
        }
      }
    }

    console.log('✅ User types seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding user types:', error);
    throw error;
  }
};

module.exports = { seedUserTypes };
