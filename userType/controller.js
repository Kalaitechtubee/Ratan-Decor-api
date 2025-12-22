
const { UserType, User, Category } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { generateImageUrl } = require('../middleware/upload');

const userTypeController = {

  async getAllUserTypes(req, res) {
    try {
      const userTypes = await UserType.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'description', 'isActive', 'icon']
      });

      const processedUserTypes = userTypes.map(userType => ({
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      }));

      res.json({
        success: true,
        data: processedUserTypes
      });
    } catch (error) {
      console.error('Error fetching user types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user types',
        error: error.message
      });
    }
  },


  async getUserTypeById(req, res) {
    try {
      const { id } = req.params;

      if (!Number.isInteger(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type ID'
        });
      }

      const userType = await UserType.findOne({
        where: { id: parseInt(id, 10), isActive: true },
        attributes: ['id', 'name', 'description', 'isActive', 'icon']
      });

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found or inactive'
        });
      }

      const processedUserType = {
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      };

      res.json({
        success: true,
        data: processedUserType
      });
    } catch (error) {
      console.error('Error fetching user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user type',
        error: error.message
      });
    }
  },

  async createUserType(req, res) {
    try {
      const { name, description } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'User type name is required'
        });
      }

      // Check if user type already exists (case-insensitive)
      const existingUserType = await UserType.findOne({
        where: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('name')),
          '=',
          name.trim().toLowerCase()
        )
      });

      if (existingUserType) {
        return res.status(409).json({
          success: false,
          message: 'User type name already exists'
        });
      }

      const userType = await UserType.create({
        name: name.trim(),
        description: description?.trim() || null,
        icon: req.file ? req.file.filename : null,
        isActive: true
      });

      const processedUserType = {
        ...userType.toJSON(),
        iconUrl: generateImageUrl(userType.icon, req, 'userTypes')
      };

      res.status(201).json({
        success: true,
        message: 'User type created successfully',
        data: processedUserType
      });
    } catch (error) {
      console.error('Error creating user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user type',
        error: error.message
      });
    }
  },


  async updateUserType(req, res) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      if (!Number.isInteger(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type ID'
        });
      }

      const userType = await UserType.findByPk(parseInt(id, 10));

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found'
        });
      }

      // Check if name is being changed and already exists
      if (name && name.trim() !== userType.name) {
        const existingUserType = await UserType.findOne({
          where: {
            [Op.and]: [
              Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('name')),
                '=',
                name.trim().toLowerCase()
              ),
              { id: { [Op.ne]: parseInt(id, 10) } }
            ]
          }
        });

        if (existingUserType) {
          return res.status(409).json({
            success: false,
            message: 'User type name already exists'
          });
        }
      }


      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (req.file) updateData.icon = req.file.filename;

      if (isActive !== undefined) {

        if (isActive === false) {
          const userCount = await User.count({ where: { userTypeId: id } });

          if (userCount > 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot deactivate user type. ${userCount} user(s) are currently using it.`
            });
          }


          try {
            const categoryCount = await Category.count({ where: { userTypeId: id } });

            if (categoryCount > 0) {
              return res.status(400).json({
                success: false,
                message: `Cannot deactivate user type. ${categoryCount} category(ies) are associated with it.`
              });
            }
          } catch (categoryError) {
            console.warn('Category check skipped - userTypeId column may not exist');
          }
        }
        updateData.isActive = isActive;
      }

      await userType.update(updateData);


      const updatedUserType = await UserType.findByPk(parseInt(id, 10), {
        attributes: ['id', 'name', 'description', 'isActive', 'icon']
      });

      const processedUserType = {
        ...updatedUserType.toJSON(),
        iconUrl: generateImageUrl(updatedUserType.icon, req, 'userTypes')
      };

      res.json({
        success: true,
        message: 'User type updated successfully',
        data: processedUserType
      });
    } catch (error) {
      console.error('Error updating user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user type',
        error: error.message
      });
    }
  },


  async deleteUserType(req, res) {
    try {
      const { id } = req.params;
      const targetId = parseInt(id, 10);

      if (!Number.isInteger(targetId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type ID'
        });
      }

      const userType = await UserType.findByPk(targetId);

      if (!userType) {
        return res.status(404).json({
          success: false,
          message: 'User type not found'
        });
      }

      // Find an alternative active user type to act as fallback
      const fallbackType = await UserType.findOne({
        where: {
          id: { [Op.ne]: targetId },
          isActive: true
        },
        attributes: ['id']
      });

      const fallbackTypeId = fallbackType ? fallbackType.id : null;

      // Reassign users to the fallback type (or null if no fallback)
      const [reassignedUsers] = await User.update(
        { userTypeId: fallbackTypeId },
        { where: { userTypeId: targetId } }
      );

      // Reassign categories to the fallback type
      let reassignedCategories = 0;
      try {
        const [count] = await Category.update(
          { userTypeId: fallbackTypeId },
          { where: { userTypeId: targetId } }
        );
        reassignedCategories = count;
      } catch (categoryError) {
        console.warn('Category reassignment skipped:', categoryError.message);
      }

      // Reassign enquiries to the fallback type
      let reassignedEnquiries = 0;
      try {
        const [count] = await sequelize.models.Enquiry.update(
          { userType: fallbackTypeId },
          { where: { userType: targetId } }
        );
        reassignedEnquiries = count;
      } catch (enquiryError) {
        console.warn('Enquiry reassignment skipped:', enquiryError.message);
      }

      // Deactivate the user type
      await userType.update({ isActive: false });

      const fallbackMsg = fallbackTypeId
        ? `reassigned to default type (ID: ${fallbackTypeId}).`
        : "updated to null (no fallback user type available).";

      res.json({
        success: true,
        message: `User type deleted successfully. ${reassignedUsers} user(s) ${fallbackMsg}`,
        data: {
          reassignedUsers,
          reassignedCategories,
          reassignedEnquiries,
          fallbackTypeId
        }
      });
    } catch (error) {
      console.error('Error deleting user type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user type',
        error: error.message
      });
    }
  }
};

module.exports = userTypeController;