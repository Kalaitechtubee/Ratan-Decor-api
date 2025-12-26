const { Order, OrderItem, Product, Cart, User, Category, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const { calculateUserPrice, processOrderProductData, getFallbackImageUrl } = require('../utils/imageUtils');

class OrderService {
    normalizePaymentMethod(method) {
        const m = (method || '').toString().toLowerCase();
        if (m === 'gateway') return 'Gateway';
        if (['upi', 'gpay', 'googlepay', 'phonepe', 'paytm', 'bhim', 'qr'].includes(m)) return 'UPI';
        if (['bank', 'banktransfer', 'bank_transfer', 'neft', 'imps', 'rtgs'].includes(m)) return 'BankTransfer';
        if (['cod', 'cash', 'cashondelivery'].includes(m)) return 'COD';
        return method;
    }

    async prepareOrderAddress(req, addressType, shippingAddressId, newAddressData) {
        let orderAddress = null;

        if (addressType === 'new' && newAddressData) {
            const addressData = {
                name: newAddressData.name,
                phone: newAddressData.phone,
                address: newAddressData.address || newAddressData.street,
                city: newAddressData.city,
                state: newAddressData.state,
                country: newAddressData.country,
                pincode: newAddressData.pincode || newAddressData.postalCode,
                addressType: newAddressData.addressType || newAddressData.type || 'Home'
            };

            const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode'];
            const missingFields = requiredFields.filter(field =>
                !addressData[field] || typeof addressData[field] !== 'string' || addressData[field].trim() === ''
            );

            if (missingFields.length > 0) {
                throw new Error(`Missing required address fields: ${missingFields.join(', ')}`);
            }

            const newAddress = await ShippingAddress.create({
                userId: req.user.id,
                ...addressData
            });

            orderAddress = {
                type: 'new',
                shippingAddressId: newAddress.id,
                addressData: {
                    name: newAddress.name,
                    phone: newAddress.phone,
                    address: newAddress.address,
                    city: newAddress.city,
                    state: newAddress.state,
                    country: newAddress.country,
                    pincode: newAddress.pincode,
                    addressType: newAddress.addressType,
                    isDefault: false
                }
            };
        } else if ((addressType === 'shipping' || shippingAddressId) && shippingAddressId) {
            const shippingAddress = await ShippingAddress.findOne({
                where: { id: shippingAddressId, userId: req.user.id }
            });

            if (!shippingAddress) {
                throw new Error(`Shipping address with ID ${shippingAddressId} not found or doesn't belong to user`);
            }

            orderAddress = {
                type: 'shipping',
                shippingAddressId: shippingAddress.id,
                addressData: {
                    name: shippingAddress.name || 'N/A',
                    phone: shippingAddress.phone || 'N/A',
                    address: shippingAddress.address,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    country: shippingAddress.country,
                    pincode: shippingAddress.pincode,
                    addressType: shippingAddress.addressType,
                    isDefault: false
                }
            };
        } else {
            const user = await User.findByPk(req.user.id, {
                attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode']
            });

            const hasUsableProfileAddress = !!(user && user.address && user.city && user.state && user.country && user.pincode);

            if (hasUsableProfileAddress && (addressType === 'default' || !shippingAddressId)) {
                orderAddress = {
                    type: 'default',
                    shippingAddressId: null,
                    addressData: {
                        name: user.name,
                        phone: user.mobile || 'Not provided',
                        address: user.address,
                        city: user.city,
                        state: user.state,
                        country: user.country,
                        pincode: user.pincode,
                        addressType: 'Default',
                        isDefault: true,
                        source: 'user_profile'
                    }
                };
            } else {
                const anyAddress = await ShippingAddress.findOne({ where: { userId: req.user.id } });

                if (!anyAddress) {
                    if (hasUsableProfileAddress) {
                        orderAddress = {
                            type: 'default',
                            shippingAddressId: null,
                            addressData: {
                                name: user.name,
                                phone: user.mobile || 'Not provided',
                                address: user.address,
                                city: user.city,
                                state: user.state,
                                country: user.country,
                                pincode: user.pincode,
                                addressType: 'Default',
                                isDefault: true,
                                source: 'user_profile_fallback'
                            }
                        };
                    } else {
                        throw new Error('No complete address available. Please provide a new address or update your profile.');
                    }
                } else {
                    orderAddress = {
                        type: 'shipping',
                        shippingAddressId: anyAddress.id,
                        addressData: {
                            name: anyAddress.name || user.name,
                            phone: anyAddress.phone || user.mobile || 'Not provided',
                            address: anyAddress.address,
                            city: anyAddress.city,
                            state: anyAddress.state,
                            country: anyAddress.country,
                            pincode: anyAddress.pincode,
                            addressType: anyAddress.addressType,
                            isDefault: false,
                            source: 'address_fallback'
                        }
                    };
                }
            }
        }
        return orderAddress;
    }

    async createOrder(req, orderData) {
        const {
            paymentMethod, items, shippingAddressId, addressType = 'default',
            newAddressData, notes, expectedDeliveryDate
        } = orderData;

        const normalizedPaymentMethod = this.normalizePaymentMethod(paymentMethod);
        const orderAddress = await this.prepareOrderAddress(req, addressType, shippingAddressId, newAddressData);
        const transaction = await sequelize.transaction();

        try {
            let itemsToProcess = [];
            if (Array.isArray(items) && items.length > 0) {
                itemsToProcess = items.map(it => ({ productId: it.productId || it.id, quantity: Number(it.quantity || 1) }));
            } else {
                const cartItems = await Cart.findAll({ where: { userId: req.user.id }, include: [{ model: Product, as: 'product' }], transaction });
                itemsToProcess = cartItems.map(ci => ({ productId: ci.productId, quantity: Number(ci.quantity || 1), product: ci.product }));
            }

            if (!itemsToProcess || itemsToProcess.length === 0) throw new Error('No items provided to create order');

            const productIds = itemsToProcess.map(i => i.productId);
            const products = await Product.findAll({ where: { id: productIds }, include: [{ model: Category, as: 'category' }], transaction });
            const productMap = {};
            products.forEach(p => { productMap[p.id] = p; });

            let subtotal = 0;
            let totalGst = 0;
            const processedOrderItems = [];

            for (const it of itemsToProcess) {
                const product = it.product || productMap[it.productId];
                if (!product) throw new Error(`Product not found: ${it.productId}`);

                const unitPrice = calculateUserPrice(product, req.user.role);
                const qty = Number(it.quantity || 1);
                const itemSubtotal = parseFloat((unitPrice * qty).toFixed(2));
                const gstRate = parseFloat(product.gst || 0) || 0;
                const itemGst = parseFloat(((itemSubtotal * gstRate) / 100).toFixed(2));
                const itemTotal = parseFloat((itemSubtotal + itemGst).toFixed(2));

                subtotal += itemSubtotal;
                totalGst += itemGst;

                processedOrderItems.push({
                    productId: product.id,
                    quantity: qty,
                    price: unitPrice,
                    subtotal: itemSubtotal,
                    gstAmount: itemGst,
                    total: itemTotal,
                    product
                });
            }

            subtotal = parseFloat(subtotal.toFixed(2));
            totalGst = parseFloat(totalGst.toFixed(2));
            const total = parseFloat((subtotal + totalGst).toFixed(2));

            const order = await Order.create({
                userId: req.user.id,
                paymentMethod: normalizedPaymentMethod || 'Gateway',
                total,
                subtotal,
                gstAmount: totalGst,
                shippingAddressId: orderAddress && orderAddress.shippingAddressId ? orderAddress.shippingAddressId : null,
                deliveryAddressType: orderAddress ? orderAddress.type : 'default',
                deliveryAddressData: orderAddress ? orderAddress.addressData : null,
                notes: notes || null,
                expectedDeliveryDate: expectedDeliveryDate || null
            }, { transaction });

            for (const poi of processedOrderItems) {
                await OrderItem.create({
                    orderId: order.id,
                    productId: poi.productId,
                    quantity: poi.quantity,
                    price: poi.price,
                    subtotal: poi.subtotal,
                    gstAmount: poi.gstAmount,
                    total: poi.total
                }, { transaction });
            }

            try {
                await Cart.destroy({ where: { userId: req.user.id, productId: productIds }, transaction });
            } catch (e) {
                console.warn('Failed to clear cart items:', e.message);
            }

            await transaction.commit();

            return { order, processedOrderItems, orderAddress, normalizedPaymentMethod };
        } catch (error) {
            if (!['commit', 'rollback'].includes(transaction.finished)) await transaction.rollback();
            throw error;
        }
    }

    async getOrderSummary(count, limit, page, whereForStats) {
        const orderSummary = {
            totalOrders: count,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            ordersPerPage: Number(limit),
            statusBreakdown: {},
            paymentStatusBreakdown: {}
        };

        const statusStats = await Order.findAll({
            where: whereForStats,
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
            where: whereForStats,
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

        return orderSummary;
    }
}

module.exports = new OrderService();
