import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiting Middleware - DDoS Protection
 * Giới hạn số request từ 1 IP trong khoảng thời gian
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900)
    });
  }
});

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register requests per windowMs
  message: 'Too many authentication attempts, please try again after 15 minutes',
  skipSuccessfulRequests: false, // Count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Login Attempts',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900)
    });
  }
});

// Payment rate limiter - 3 requests per 10 minutes
export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 payment requests per windowMs
  message: 'Too many payment attempts, please try again after 10 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Payment Attempts',
      message: 'You have exceeded the payment request limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 600)
    });
  }
});

// Create order rate limiter - 10 requests per 30 minutes
export const orderLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10,
  message: 'Too many order creation attempts',
  standardHeaders: true,
  legacyHeaders: false
});

// Password reset limiter - 3 requests per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset attempts, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Speed Limiter - Slow down repeated requests
 * Làm chậm response time khi có quá nhiều requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes, then...
  delayMs: (hits) => hits * 100, // Add 100ms of delay per request above 50
  maxDelayMs: 5000, // Maximum delay of 5 seconds
});

/**
 * MongoDB Query Sanitization
 * Chống NoSQL injection attacks
 */
export const sanitizeData = mongoSanitize({
  replaceWith: '_', // Replace prohibited characters with underscore
  onSanitize: ({ key }) => {
    console.warn(`Sanitized request data. Key: ${key}`);
  }
});

/**
 * HTTP Parameter Pollution Protection
 * Chống tấn công thông qua duplicate parameters
 */
export const preventHpp = hpp({
  whitelist: ['price', 'rating', 'category', 'tags'] // Allow these parameters to be arrays
});

/**
 * Compression Middleware
 * Nén response để giảm bandwidth
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6 // Compression level (0-9)
});

/**
 * Request Size Limiter
 * Giới hạn kích thước request body
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    res.status(413).json({
      error: 'Payload Too Large',
      message: `Request body too large. Maximum allowed size is ${maxSize / 1024 / 1024}MB`
    });
    return;
  }

  next();
};

/**
 * IP Whitelist/Blacklist Middleware
 * Chặn hoặc cho phép specific IPs
 */
const BLACKLISTED_IPS: string[] = process.env.BLACKLISTED_IPS?.split(',') || [];
const WHITELISTED_IPS: string[] = process.env.WHITELISTED_IPS?.split(',') || [];

export const ipFilter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || req.socket.remoteAddress || '';

  // Check whitelist first (if configured)
  if (WHITELISTED_IPS.length > 0 && !WHITELISTED_IPS.includes(clientIp)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address is not authorized to access this resource'
    });
    return;
  }

  // Check blacklist
  if (BLACKLISTED_IPS.includes(clientIp)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address has been blocked'
    });
    return;
  }

  next();
};

/**
 * Suspicious Activity Detector
 * Phát hiện các pattern tấn công phổ biến
 */
export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.headers['user-agent'] || '';
  const url = req.url;
  const body = JSON.stringify(req.body);

  // Detect SQL injection attempts
  const sqlPatterns = [
    /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b)/gi,
    /(\bunion\b.*\bselect\b|\bor\b.*=.*)/gi,
    /(--|;|\/\*|\*\/)/g
  ];

  // Detect XSS attempts
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  // Detect path traversal
  const pathTraversalPattern = /\.\.[\/\\]/g;

  // Check for suspicious patterns
  const suspicious = 
    sqlPatterns.some(pattern => pattern.test(url) || pattern.test(body)) ||
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

/**
 * Advanced XSS Protection (fallback since xss-clean is deprecated)
 * Sanitize user input to prevent XSS attacks
 */
export const xssProtection = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove script tags and event handlers
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
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    
    return value;
  };

  // Sanitize request body, query params, and URL params
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
