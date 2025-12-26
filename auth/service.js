const nodemailer = require('nodemailer');
const { User, ShippingAddress, UserType } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../services/jwt.service');
const { getCookieOptions } = require('../middleware/cookieOptions');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock Redis Wrapper (Replace with real Redis in production)
class OtpStore {
    constructor() {
        this.store = new Map();
    }
    set(email, data) {
        this.store.set(email, data);
    }
    get(email) {
        return this.store.get(email);
    }
    delete(email) {
        this.store.delete(email);
    }
}

class AuthService {
    constructor() {
        this.otpStore = new OtpStore();
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        this.ROLE_HIERARCHY = {
            'SuperAdmin': 100,
            'Admin': 90,
            'Manager': 80,
            'Sales': 60,
            'Support': 50,
            'Dealer': 40,
            'Architect': 40,
            'General': 30,
            'customer': 20
        };

        this.ROLE_CANONICAL = {
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

        this.REGISTRATION_RULES = {
            PUBLIC_ROLES: ['customer', 'general'],
            BUSINESS_ROLES: ['architect', 'dealer'],
            STAFF_ROLES: ['admin', 'manager', 'sales', 'support', 'superadmin'],
            ADMIN_ROLES: ['admin'],
            SUPERADMIN_ROLES: ['superadmin']
        };
    }

    getCanonicalRole(role) {
        if (!role) return null;
        return this.ROLE_CANONICAL[role.toString().trim().toLowerCase()] || null;
    }

    canCreateRole(creatorRole, targetRole) {
        if (creatorRole === 'SuperAdmin' || creatorRole === 'Admin') {
            return true;
        }
        if (creatorRole === 'Manager') {
            return ['Sales', 'Support'].includes(targetRole);
        }
        return false;
    }

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendOTP(email, otp) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Password Reset OTP',
                text: `Your OTP for password reset is ${otp}. Valid for 10 minutes.`,
                html: `<p>Your OTP for password reset is <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
            };
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Send OTP error:', error);
            throw new Error('Failed to send OTP');
        }
    }

    getCookieNames(req) {
        const clientType = req.headers['x-client-type'] || req.query.clientType || '';
        const isAdmin = clientType.toLowerCase() === 'admin';
        return {
            accessToken: isAdmin ? 'admin_accessToken' : 'accessToken',
            refreshToken: isAdmin ? 'admin_refreshToken' : 'refreshToken',
            isAdmin
        };
    }

    async createSuperAdminIfMissing() {
        const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
        const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;

        if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
            console.warn('SuperAdmin credentials not found in env. Skipping check.');
            return null;
        }

        let user = await User.findOne({ where: { email: SUPERADMIN_EMAIL } });

        if (!user) {
            console.log('Creating default SuperAdmin account...');
            const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
            user = await User.create({
                name: process.env.SUPERADMIN_NAME || 'Super Administrator',
                email: SUPERADMIN_EMAIL,
                password: hashedPassword,
                role: 'SuperAdmin',
                status: 'Approved',
                userTypeId: null,
                mobile: '0000000000',
                country: 'India',
                state: 'Tamil Nadu',
                city: 'Chennai',
                company: 'Ratan Decor',
                loginAttempts: 0
            });
        }
        return user;
    }

    storeOTP(email, otp) {
        this.otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 });
    }

    verifyOTP(email, otp) {
        const stored = this.otpStore.get(email);
        if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
            return false;
        }
        return true;
    }

    clearOTP(email) {
        this.otpStore.delete(email);
    }

    async generateTokens(user) {
        const accessToken = generateAccessToken({
            id: user.id,
            role: user.role,
            status: user.status,
            email: user.email,
            userTypeId: user.userTypeId
        });
        const refreshToken = generateRefreshToken({
            id: user.id,
            role: user.role,
            status: user.status,
            email: user.email,
            userTypeId: user.userTypeId
        });
        return { accessToken, refreshToken };
    }
}

module.exports = new AuthService();
