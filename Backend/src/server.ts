import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler, notFound } from './middleware/errorHandler';

// Security middleware
import {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  orderLimiter,
  speedLimiter,
  sanitizeData,
  preventHpp,
  compressionMiddleware,
  requestSizeLimiter,
  detectSuspiciousActivity,
  xssProtection,
} from './middleware/security';

import { originCheck, getCsrfToken } from './middleware/csrf';
import { loggerMiddleware } from './utils/logger';
import { helmetConfig, customSecurityHeaders, corsOptions } from './config/helmet';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Important for rate limiting and IP detection
app.set('trust proxy', 1);

// Security Headers (must be first)
app.use(helmetConfig);
app.use(customSecurityHeaders);

// CORS with security configuration
app.use(cors(corsOptions));

// Request logging
app.use(loggerMiddleware);

// Compression
app.use(compressionMiddleware);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
app.use(requestSizeLimiter);
app.use(sanitizeData); // NoSQL injection protection
app.use(xssProtection); // XSS protection
app.use(preventHpp); // HTTP Parameter Pollution protection
app.use(detectSuspiciousActivity); // Detect attacks
app.use(originCheck); // CSRF protection via Origin check

// Rate limiting (DDoS protection)
app.use(speedLimiter); // Slow down repeated requests
app.use('/api/', apiLimiter); // General API rate limiting

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Commerce API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// CSRF Token endpoint
app.get('/api/csrf-token', getCsrfToken);

// Serve static files from uploads directory
app.use('/uploads', express.static('public/uploads'));

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import blogRoutes from './routes/blog';
import uploadRoutes from './routes/upload';

// API Routes with specific rate limiters
app.use('/api/auth', authLimiter, authRoutes); // Strict rate limit for auth
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderLimiter, orderRoutes); // Rate limit for orders
app.use('/api/payments', paymentLimiter, paymentRoutes); // Strict rate limit for payments
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes); // Blog routes
app.use('/api/upload', uploadRoutes); // Upload routes

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});

export default app;
