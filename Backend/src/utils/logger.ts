import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  
  // File transport for errors
  new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new DailyRotateFile({
    filename: path.join('logs', 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    ),
  }),
  
  // File transport for HTTP requests
  new DailyRotateFile({
    filename: path.join('logs', 'http-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'http',
    maxSize: '20m',
    maxFiles: '7d',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

/**
 * Logger Middleware
 * Ghi log tất cả HTTP requests
 */
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`;
    
    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });
  
  next();
};

/**
 * Security Logger
 * Ghi log các security events
 */
export const logSecurityEvent = (event: string, details: any, level: 'info' | 'warn' | 'error' = 'warn') => {
  const message = `🔒 SECURITY EVENT: ${event}`;
  logger[level](message, { event, details, timestamp: new Date().toISOString() });
};

/**
 * Request Logger
 * Ghi log chi tiết của requests (cho debugging)
 */
export const logRequest = (req: Request) => {
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

/**
 * Error Logger
 * Ghi log errors với stack trace
 */
export const logError = (error: Error, req?: Request) => {
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

/**
 * Payment Logger
 * Ghi log các payment transactions (sensitive data)
 */
export const logPayment = (
  userId: number, 
  orderId: number, 
  amount: number, 
  status: string, 
  provider: string
) => {
  logger.info('Payment Transaction', {
    userId,
    orderId,
    amount,
    status,
    provider,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Authentication Logger
 * Ghi log authentication events
 */
export const logAuth = (
  event: 'login' | 'logout' | 'register' | 'failed_login' | 'password_reset',
  userId: number | null,
  ip: string,
  success: boolean = true
) => {
  const level = success ? 'info' : 'warn';
  logger[level]('Authentication Event', {
    event,
    userId,
    ip,
    success,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Database Query Logger
 * Ghi log slow queries hoặc errors
 */
export const logDatabaseQuery = (
  query: string,
  duration: number,
  error?: Error
) => {
  if (error) {
    logger.error('Database Query Error', {
      query,
      duration,
      error: error.message,
      stack: error.stack,
    });
  } else if (duration > 1000) { // Log slow queries (> 1s)
    logger.warn('Slow Database Query', {
      query,
      duration: `${duration}ms`,
    });
  }
};

export default logger;
