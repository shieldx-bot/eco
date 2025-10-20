export interface User {
    id: string;
    email: string;
    password_hash: string;
    name: string | null;
    role: 'customer' | 'admin';
    created_at: Date;
    updated_at: Date;
}
export interface Product {
    id: string;
    slug: string;
    title: string;
    short_description: string | null;
    content: string | null;
    price_cents: number;
    currency: string;
    stock: number | null;
    type: 'account' | 'api_package';
    seo_title: string | null;
    seo_description: string | null;
    canonical_url: string | null;
    json_ld: Record<string, any> | null;
    published: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface ProductImage {
    id: string;
    product_id: string;
    url: string;
    alt: string | null;
}
export interface Order {
    id: string;
    user_id: string;
    total_cents: number;
    currency: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    payment_method: 'stripe' | 'paypal';
    payment_intent_id: string | null;
    items: OrderItem[];
    billing_info: Record<string, any> | null;
    created_at: Date;
    updated_at: Date;
}
export interface OrderItem {
    product_id: string;
    product_title: string;
    quantity: number;
    price_cents: number;
}
export interface Cart {
    id: string;
    user_id: string | null;
    items: CartItem[];
    updated_at: Date;
}
export interface CartItem {
    product_id: string;
    quantity: number;
    price_cents: number;
}
export interface Coupon {
    id: string;
    code: string;
    discount_percent: number | null;
    discount_cents: number | null;
    valid_from: Date;
    valid_until: Date;
    max_uses: number | null;
    used_count: number;
    active: boolean;
}
export interface AccountCredential {
    id: string;
    order_id: string;
    product_id: string;
    credentials: Record<string, any>;
    delivered: boolean;
    created_at: Date;
}
//# sourceMappingURL=index.d.ts.map