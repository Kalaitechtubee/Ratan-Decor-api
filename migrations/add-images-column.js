// migrations/add-images-column.js
// Create this file in your migrations folder and run it manually or through Sequelize CLI

const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('products');
      
      if (!tableDescription.images) {
        await queryInterface.addColumn('products', 'images', {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
        });
        console.log('✅ Images column added successfully');
      } else {
        console.log('✅ Images column already exists');
      }
    } catch (error) {
      console.error('❌ Error adding images column:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('products', 'images');
      console.log('✅ Images column removed successfully');
    } catch (error) {
      console.error('❌ Error removing images column:', error);
      throw error;
    }
  }
};

// Alternative: Direct SQL execution function
// You can also run this directly in your MySQL client or through a script

const addImagesColumnSQL = `
-- Check if column exists and add it if not
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'products' 
  AND COLUMN_NAME = 'images' 
  AND TABLE_SCHEMA = DATABASE();

SET @sql = CASE 
  WHEN @col_exists = 0 THEN 
    'ALTER TABLE products ADD COLUMN images JSON DEFAULT (JSON_ARRAY())'
  ELSE 
    'SELECT "Images column already exists" as message'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
`;

// Manual migration runner
const runMigration = async (sequelize) => {
  try {
    console.log('🔧 Running images column migration...');
    
    // Check if column exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'images'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length === 0) {
      // Column doesn't exist, add it
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN images JSON DEFAULT (JSON_ARRAY())
      `);
      console.log('✅ Images column added successfully');
    } else {
      console.log('✅ Images column already exists');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
};

module.exports = {
  addImagesColumnSQL,
  runMigration
};