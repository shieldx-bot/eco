"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xssProtection = exports.detectSuspiciousActivity = exports.ipFilter = exports.requestSizeLimiter = exports.compressionMiddleware = exports.preventHpp = exports.sanitizeData = exports.speedLimiter = exports.passwordResetLimiter = exports.orderLimiter = exports.paymentLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const hpp_1 = __importDefault(require("hpp"));
const compression_1 = __importDefault(require("compression"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900)
        });
    }
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again after 15 minutes',
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too Many Login Attempts',
            message: 'Too many failed authentication attempts. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900)
        });
    }
});
exports.paymentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: 'Too many payment attempts, please try again after 10 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too Many Payment Attempts',
            message: 'You have exceeded the payment request limit. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 600)
        });
    }
});
exports.orderLimiter = (0, express_rate_limit_1.default)({
    windowMs: 30 * 60 * 1000,
    max: 10,
    message: 'Too many order creation attempts',
    standardHeaders: true,
    legacyHeaders: false
});
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false
});
exports.speedLimiter = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: (hits) => hits * 100,
    maxDelayMs: 5000,
});
exports.sanitizeData = (0, express_mongo_sanitize_1.default)({
    replaceWith: '_',
    onSanitize: ({ key }) => {
        console.warn(`Sanitized request data. Key: ${key}`);
    }
});
exports.preventHpp = (0, hpp_1.default)({
    whitelist: ['price', 'rating', 'category', 'tags']
});
exports.compressionMiddleware = (0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    threshold: 1024,
    level: 6
});
const requestSizeLimiter = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = 10 * 1024 * 1024;
    if (contentLength > maxSize) {
        res.status(413).json({
            error: 'Payload Too Large',
            message: `Request body too large. Maximum allowed size is ${maxSize / 1024 / 1024}MB`
        });
        return;
    }
    next();
};
exports.requestSizeLimiter = requestSizeLimiter;
const BLACKLISTED_IPS = process.env.BLACKLISTED_IPS?.split(',') || [];
const WHITELISTED_IPS = process.env.WHITELISTED_IPS?.split(',') || [];
const ipFilter = (req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (WHITELISTED_IPS.length > 0 && !WHITELISTED_IPS.includes(clientIp)) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Your IP address is not authorized to access this resource'
        });
        return;
    }
    if (BLACKLISTED_IPS.includes(clientIp)) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Your IP address has been blocked'
        });
        return;
    }
    next();
};
exports.ipFilter = ipFilter;
const detectSuspiciousActivity = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const url = req.url;
    const body = JSON.stringify(req.body);
    const sqlPatterns = [
        /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b)/gi,
        /(\bunion\b.*\bselect\b|\bor\b.*=.*)/gi,
        /(--|;|\/\*|\*\/)/g
    ];
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
    ];
    const pathTraversalPattern = /\.\.[\/\\]/g;
    const suspicious = sqlPatterns.some(pattern => pattern.test(url) || pattern.test(body)) ||
        xssPatterns.some(pattern => pattern.test(url) || pattern.test(body)) ||
        pathTraversalPattern.test(url);
    if (suspicious) {
        console.error(`🚨 Suspicious activity detected from IP: ${req.ip}`);
        console.error(`URL: ${url}`);
        console.error(`User-Agent: ${userAgent}`);
        res.status(400).json({
            error: 'Bad Request',
            message: 'Suspicious activity detected in your request'
        });
        return;
    }
    next();
};
exports.detectSuspiciousActivity = detectSuspiciousActivity;
const xssProtection = (req, _res, next) => {
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/<iframe/gi, '')
                .replace(/eval\(/gi, '');
        }
        if (Array.isArray(value)) {
            return value.map(sanitizeValue);
        }
        if (typeof value === 'object' && value !== null) {
            const sanitized = {};
            for (const key in value) {
                sanitized[key] = sanitizeValue(value[key]);
            }
            return sanitized;
        }
        return value;
    };
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    if (req.query) {
        req.query = sanitizeValue(req.query);
    }
    if (req.params) {
        req.params = sanitizeValue(req.params);
    }
    next();
};
exports.xssProtection = xssProtection;
//# sourceMappingURL=security.js.map