import { Request, Response, NextFunction } from 'express';
export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const paymentLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const orderLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const passwordResetLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const speedLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const sanitizeData: import("express").Handler;
export declare const preventHpp: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const compressionMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const requestSizeLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const ipFilter: (req: Request, res: Response, next: NextFunction) => void;
export declare const detectSuspiciousActivity: (req: Request, res: Response, next: NextFunction) => void;
export declare const xssProtection: (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map