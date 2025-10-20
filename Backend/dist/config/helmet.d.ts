import { Request, Response, NextFunction } from 'express';
export declare const helmetConfig: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const customSecurityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
    credentials: boolean;
    optionsSuccessStatus: number;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
};
export declare const secureCookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    maxAge: number;
    domain: string;
    path: string;
};
export declare const sessionOptions: {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    cookie: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "strict";
        maxAge: number;
    };
    name: string;
};
export declare const checkSecurityHeaders: (_req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=helmet.d.ts.map