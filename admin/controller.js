// admin/controller.js (no changes needed, as it aligns with permissions via middleware)
const { User, Enquiry, Order, Product, Category } = require('../models');
const { Op, fn, col } = require('sequelize');
const { canCreateRole } = require('../auth/controller');

// Get all pending users
const getPendingUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const where = { status: 'Pending' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: users.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.count / limit),
        totalItems: users.count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all users with filters
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role'],
          required: false,
        },
      ],
    });

    res.json({
      success: true,
      data: users.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.count / limit),
        totalItems: users.count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve/Reject user
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const currentUser = req.user;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Security: Prevent modifying SuperAdmin unless by SuperAdmin
    if (user.role === 'SuperAdmin' && currentUser.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can modify SuperAdmin users',
      });
    }

    // Security: Admin cannot modify other Admins unless by SuperAdmin
    if (user.role === 'Admin' && currentUser.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can modify Admin users',
      });
    }

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Approved or Rejected',
      });
    }

    // Update user status
    const updateData = { status };
    if (status === 'Rejected') {
      updateData.rejectionReason = reason || 'No reason provided';
    } else {
      updateData.rejectionReason = null;
    }

    await user.update(updateData);

    const message = status === 'Approved'
      ? 'User approved successfully'
      : 'User rejected successfully';

    res.json({
      success: true,
      message,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        rejectionReason: user.rejectionReason || null,
      },
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const stats = await User.findAll({
      attributes: [
        'role',
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['role', 'status'],
    });

    const formattedStats = {};
    stats.forEach((stat) => {
      if (!formattedStats[stat.role]) formattedStats[stat.role] = {};
      formattedStats[stat.role][stat.status] = parseInt(stat.dataValues.count);
    });

    res.json({
      success: true,
      data: formattedStats,
      roleHierarchy: {
        SuperAdmin: 100,
        Admin: 90,
        Manager: 80,
        Sales: 60,
        Support: 50,
        Dealer: 40,
        Architect: 40,
        Customer: 20,
        General: 10,
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status } = req.body;
    const currentUser = req.user;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Security: Role-based permissions
    if (role && !canCreateRole(currentUser.role, role)) {
      return res.status(403).json({
        success: false,
        message: `${currentUser.role} cannot assign ${role} role`,
      });
    }

    // Security: Cannot modify SuperAdmin unless by SuperAdmin
    if (user.role === 'SuperAdmin' && currentUser.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can modify SuperAdmin users',
      });
    }

    // Update user
    const updateData = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await user.update(updateData);

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get comprehensive dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const period = req.query.period || null;
    const now = new Date();
    const periodStart = (() => {
      if (!period) return null;
      switch (period) {
        case '7days':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30days':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '3months':
          return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        case '6months':
          return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case '1year':
          return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        default:
          return null;
      }
    })();

    // User statistics
    const userStats = await User.findAll({
      attributes: [
        'role',
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['role', 'status'],
    });

    const formattedUserStats = {};
    userStats.forEach((stat) => {
      if (!formattedUserStats[stat.role]) formattedUserStats[stat.role] = {};
      formattedUserStats[stat.role][stat.status] = parseInt(stat.dataValues.count);
    });

    // Total users count
    const totalUsers = await User.count();

    // Enquiry statistics
    const enquiryWhere = periodStart ? { createdAt: { [Op.gte]: periodStart } } : {};
    const enquiryStats = await Enquiry.findAll({
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['status'],
      where: enquiryWhere,
    });

    const formattedEnquiryStats = {};
    enquiryStats.forEach((stat) => {
      formattedEnquiryStats[stat.status] = parseInt(stat.dataValues.count);
    });

    // Total enquiries count
    const totalEnquiries = await Enquiry.count();

    // Recent enquiries (last 5)
    const recentEnquiries = await Enquiry.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'status', 'createdAt'],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

    // Order statistics
    const orderWhere = periodStart ? { orderDate: { [Op.gte]: periodStart } } : {};
    const orderStats = await Order.findAll({
      attributes: [
        'status',
        'paymentStatus',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('total')), 'totalAmount'],
      ],
      group: ['status', 'paymentStatus'],
      where: orderWhere,
    });

    const formattedOrderStats = {};
    let totalRevenue = 0;
    let totalOrders = 0;

    orderStats.forEach((stat) => {
      const status = stat.status;
      const paymentStatus = stat.paymentStatus;
      const count = parseInt(stat.dataValues.count);
      const amount = parseFloat(stat.dataValues.totalAmount || 0);

      if (!formattedOrderStats[status]) formattedOrderStats[status] = {};
      formattedOrderStats[status][paymentStatus] = { count, amount };

      totalOrders += count;
      if (paymentStatus === 'Completed' || paymentStatus === 'Paid') {
        totalRevenue += amount;
      }
    });

    // This month's revenue
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonthRevenue = await Order.sum('total', {
      where: {
        paymentStatus: { [Op.in]: ['Completed', 'Paid'] },
        orderDate: { [Op.gte]: thisMonthStart },
      },
    }) || 0;

    // Recent orders (last 5)
    const recentOrders = await Order.findAll({
      limit: 5,
      order: [['orderDate', 'DESC']],
      attributes: ['id', 'status', 'paymentStatus', 'total', 'orderDate'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
      where: orderWhere,
    });

    // Product statistics
    const totalProducts = await Product.count();
    const activeProducts = await Product.count({ where: { isActive: true } });
    const inactiveProducts = totalProducts - activeProducts;

    // Category statistics
    const totalCategories = await Category.count();

    // Recent products (last 5)
    const recentProducts = await Product.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'isActive', 'createdAt'],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          stats: formattedUserStats,
        },
        enquiries: {
          total: totalEnquiries,
          stats: formattedEnquiryStats,
          recent: recentEnquiries.map(enquiry => ({
            id: enquiry.id,
            name: enquiry.name,
            email: enquiry.email,
            status: enquiry.status,
            createdAt: enquiry.createdAt,
            product: enquiry.product ? enquiry.product.name : null,
          })),
        },
        orders: {
          total: totalOrders,
          revenue: parseFloat(totalRevenue.toFixed(2)),
          thisMonthRevenue: parseFloat(thisMonthRevenue.toFixed(2)),
          stats: formattedOrderStats,
          recent: recentOrders.map(order => ({
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: parseFloat(order.total),
            orderDate: order.orderDate,
            customerName: order.user ? order.user.name : 'Unknown',
          })),
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          inactive: inactiveProducts,
          categories: totalCategories,
          recent: recentProducts.map(product => ({
            id: product.id,
            name: product.name,
            isActive: product.isActive,
            createdAt: product.createdAt,
            category: product.category ? product.category.name : null,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
  updateUserRole,
  getDashboardStats,
};