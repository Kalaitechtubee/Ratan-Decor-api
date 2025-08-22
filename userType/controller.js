const { UserType, User, Category } = require('../models');
const { Op, Sequelize } = require('sequelize');

const userTypeController = {
  // Get all active user types
  async getAllUserTypes(req, res) {
    try {
      const userTypes = await UserType.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'description', 'isActive'],
      });

      res.json({
        success: true,
        data: userTypes,
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
        attributes: ['id', 'name', 'description', 'isActive'],
      });

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found or inactive',
        });
      }

      res.json({
        success: true,
        data: userType,
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
        isActive: true,
      });

      res.status(201).json({
        success: true,
        message: 'User type created successfully',
        data: {
          id: userType.id,
          name: userType.name,
          description: userType.description,
          isActive: userType.isActive,
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
          where: Sequelize.where(
            Sequelize.fn('LOWER', Sequelize.col('name')),
            '=', name.trim().toLowerCase()
          ),
          id: { [Op.ne]: parseInt(id, 10) },
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
      if (isActive !== undefined) {
        updateData.isActive = isActive;

        // If deactivating, check for associated users and categories
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

          const categoryCount = await Category.count({
            where: { userTypeId: id },
          });
          if (categoryCount > 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot deactivate user type. ${categoryCount} category(ies) are associated with it.`,
            });
          }
        }
      }

      await userType.update(updateData);

      res.json({
        success: true,
        message: 'User type updated successfully',
        data: {
          id: userType.id,
          name: userType.name,
          description: userType.description,
          isActive: userType.isActive,
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
  async deleteUserType(req, res) {
    try {
      const { id } = req.params;

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

      // Check if any users are using this type
      const userCount = await User.count({
        where: { userTypeId: id },
      });
      if (userCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete user type. ${userCount} user(s) are currently using it.`,
        });
      }

      // Check if any categories are using this type
      const categoryCount = await Category.count({
        where: { userTypeId: id },
      });
      if (categoryCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete user type. ${categoryCount} category(ies) are associated with it.`,
        });
      }

      // Soft delete by setting isActive to false
      await userType.update({ isActive: false });

      res.json({
        success: true,
        message: 'User type deactivated successfully',
      });
    } catch (error) {
      console.error('Error deleting user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user type',
        error: error.message,
      });
    }
  },
};

module.exports = userTypeController;