"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const security_1 = require("./middleware/security");
const csrf_1 = require("./middleware/csrf");
const logger_1 = require("./utils/logger");
const helmet_1 = require("./config/helmet");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
app.use(helmet_1.helmetConfig);
app.use(helmet_1.customSecurityHeaders);
app.use((0, cors_1.default)(helmet_1.corsOptions));
app.use(logger_1.loggerMiddleware);
app.use(security_1.compressionMiddleware);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(security_1.requestSizeLimiter);
app.use(security_1.sanitizeData);
app.use(security_1.xssProtection);
app.use(security_1.preventHpp);
app.use(security_1.detectSuspiciousActivity);
app.use(csrf_1.originCheck);
app.use(security_1.speedLimiter);
app.use('/api/', security_1.apiLimiter);
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'AI Commerce API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
app.get('/api/csrf-token', csrf_1.getCsrfToken);
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const payments_1 = __importDefault(require("./routes/payments"));
const admin_1 = __importDefault(require("./routes/admin"));
const blog_1 = __importDefault(require("./routes/blog"));
app.use('/api/auth', security_1.authLimiter, auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/cart', cart_1.default);
app.use('/api/orders', security_1.orderLimiter, orders_1.default);
app.use('/api/payments', security_1.paymentLimiter, payments_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/blogs', blog_1.default);
app.use(errorHandler_1.notFound);
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map