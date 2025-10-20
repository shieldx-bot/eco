import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Bảo vệ khỏi Cross-Site Request Forgery attacks
 * Sử dụng Double Submit Cookie pattern
 */

interface CSRFTokenStore {
  [key: string]: number; // token: timestamp
}

// In-memory token store (in production, use Redis or database)
const tokenStore: CSRFTokenStore = {};

// Token cleanup interval (remove expired tokens every hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  Object.keys(tokenStore).forEach(token => {
    if (now - tokenStore[token] > oneHour) {
      delete tokenStore[token];
    }
  });
}, 60 * 60 * 1000);

/**
 * Generate CSRF Token
 */
export const generateCsrfToken = (): string => {
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore[token] = Date.now();
  return token;
};

/**
 * Verify CSRF Token
 */
const verifyCsrfToken = (token: string): boolean => {
  if (!token || !tokenStore[token]) {
    return false;
  }

  const now = Date.now();
  const tokenAge = now - tokenStore[token];
  const maxAge = 60 * 60 * 1000; // 1 hour

  // Check if token is expired
  if (tokenAge > maxAge) {
    delete tokenStore[token];
    return false;
  }

  return true;
};

/**
 * CSRF Token Generation Endpoint Middleware
 * Tạo và gửi CSRF token cho client
 */
export const csrfTokenGenerator = (_req: Request, res: Response, next: NextFunction): void => {
  const token = generateCsrfToken();
  
  // Set token in cookie (HttpOnly for security)
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Must be readable by JavaScript for sending in headers
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Also attach to response for SPA to read
  res.locals.csrfToken = token;
  
  next();
};

/**
 * CSRF Protection Middleware
 * Kiểm tra CSRF token cho các mutation requests (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for webhook endpoints
  const webhookPaths = ['/api/payments/webhook/stripe', '/api/payments/webhook/paypal'];
  if (webhookPaths.some(path => req.path.includes(path))) {
    return next();
  }

  // Get token from header or body
  const token = 
    req.headers['x-csrf-token'] as string ||
    req.headers['x-xsrf-token'] as string ||
    req.body?._csrf ||
    req.query?._csrf as string;

  // Get token from cookie
  const cookieToken = req.cookies['XSRF-TOKEN'];

  // Verify tokens match and are valid
  if (!token || !cookieToken || token !== cookieToken || !verifyCsrfToken(token)) {
    return res.status(403).json({
      error: 'CSRF Token Validation Failed',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
    });
  }

  next();
};

/**
 * Simple CSRF Protection for API (using Origin header)
 * Kiểm tra Origin header để đảm bảo request đến từ trusted domain
 */
export const originCheck = (req: Request, res: Response, next: NextFunction) => {
  // Skip for safe methods
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
    // No origin header (could be from Postman, mobile app, etc.)
    // In production, you might want to block these
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin header is required',
      });
    }
    return next();
  }

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (!allowed) return false;
    try {
      const originUrl = new URL(origin);
      const allowedUrl = new URL(allowed);
      return originUrl.origin === allowedUrl.origin;
    } catch {
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

/**
 * Add CSRF token to response
 * Helper middleware để attach CSRF token vào response
 */
export const attachCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && !req.path.includes('/api/')) {
    const token = generateCsrfToken();
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });
  }
  next();
};

/**
 * CSRF Token Endpoint
 * Endpoint để lấy CSRF token
 */
export const getCsrfToken = (_req: Request, res: Response): void => {
  const token = generateCsrfToken();
  
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
  });

  res.json({
    csrfToken: token,
    expiresIn: 3600, // seconds
  });
};
