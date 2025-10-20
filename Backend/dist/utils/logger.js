"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDatabaseQuery = exports.logAuth = exports.logPayment = exports.logError = exports.logRequest = exports.logSecurityEvent = exports.loggerMiddleware = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
winston_1.default.addColors(colors);
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`));
const transports = [
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }),
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join('logs', 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format: winston_1.default.format.combine(winston_1.default.format.uncolorize(), winston_1.default.format.json()),
    }),
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join('logs', 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: winston_1.default.format.combine(winston_1.default.format.uncolorize(), winston_1.default.format.json()),
    }),
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join('logs', 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxSize: '20m',
        maxFiles: '7d',
        format: winston_1.default.format.combine(winston_1.default.format.uncolorize(), winston_1.default.format.json()),
    }),
];
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format,
    transports,
    exitOnError: false,
});
const loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`;
        if (res.statusCode >= 500) {
            logger.error(message);
        }
        else if (res.statusCode >= 400) {
            logger.warn(message);
        }
        else {
            logger.http(message);
        }
    });
    next();
};
exports.loggerMiddleware = loggerMiddleware;
const logSecurityEvent = (event, details, level = 'warn') => {
    const message = `🔒 SECURITY EVENT: ${event}`;
    logger[level](message, { event, details, timestamp: new Date().toISOString() });
};
exports.logSecurityEvent = logSecurityEvent;
const logRequest = (req) => {
    logger.debug('Incoming Request', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        body: req.body,
        params: req.params,
        query: req.query,
    });
};
exports.logRequest = logRequest;
const logError = (error, req) => {
    const errorDetails = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
    };
    if (req) {
        Object.assign(errorDetails, {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    logger.error('Application Error', errorDetails);
};
exports.logError = logError;
const logPayment = (userId, orderId, amount, status, provider) => {
    logger.info('Payment Transaction', {
        userId,
        orderId,
        amount,
        status,
        provider,
        timestamp: new Date().toISOString(),
    });
};
exports.logPayment = logPayment;
const logAuth = (event, userId, ip, success = true) => {
    const level = success ? 'info' : 'warn';
    logger[level]('Authentication Event', {
        event,
        userId,
        ip,
        success,
        timestamp: new Date().toISOString(),
    });
};
exports.logAuth = logAuth;
const logDatabaseQuery = (query, duration, error) => {
    if (error) {
        logger.error('Database Query Error', {
            query,
            duration,
            error: error.message,
            stack: error.stack,
        });
    }
    else if (duration > 1000) {
        logger.warn('Slow Database Query', {
            query,
            duration: `${duration}ms`,
        });
    }
};
exports.logDatabaseQuery = logDatabaseQuery;
exports.default = logger;
//# sourceMappingURL=logger.js.map