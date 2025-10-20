import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
declare const logger: winston.Logger;
export declare const loggerMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const logSecurityEvent: (event: string, details: any, level?: "info" | "warn" | "error") => void;
export declare const logRequest: (req: Request) => void;
export declare const logError: (error: Error, req?: Request) => void;
export declare const logPayment: (userId: number, orderId: number, amount: number, status: string, provider: string) => void;
export declare const logAuth: (event: "login" | "logout" | "register" | "failed_login" | "password_reset", userId: number | null, ip: string, success?: boolean) => void;
export declare const logDatabaseQuery: (query: string, duration: number, error?: Error) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map