// migrations/create-enquiries-table.js (or wherever your migration is)

async function createEnquiriesTable(connection) {
  try {
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'enquiries'"
    );

    if (tables.length === 0) {
      await connection.query(`
        CREATE TABLE enquiries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          productId INT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(255) NOT NULL,
          userType INT NULL,  -- ✅ FIXED: Changed to NULL
          message TEXT NULL,
          status ENUM('pending', 'in-progress', 'resolved', 'closed') NOT NULL DEFAULT 'pending',
          priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
          assignedTo INT NULL,
          notes TEXT NULL,
          resolutionDate DATETIME NULL,
          source ENUM('website', 'phone', 'email', 'chat', 'social-media', 'other') NOT NULL DEFAULT 'website',
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_userId (userId),
          INDEX idx_productId (productId),
          INDEX idx_status (status),
          INDEX idx_priority (priority),
          INDEX idx_assignedTo (assignedTo),
          INDEX idx_createdAt (createdAt),
          INDEX idx_userType (userType),
          
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE,
          FOREIGN KEY (userType) REFERENCES user_types(id) ON DELETE SET NULL ON UPDATE CASCADE,
          FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ Created enquiries table');
    } else {
      // If table exists, alter the column to allow NULL
      await connection.query(`
        ALTER TABLE enquiries 
        MODIFY COLUMN userType INT NULL;
      `);
      console.log('✅ Updated enquiries table - userType now allows NULL');
    }
  } catch (error) {
    console.error('❌ Error with enquiries table:', error.message);
    throw error;
  }
}

module.exports = createEnquiriesTable;