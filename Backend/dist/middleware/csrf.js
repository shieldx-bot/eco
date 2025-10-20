"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCsrfToken = exports.attachCsrfToken = exports.originCheck = exports.csrfProtection = exports.csrfTokenGenerator = exports.generateCsrfToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const tokenStore = {};
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    Object.keys(tokenStore).forEach(token => {
        if (now - tokenStore[token] > oneHour) {
            delete tokenStore[token];
        }
    });
}, 60 * 60 * 1000);
const generateCsrfToken = () => {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    tokenStore[token] = Date.now();
    return token;
};
exports.generateCsrfToken = generateCsrfToken;
const verifyCsrfToken = (token) => {
    if (!token || !tokenStore[token]) {
        return false;
    }
    const now = Date.now();
    const tokenAge = now - tokenStore[token];
    const maxAge = 60 * 60 * 1000;
    if (tokenAge > maxAge) {
        delete tokenStore[token];
        return false;
    }
    return true;
};
const csrfTokenGenerator = (_req, res, next) => {
    const token = (0, exports.generateCsrfToken)();
    res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
    });
    res.locals.csrfToken = token;
    next();
};
exports.csrfTokenGenerator = csrfTokenGenerator;
const csrfProtection = (req, res, next) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }
    const webhookPaths = ['/api/payments/webhook/stripe', '/api/payments/webhook/paypal'];
    if (webhookPaths.some(path => req.path.includes(path))) {
        return next();
    }
    const token = req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'] ||
        req.body?._csrf ||
        req.query?._csrf;
    const cookieToken = req.cookies['XSRF-TOKEN'];
    if (!token || !cookieToken || token !== cookieToken || !verifyCsrfToken(token)) {
        return res.status(403).json({
            error: 'CSRF Token Validation Failed',
            message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        });
    }
    next();
};
exports.csrfProtection = csrfProtection;
const originCheck = (req, res, next) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.ADMIN_URL,
        'http://localhost:3000',
        'http://localhost:3001',
    ].filter(Boolean);
    if (!origin) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Origin header is required',
            });
        }
        return next();
    }
    const isAllowed = allowedOrigins.some(allowed => {
        if (!allowed)
            return false;
        try {
            const originUrl = new URL(origin);
            const allowedUrl = new URL(allowed);
            return originUrl.origin === allowedUrl.origin;
        }
        catch {
            return false;
        }
    });
    if (!isAllowed) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Origin not allowed',
        });
    }
    next();
};
exports.originCheck = originCheck;
const attachCsrfToken = (req, res, next) => {
    if (req.method === 'GET' && !req.path.includes('/api/')) {
        const token = (0, exports.generateCsrfToken)();
        res.cookie('XSRF-TOKEN', token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000,
        });
    }
    next();
};
exports.attachCsrfToken = attachCsrfToken;
const getCsrfToken = (_req, res) => {
    const token = (0, exports.generateCsrfToken)();
    res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
    });
    res.json({
        csrfToken: token,
        expiresIn: 3600,
    });
};
exports.getCsrfToken = getCsrfToken;
//# sourceMappingURL=csrf.js.map