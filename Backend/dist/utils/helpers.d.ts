export declare const generateSlug: (title: string) => string;
export declare const formatPrice: (cents: number, currency?: string) => string;
export declare const validateEmail: (email: string) => boolean;
export declare const validatePassword: (password: string) => {
    valid: boolean;
    message?: string;
};
export declare const sanitizeUserData: (user: any) => any;
//# sourceMappingURL=helpers.d.ts.map