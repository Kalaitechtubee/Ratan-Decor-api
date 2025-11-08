const sequelize = require('../config/database');
const { seoConfig } = require('../config/seo');

const runDatabaseMigrations = async () => {
  try {
    // Add images column to products table
    const [imagesResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'images' AND TABLE_SCHEMA = DATABASE()
    `);
    if (imagesResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN images JSON DEFAULT (JSON_ARRAY())`);
      console.log('✅ Added images column to products table');
    }

    // Add warranty column to products table
    const [warrantyResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'warranty' AND TABLE_SCHEMA = DATABASE()
    `);
    if (warrantyResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN warranty VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added warranty column to products table');
    }

    // Add SuperAdmin role to users table
    try {
      const [enumResults] = await sequelize.query(`
        SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role' AND TABLE_SCHEMA = DATABASE()
      `);
      const columnType = enumResults[0].COLUMN_TYPE;
      if (!columnType.includes("'SuperAdmin'")) {
        await sequelize.query(`
          ALTER TABLE users MODIFY COLUMN role ENUM('customer','General','Architect','Dealer','Admin','Manager','Sales','Support','SuperAdmin') NOT NULL DEFAULT 'General'
        `);
        console.log('✅ Added SuperAdmin to users.role enum');
      }
    } catch (error) {
      console.log('⚠️  SuperAdmin role already exists or error:', error.message);
    }

    // Create and populate SEO table
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS seo (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          pageName VARCHAR(255) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          keywords TEXT,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL
        )
      `);
      console.log('✅ SEO table ready');

      for (const seo of seoConfig) {
        const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM seo WHERE pageName = ?`, { replacements: [seo.pageName] });
        if (results[0].count === 0) {
          await sequelize.query(`
            INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `, { replacements: [seo.pageName, seo.title, seo.description, seo.keywords] });
        }
      }
      console.log('✅ SEO table populated');
    } catch (error) {
      console.log('⚠️  SEO table setup skipped:', error.message);
    }
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

module.exports = { runDatabaseMigrations };
