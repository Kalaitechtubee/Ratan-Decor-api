const { UserType, User, Category } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { generateImageUrl } = require('../utils/imageUtils');

const userTypeController = {
  // Get all active user types
  async getAllUserTypes(req, res) {
    try {
      const userTypes = await UserType.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'description', 'isActive', 'icon'],
      });

      // Process icon URLs
      const processedUserTypes = userTypes.map(userType => ({
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      }));

      res.json({
        success: true,
        data: processedUserTypes,
      });
    } catch (error) {
      console.error('Error fetching user types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user types',
        error: error.message,
      });
    }
  },

  // Get user type by ID
  async getUserTypeById(req, res) {
    try {
      const { id } = req.params;
      if (!Number.isInteger(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type ID',
        });
      }

      const userType = await UserType.findOne({
        where: { id: parseInt(id, 10), isActive: true },
        attributes: ['id', 'name', 'description', 'isActive', 'icon'],
      });

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found or inactive',
        });
      }

      // Process icon URL
      const processedUserType = {
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      };

      res.json({
        success: true,
        data: processedUserType,
      });
    } catch (error) {
      console.error('Error fetching user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user type',
        error: error.message,
      });
    }
  },

  // Create new user type (Admin/Manager only)
  async createUserType(req, res) {
    try {
      const { name, description } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'User type name is required',
        });
      }

      // Check if user type already exists (case-insensitive using LOWER for MySQL)
      const existingUserType = await UserType.findOne({
        where: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('name')),
          '=', name.trim().toLowerCase()
        ),
      });

      if (existingUserType) {
        return res.status(409).json({
          success: false,
          message: 'User type name already exists',
        });
      }

      const userType = await UserType.create({
        name: name.trim(),
        description: description?.trim() || null,
        icon: req.file ? req.file.filename : null,
        isActive: true,
      });

      // Process icon URL for response
      const processedUserType = {
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      };

      res.status(201).json({
        success: true,
        message: 'User type created successfully',
        data: {
          id: processedUserType.id,
          name: processedUserType.name,
          description: processedUserType.description,
          icon: processedUserType.icon,
          iconUrl: processedUserType.iconUrl,
          isActive: processedUserType.isActive,
        },
      });
    } catch (error) {
      console.error('Error creating user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user type',
        error: error.message,
      });
    }
  },

  // Update user type (Admin/Manager only)
  async updateUserType(req, res) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      if (!Number.isInteger(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type ID',
        });
      }

      const userType = await UserType.findByPk(parseInt(id, 10));
      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found',
        });
      }

      // Check if name is being changed and if it already exists
      if (name && name.trim() !== userType.name) {
        const existingUserType = await UserType.findOne({
          where: {
            [Op.and]: [
              Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('name')),
                '=', name.trim().toLowerCase()
              ),
              { id: { [Op.ne]: parseInt(id, 10) } }
            ]
          }
        });

        if (existingUserType) {
          return res.status(409).json({
            success: false,
            message: 'User type name already exists',
          });
        }
      }

      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (req.file) updateData.icon = req.file.filename;
      if (isActive !== undefined) {
        updateData.isActive = isActive;

        // If deactivating, check for associated users
        if (isActive === false) {
          const userCount = await User.count({
            where: { userTypeId: id },
          });
          if (userCount > 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot deactivate user type. ${userCount} user(s) are currently using it.`,
            });
          }

          // Only check categories if the Category model has userTypeId column
          // Remove this check if Category doesn't have userTypeId relationship
          try {
            const categoryCount = await Category.count({
              where: { userTypeId: id },
            });
            if (categoryCount > 0) {
              return res.status(400).json({
                success: false,
                message: `Cannot deactivate user type. ${categoryCount} category(ies) are associated with it.`,
              });
            }
          } catch (categoryError) {
            // If Category doesn't have userTypeId, skip this check
            console.warn('Category model does not have userTypeId column, skipping category check');
          }
        }
      }

      await userType.update(updateData);

      // Fetch updated user type with icon
      const updatedUserType = await UserType.findByPk(parseInt(id, 10), {
        attributes: ['id', 'name', 'description', 'isActive', 'icon'],
      });

      // Process icon URL for response
      const processedUserType = {
        ...updatedUserType.toJSON(),
        iconUrl: generateImageUrl(updatedUserType.icon, req, 'userTypes')
      };

      res.json({
        success: true,
        message: 'User type updated successfully',
        data: {
          id: processedUserType.id,
          name: processedUserType.name,
          description: processedUserType.description,
          icon: processedUserType.icon,
          iconUrl: processedUserType.iconUrl,
          isActive: processedUserType.isActive,
        },
      });
    } catch (error) {
      console.error('Error updating user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user type',
        error: error.message,
      });
    }
  },

  // Soft delete user type (Admin only)
// Soft delete user type (Admin only) with auto reassignment
async deleteUserType(req, res) {
  try {
    const { id } = req.params;
    const fallbackTypeId = 1; // 👈 Default userTypeId (e.g., Customer)

    if (!Number.isInteger(parseInt(id, 10))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type ID',
      });
    }

    const userType = await UserType.findByPk(parseInt(id, 10));
    if (!userType) {
      return res.status(404).json({
        success: false,
        message: 'User type not found',
      });
    }

    // ⚠️ Prevent deleting the fallback type itself
    if (parseInt(id, 10) === fallbackTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default user type.',
      });
    }

    // Reassign users to fallback user type
    const reassigned = await User.update(
      { userTypeId: fallbackTypeId },
      { where: { userTypeId: id } }
    );

    // Optionally also handle categories
    try {
      await Category.update(
        { userTypeId: fallbackTypeId },
        { where: { userTypeId: id } }
      );
    } catch (categoryError) {
      console.warn('Skipping category reassignment:', categoryError.message);
    }

    // Soft delete by setting isActive to false
    await userType.update({ isActive: false });

    res.json({
      success: true,
      message: `User type deleted successfully. ${reassigned[0]} user(s) reassigned to default type.`,
    });
  } catch (error) {
    console.error('Error deleting user type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user type',
      error: error.message,
    });
  }
}

};

module.exports = userTypeController;