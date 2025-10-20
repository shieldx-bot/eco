import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Advanced Helmet Configuration
 * Cấu hình các security headers để bảo vệ khỏi nhiều loại tấn công
 */

export const helmetConfig = helmet({
  // Content Security Policy - Chống XSS attacks
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
        "'unsafe-inline'", // Required for Stripe
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

  // Cross-Origin Policies
  crossOriginEmbedderPolicy: false, // Disable for third-party integrations (Stripe, PayPal)
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frame Options - Chống Clickjacking
  frameguard: {
    action: 'deny', // Không cho phép trang được nhúng trong iframe
  },

  // Hide Powered By header
  hidePoweredBy: true,

  // HTTP Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff - Chống MIME type sniffing
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },

  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // X-XSS-Protection (legacy but still useful)
  xssFilter: true,
});

/**
 * Custom Security Headers Middleware
 * Thêm các custom security headers
 */
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options (backup for older browsers)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Download-Options
  res.setHeader('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Clear-Site-Data (for logout endpoints)
  if (req.path === '/api/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  // Server header removal (hide technology stack)
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * CORS Configuration with Security
 * Cấu hình CORS an toàn
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://checkout.stripe.com',
      'https://js.stripe.com',
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
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
  maxAge: 600, // Cache preflight request for 10 minutes
};

/**
 * Secure Cookie Options
 * Cấu hình cookie an toàn
 */
export const secureCookieOptions = {
  httpOnly: true, // Không cho JavaScript truy cập
  secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS trong production
  sameSite: 'strict' as const, // Chống CSRF
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  domain: process.env.COOKIE_DOMAIN,
  path: '/',
};

/**
 * Session Security Options
 */
export const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: 'sessionId', // Đổi tên mặc định để không lộ technology stack
};

/**
 * Security Headers Checker Middleware
 * Kiểm tra và log các security headers
 */
export const checkSecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Strict-Transport-Security',
    'Content-Security-Policy',
  ];

  res.on('finish', () => {
    const missingHeaders = requiredHeaders.filter(
      header => !res.getHeader(header)
    );

    if (missingHeaders.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Missing security headers: ${missingHeaders.join(', ')}`);
    }
  });

  next();
};
