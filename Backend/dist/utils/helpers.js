"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUserData = exports.validatePassword = exports.validateEmail = exports.formatPrice = exports.generateSlug = void 0;
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};
exports.generateSlug = generateSlug;
const formatPrice = (cents, currency = 'USD') => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};
exports.formatPrice = formatPrice;
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
};
exports.validatePassword = validatePassword;
const sanitizeUserData = (user) => {
    const { password_hash, ...userData } = user;
    return userData;
};
exports.sanitizeUserData = sanitizeUserData;
//# sourceMappingURL=helpers.js.map