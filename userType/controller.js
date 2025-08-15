const { UserType, User } = require('../models');
const { Op } = require('sequelize');

const userTypeController = {
  // Get all user types
  async getAllUserTypes(req, res) {
    try {
      const userTypes = await UserType.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: userTypes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user types',
        error: error.message
      });
    }
  },

  // Get user type by ID
  async getUserTypeById(req, res) {
    try {
      const { id } = req.params;
      const userType = await UserType.findByPk(id);

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found'
        });
      }

      res.json({
        success: true,
        data: userType
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user type',
        error: error.message
      });
    }
  },

  // Create new user type
  async createUserType(req, res) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'User type name is required'
        });
      }

      // Check if user type already exists
      const existingUserType = await UserType.findOne({
        where: { name: { [Op.iLike]: name } }
      });

      if (existingUserType) {
        return res.status(400).json({
          success: false,
          message: 'User type already exists'
        });
      }

      const userType = await UserType.create({
        name,
        description,
        isActive: true
      });

      res.status(201).json({
        success: true,
        message: 'User type created successfully',
        data: userType
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating user type',
        error: error.message
      });
    }
  },

  // Update user type
  async updateUserType(req, res) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const userType = await UserType.findByPk(id);
      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found'
        });
      }

      // Check if name is being changed and if it already exists
      if (name && name !== userType.name) {
        const existingUserType = await UserType.findOne({
          where: { 
            name: { [Op.iLike]: name }, 
            id: { [Op.ne]: id } 
          }
        });

        if (existingUserType) {
          return res.status(400).json({
            success: false,
            message: 'User type name already exists'
          });
        }
      }

      await userType.update({
        name: name || userType.name,
        description: description !== undefined ? description : userType.description,
        isActive: isActive !== undefined ? isActive : userType.isActive
      });

      res.json({
        success: true,
        message: 'User type updated successfully',
        data: userType
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating user type',
        error: error.message
      });
    }
  },

  // Delete user type (soft delete)
  async deleteUserType(req, res) {
    try {
      const { id } = req.params;
      const userType = await UserType.findByPk(id);

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found'
        });
      }

      // Check if any users are using this type
      const userCount = await User.count({
        where: { userTypeId: id }
      });

      if (userCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete user type. ${userCount} user(s) are currently using it.`
        });
      }

      // Soft delete by setting isActive to false
      await userType.update({ isActive: false });

      res.json({
        success: true,
        message: 'User type deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting user type',
        error: error.message
      });
    }
  },

  // Get user type statistics
  async getUserTypeStats(req, res) {
    try {
      const stats = await UserType.findAll({
        attributes: [
          'id',
          'name',
          [require('sequelize').fn('COUNT', require('sequelize').col('Users.id')), 'userCount']
        ],
        include: [
          {
            model: User,
            as: 'Users',
            attributes: [],
            required: false
          }
        ],
        group: ['UserType.id', 'UserType.name'],
        where: { isActive: true }
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user type statistics',
        error: error.message
      });
    }
  },

  // Set user type for a specific user
  async setUserTypeForUser(req, res) {
    try {
      const { userId, userTypeId } = req.body;

      if (!userId || !userTypeId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and User Type ID are required'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userType = await UserType.findByPk(userTypeId);
      if (!userType || !userType.isActive) {
        return res.status(404).json({
          success: false,
          message: 'User type not found or inactive'
        });
      }

      await user.update({ userTypeId });

      res.json({
        success: true,
        message: 'User type set successfully',
        data: {
          userId: user.id,
          userTypeId: userType.id,
          userTypeName: userType.name
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error setting user type',
        error: error.message
      });
    }
  }
};

module.exports = userTypeController;
