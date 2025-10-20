import { Request, Response, NextFunction } from 'express';
export declare const generateCsrfToken: () => string;
export declare const csrfTokenGenerator: (_req: Request, res: Response, next: NextFunction) => void;
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const originCheck: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const attachCsrfToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const getCsrfToken: (_req: Request, res: Response) => void;
//# sourceMappingURL=csrf.d.ts.map