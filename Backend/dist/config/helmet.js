"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSecurityHeaders = exports.sessionOptions = exports.secureCookieOptions = exports.corsOptions = exports.customSecurityHeaders = exports.helmetConfig = void 0;
const helmet_1 = __importDefault(require("helmet"));
exports.helmetConfig = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            fontSrc: ["'self'", 'https:', 'data:'],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            objectSrc: ["'none'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://js.stripe.com',
                'https://checkout.stripe.com',
            ],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            connectSrc: [
                "'self'",
                'https://api.stripe.com',
                'https://checkout.stripe.com',
                process.env.FRONTEND_URL || 'http://localhost:3000',
            ],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: {
        action: 'deny',
    },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
    xssFilter: true,
});
const customSecurityHeaders = (req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (req.path === '/api/auth/logout') {
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};
exports.customSecurityHeaders = customSecurityHeaders;
exports.corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'https://checkout.stripe.com',
            'https://js.stripe.com',
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-CSRF-Token',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 600,
};
exports.secureCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
};
exports.sessionOptions = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
    },
    name: 'sessionId',
};
const checkSecurityHeaders = (_req, res, next) => {
    const requiredHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Strict-Transport-Security',
        'Content-Security-Policy',
    ];
    res.on('finish', () => {
        const missingHeaders = requiredHeaders.filter(header => !res.getHeader(header));
        if (missingHeaders.length > 0 && process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Missing security headers: ${missingHeaders.join(', ')}`);
        }
    });
    next();
};
exports.checkSecurityHeaders = checkSecurityHeaders;
//# sourceMappingURL=helmet.js.map