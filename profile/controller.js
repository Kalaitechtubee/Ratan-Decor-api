const { User, Order, OrderItem, Product, Category, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const {
  processOrderProductData,
  calculateUserPrice,
  getFallbackImageUrl,
} = require('../utils/imageUtils');

const getProfile = async (req, res) => {
  try {
    console.log('=== DEBUG INFO ===');
    console.log('req.user:', req.user);
    console.log('req.user.id:', req.user?.id);

    // Check if req.user exists and has id
    if (!req.user || !req.user.id) {
      return res.status(400).json({
        message: 'User ID not found in token',
        debug: {
          hasReqUser: !!req.user,
          reqUserKeys: req.user ? Object.keys(req.user) : []
        }
      });
    }

    const userId = req.user.id; // Changed from req.user.userId to req.user.id
    console.log('Looking for user with ID:', userId);

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        message: `User not found with ID: ${userId}`,
        searchedId: userId
      });
    }

    console.log('User found:', user.dataValues);
    res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id; // Changed from req.user?.userId to req.user?.id

    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in token' });
    }

    const { name, email, mobile, address, country, state, city, pincode, company } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (address !== undefined) updateData.address = address;
    if (country !== undefined) updateData.country = country;
    if (state !== undefined) updateData.state = state;
    if (city !== undefined) updateData.city = city;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (company !== undefined) updateData.company = company;

    await user.update(updateData);

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProfileOrderHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;

    // Check if user can access this data (consistent with middleware)
    const allowedRoles = ['admin', 'manager', 'sales', 'support'];
    if (!allowedRoles.includes(req.user.role) && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'orderDate',
      sortOrder = 'DESC'
    } = req.query;

    const where = { userId: userId };

    if (status) {
      where.status = Array.isArray(status) ? { [Op.in]: status } : status;
    }
    if (paymentStatus) {
      where.paymentStatus = Array.isArray(paymentStatus) ? { [Op.in]: paymentStatus } : paymentStatus;
    }
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate[Op.gte] = new Date(startDate);
      if (endDate) where.orderDate[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          include: [{
            model: Product,
            as: 'product',
            attributes: [
              'id', 'name', 'description',
              'image', 'images',
              'generalPrice', 'dealerPrice', 'architectPrice',
              'isActive', 'colors', 'specifications'
            ],
            include: [{
              model: Category,
              as: 'category',
              attributes: ['id', 'name', 'parentId'],
              required: false
            }]
          }]
        },
        {
          model: ShippingAddress,
          as: 'shippingAddress',
          required: false
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role', 'mobile', 'address', 'city', 'state', 'country', 'pincode'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();

      let deliveryAddress = null;
      if (orderData.deliveryAddressData) {
        try {
          deliveryAddress = {
            type: orderData.deliveryAddressType || 'unknown',
            data: typeof orderData.deliveryAddressData === 'string'
              ? JSON.parse(orderData.deliveryAddressData)
              : orderData.deliveryAddressData
          };
        } catch (e) {
          console.warn('Failed to parse delivery address data:', e);
        }
      }

      if (!deliveryAddress) {
        if (orderData.shippingAddress) {
          deliveryAddress = {
            type: 'shipping',
            data: {
              name: orderData.shippingAddress.name,
              phone: orderData.shippingAddress.phone,
              address: orderData.shippingAddress.address,
              city: orderData.shippingAddress.city,
              state: orderData.shippingAddress.state,
              country: orderData.shippingAddress.country,
              pincode: orderData.shippingAddress.pincode,
              addressType: orderData.shippingAddress.addressType
            }
          };
        } else if (orderData.user) {
          deliveryAddress = {
            type: 'default',
            data: {
              name: orderData.user.name,
              phone: orderData.user.mobile || 'Not provided',
              address: orderData.user.address,
              city: orderData.user.city,
              state: orderData.user.state,
              country: orderData.user.country,
              pincode: orderData.user.pincode,
              source: 'user_profile'
            }
          };
        }
      }

      orderData.deliveryAddress = deliveryAddress;

      if (orderData.orderItems) {
        orderData.orderItems = orderData.orderItems.map(item => {
          const itemData = { ...item };
          if (item.product) {
            const processedProduct = processOrderProductData(item.product, req, req.user.role);

            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
              imageUrls: processedProduct.imageUrls || [],
              currentPrice: calculateUserPrice(item.product, req.user.role),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, req.user.role) - item.price).toFixed(2)),
              isActive: item.product.isActive,
              colors: processedProduct.colors || [],
              specifications: processedProduct.specifications || {},
              category: item.product.category ? {
                id: item.product.category.id,
                name: item.product.category.name,
                parentId: item.product.category.parentId
              } : null
            };
          }
          return itemData;
        });
      }

      return orderData;
    });

    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

    const statusStats = await Order.findAll({
      where: { userId: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['status'],
      raw: true
    });

    statusStats.forEach(stat => {
      orderSummary.statusBreakdown[stat.status] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    const paymentStats = await Order.findAll({
      where: { userId: userId },
      attributes: [
        'paymentStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['paymentStatus'],
      raw: true
    });

    paymentStats.forEach(stat => {
      orderSummary.paymentStatusBreakdown[stat.paymentStatus] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    res.json({
      success: true,
      orders: processedOrders,
      orderSummary: orderSummary,
      filters: { status, paymentStatus, startDate, endDate },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      sorting: { sortBy, sortOrder }
    });

  } catch (error) {
    console.error('GET PROFILE ORDER HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile order history',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getProfileOrderHistoryById = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user can access this data (consistent with middleware)
    const allowedRoles = ['admin', 'manager', 'sales', 'support'];
    if (!allowedRoles.includes(req.user.role) && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'orderDate',
      sortOrder = 'DESC'
    } = req.query;

    const where = { userId: userId };

    if (status) {
      where.status = Array.isArray(status) ? { [Op.in]: status } : status;
    }
    if (paymentStatus) {
      where.paymentStatus = Array.isArray(paymentStatus) ? { [Op.in]: paymentStatus } : paymentStatus;
    }
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate[Op.gte] = new Date(startDate);
      if (endDate) where.orderDate[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          include: [{
            model: Product,
            as: 'product',
            attributes: [
              'id', 'name', 'description',
              'image', 'images',
              'generalPrice', 'dealerPrice', 'architectPrice',
              'isActive', 'colors', 'specifications'
            ],
            include: [{
              model: Category,
              as: 'category',
              attributes: ['id', 'name', 'parentId'],
              required: false
            }]
          }]
        },
        {
          model: ShippingAddress,
          as: 'shippingAddress',
          required: false
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role', 'mobile', 'address', 'city', 'state', 'country', 'pincode'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();

      let deliveryAddress = null;
      if (orderData.deliveryAddressData) {
        try {
          deliveryAddress = {
            type: orderData.deliveryAddressType || 'unknown',
            data: typeof orderData.deliveryAddressData === 'string'
              ? JSON.parse(orderData.deliveryAddressData)
              : orderData.deliveryAddressData
          };
        } catch (e) {
          console.warn('Failed to parse delivery address data:', e);
        }
      }

      if (!deliveryAddress) {
        if (orderData.shippingAddress) {
          deliveryAddress = {
            type: 'shipping',
            data: {
              name: orderData.shippingAddress.name,
              phone: orderData.shippingAddress.phone,
              address: orderData.shippingAddress.address,
              city: orderData.shippingAddress.city,
              state: orderData.shippingAddress.state,
              country: orderData.shippingAddress.country,
              pincode: orderData.shippingAddress.pincode,
              addressType: orderData.shippingAddress.addressType
            }
          };
        } else if (orderData.user) {
          deliveryAddress = {
            type: 'default',
            data: {
              name: orderData.user.name,
              phone: orderData.user.mobile || 'Not provided',
              address: orderData.user.address,
              city: orderData.user.city,
              state: orderData.user.state,
              country: orderData.user.country,
              pincode: orderData.user.pincode,
              source: 'user_profile'
            }
          };
        }
      }

      orderData.deliveryAddress = deliveryAddress;

      if (orderData.orderItems) {
        orderData.orderItems = orderData.orderItems.map(item => {
          const itemData = { ...item };
          if (item.product) {
            const processedProduct = processOrderProductData(item.product, req, req.user.role);

            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
              imageUrls: processedProduct.imageUrls || [],
              currentPrice: calculateUserPrice(item.product, req.user.role),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, req.user.role) - item.price).toFixed(2)),
              isActive: item.product.isActive,
              colors: processedProduct.colors || [],
              specifications: processedProduct.specifications || {},
              category: item.product.category ? {
                id: item.product.category.id,
                name: item.product.category.name,
                parentId: item.product.category.parentId
              } : null
            };
          }
          return itemData;
        });
      }

      return orderData;
    });

    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

    const statusStats = await Order.findAll({
      where: { userId: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['status'],
      raw: true
    });

    statusStats.forEach(stat => {
      orderSummary.statusBreakdown[stat.status] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    const paymentStats = await Order.findAll({
      where: { userId: userId },
      attributes: [
        'paymentStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['paymentStatus'],
      raw: true
    });

    paymentStats.forEach(stat => {
      orderSummary.paymentStatusBreakdown[stat.paymentStatus] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    res.json({
      success: true,
      orders: processedOrders,
      orderSummary: orderSummary,
      filters: { status, paymentStatus, startDate, endDate },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      sorting: { sortBy, sortOrder }
    });

  } catch (error) {
    console.error('GET PROFILE ORDER HISTORY BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile order history by ID',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { getProfile, updateProfile, getProfileOrderHistory, getProfileOrderHistoryById };
