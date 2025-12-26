// user/controller.js (consolidated: includes staff management without role checks)
const { User, UserType, Order, OrderItem, Product, Category, ShippingAddress, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  processOrderProductData,
  calculateUserPrice,
  getFallbackImageUrl,
} = require('../utils/imageUtils');

const STAFF_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Sales', 'Support'];

// Canonical role map (case-insensitive input -> stored value)
const ROLE_CANONICAL = {
  superadmin: 'SuperAdmin',
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
  support: 'Support',
  dealer: 'Dealer',
  architect: 'Architect',
  general: 'General',
  customer: 'customer'
};

const CLIENT_ROLES = ['customer', 'General', 'Architect', 'Dealer'];
const VALID_ROLES = Object.values(ROLE_CANONICAL);

const normalizeRole = (roleInput) => {
  if (!roleInput) return null;
  const roleKey = roleInput.toString().trim().toLowerCase();
  return ROLE_CANONICAL[roleKey] || null;
};

const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      userTypeName,
      staffOnly,
      includeStaff,
      startDate,
      endDate,
      state,
      city,
      pincode
    } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json({ success: false, message: 'Invalid role filter' });
      }
      where.role = normalizedRole;
    }
    if (status) {
      where.status = status;
    }

    if (state) where.state = { [Op.like]: `%${state}%` };
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (pincode) where.pincode = pincode;

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.createdAt = { [Op.lte]: new Date(endDate) };
    }

    // Default behaviour: return only client roles for /api/users
    // - staffOnly=true -> only staff roles
    // - includeStaff=true -> include everyone (no role restriction)
    // - otherwise -> clients only
    if (staffOnly === 'true') {
      where.role = { [Op.in]: STAFF_ROLES };
    } else if (includeStaff === 'true') {
      // no role restriction
    } else if (!role) {
      // Only apply default client filter when no explicit role filter provided
      where.role = { [Op.in]: CLIENT_ROLES };
    }

    const include = [
      {
        model: UserType,
        as: 'userType',
        attributes: ['id', 'name'],
        ...(userTypeName && {
          where: { name: { [Op.like]: `%${userTypeName}%` } },
        }),
      },
    ];

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      include,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Calculate summary statistics (respecting filters except status/role for complete breakdown)
    const baseWhere = Object.fromEntries(Object.entries(where).filter(([k]) => !['status', 'role'].includes(k)));

    // Manual stats calculation to be more efficient than separate counts
    const statusStats = await User.findAll({
      where: baseWhere,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    const roleStats = await User.findAll({
      where: baseWhere,
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true
    });

    const summary = {
      totalUsers: count, // Count matching current filters
      statusBreakdown: {},
      roleBreakdown: {}
    };

    statusStats.forEach(stat => {
      summary.statusBreakdown[stat.status] = parseInt(stat.count);
    });

    roleStats.forEach(stat => {
      summary.roleBreakdown[stat.role] = parseInt(stat.count);
    });

    res.json({
      success: true,
      users: rows, // Maintain consistent 'users' key for some frontend expectations
      data: rows,
      summary,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(count / limitNum),
        totalItems: count,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllStaffUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      userTypeName,
      role,
      startDate,
      endDate,
      state,
      city,
      pincode
    } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const where = {
      role: { [Op.in]: STAFF_ROLES }
    };

    if (role) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole || !STAFF_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Invalid staff role filter' });
      }
      where.role = normalizedRole;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    if (state) where.state = { [Op.like]: `%${state}%` };
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (pincode) where.pincode = pincode;

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.createdAt = { [Op.lte]: new Date(endDate) };
    }

    const include = [
      {
        model: UserType,
        as: 'userType',
        attributes: ['id', 'name'],
        ...(userTypeName && {
          where: { name: { [Op.like]: `%${userTypeName}%` } },
        }),
      },
    ];

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      include,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Calculate summary statistics for staff
    const baseStaffWhere = { role: { [Op.in]: STAFF_ROLES } };
    // Add same filters except status/role
    Object.entries(where).forEach(([k, v]) => {
      if (!['status', 'role'].includes(k)) baseStaffWhere[k] = v;
    });

    const statusStats = await User.findAll({
      where: baseStaffWhere,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    const roleStats = await User.findAll({
      where: baseStaffWhere,
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true
    });

    const summary = {
      totalUsers: count,
      statusBreakdown: {},
      roleBreakdown: {}
    };

    statusStats.forEach(stat => {
      summary.statusBreakdown[stat.status] = parseInt(stat.count);
    });

    roleStats.forEach(stat => {
      summary.roleBreakdown[stat.role] = parseInt(stat.count);
    });

    res.json({
      success: true,
      staffUsers: rows,
      summary,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(count / limitNum),
        totalItems: count,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error in getAllStaffUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStaffUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      where: {
        id: req.params.id,
        role: { [Op.in]: STAFF_ROLES }
      },
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });
    if (!user) return res.status(404).json({ success: false, message: 'Staff user not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error in getStaffUserById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  // Role-based access control: allow staff roles or the user themselves
  // STAFF_ROLES is defined above and includes SuperAdmin, Admin, Manager, Sales, Support
  const requestedUserId = Number(req.params.id);
  if (!STAFF_ROLES.includes(req.user.role) && req.user.id !== requestedUserId) {
    return res.status(403).json({ success: false, message: 'Access denied to Customers module' });
  }

  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  // Role-based access control: Only SuperAdmin and Admin can create users (Sales can view but not create)
  if (!['SuperAdmin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied to user creation' });
  }

  try {
    const { name, email, password, mobile, company, role, status, userTypeId } = req.body;
    const validStatuses = ['Pending', 'Approved', 'Rejected'];

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number',
      });
    }

    // Normalize role
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole || !VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Validate status
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate userTypeId
    let finalUserTypeId = userTypeId;
    if (userTypeId) {
      const userType = await UserType.findByPk(userTypeId);
      if (!userType) {
        return res.status(400).json({ success: false, message: 'Invalid userTypeId' });
      }
    } else {
      // Ensure customer user type exists
      let customerType = await UserType.findOne({ where: { name: 'customer' } });
      if (!customerType) {
        customerType = await UserType.create({ name: 'customer', isActive: true });
      }
      finalUserTypeId = customerType.id;
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      company,
      role: normalizedRole,
      status: status || 'Pending',
      userTypeId: finalUserTypeId,
    });

    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;

    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error('Error in createUser:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

const updateUser = async (req, res) => {
  // Role-based access control: Only SuperAdmin and Admin can update users (Sales can view but not update)
  if (!['SuperAdmin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied to user update' });
  }

  try {
    const { name, email, mobile, company, role, status, userTypeId } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const validStatuses = ['Pending', 'Approved', 'Rejected'];

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      const existingUser = await User.findOne({ where: { email, id: { [Op.ne]: req.params.id } } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    // Normalize role to canonical if provided
    let normalizedRole = role;
    if (role !== undefined) {
      normalizedRole = normalizeRole(role);
      // Validate role
      if (!normalizedRole || !VALID_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
    }

    // Validate status
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate userTypeId
    if (userTypeId !== undefined) {
      const userType = await UserType.findByPk(userTypeId);
      if (!userType) {
        return res.status(400).json({ success: false, message: 'Invalid userTypeId' });
      }
    }

    await user.update({
      name: name || user.name,
      email: email || user.email,
      mobile: mobile !== undefined ? mobile : user.mobile,
      company: company !== undefined ? company : user.company,
      role: normalizedRole !== undefined ? normalizedRole : user.role,
      status: status || user.status,
      userTypeId: userTypeId !== undefined ? userTypeId : user.userTypeId,
    });

    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });

    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) {
    console.error('Error in updateUser:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

const deleteUser = async (req, res) => {
  // Role-based access control: Only SuperAdmin and Admin can delete users (Sales can view but not delete)
  if (!['SuperAdmin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied to user deletion' });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserOrderHistory = async (req, res) => {
  // Role-based access control: allow staff roles or the user themselves
  const requestedUserId = Number(req.params.id);
  if (!STAFF_ROLES.includes(req.user.role) && req.user.id !== requestedUserId) {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const userId = req.params.id;
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

    // Additional check: Staff can access any user's orders, but non-staff only their own
    if (!STAFF_ROLES.includes(req.user.role) && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

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
      const buyerRole = orderData.user?.role || 'customer';

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
            const processedProduct = processOrderProductData(item.product, req, buyerRole);

            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
              imageUrls: processedProduct.imageUrls || [],
              currentPrice: calculateUserPrice(item.product, buyerRole),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, buyerRole) - item.price).toFixed(2)),
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
    console.error('GET USER ORDER HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user order history',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getFullOrderHistory = async (req, res) => {
  // Role-based access control: Only SuperAdmin and Admin for full order history
  if (!['SuperAdmin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
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

    const where = {};

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
      const buyerRole = orderData.user?.role || 'customer';

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
            const processedProduct = processOrderProductData(item.product, req, buyerRole);

            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
              imageUrls: processedProduct.imageUrls || [],
              currentPrice: calculateUserPrice(item.product, buyerRole),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, buyerRole) - item.price).toFixed(2)),
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
      where,
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
      where,
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
    console.error('GET FULL ORDER HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch full order history',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  getAllUsers,
  getAllStaffUsers,
  getStaffUserById,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserOrderHistory,
  getFullOrderHistory,
};