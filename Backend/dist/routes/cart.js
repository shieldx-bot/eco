"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.json({ cart: { items: [] } });
        }
        const cart = result.rows[0];
        if (cart.items && cart.items.length > 0) {
            const productIds = cart.items.map((item) => item.product_id);
            const products = await database_1.default.query(`SELECT id, title, slug, price_cents, stock, 
         (SELECT url FROM product_images WHERE product_id = products.id LIMIT 1) as image_url
         FROM products WHERE id = ANY($1)`, [productIds]);
            const productMap = new Map(products.rows.map(p => [p.id, p]));
            cart.items = cart.items.map((item) => ({
                ...item,
                product: productMap.get(item.product_id) || null,
            }));
        }
        res.json({ cart });
    }
    catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});
router.post('/add', auth_1.authenticateToken, [
    (0, express_validator_1.body)('product_id').isUUID().withMessage('Invalid product ID'),
    (0, express_validator_1.body)('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { product_id, quantity } = req.body;
        const product = await database_1.default.query('SELECT id, price_cents, stock FROM products WHERE id = $1 AND published = true', [product_id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const { price_cents, stock } = product.rows[0];
        if (stock !== null && stock < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }
        let cart = await database_1.default.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
        let items = [];
        if (cart.rows.length === 0) {
            items = [{ product_id, quantity, price_cents }];
            cart = await database_1.default.query('INSERT INTO carts (user_id, items) VALUES ($1, $2) RETURNING *', [req.user.id, JSON.stringify(items)]);
        }
        else {
            items = cart.rows[0].items || [];
            const existingItemIndex = items.findIndex((item) => item.product_id === product_id);
            if (existingItemIndex >= 0) {
                items[existingItemIndex].quantity += quantity;
            }
            else {
                items.push({ product_id, quantity, price_cents });
            }
            cart = await database_1.default.query('UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *', [JSON.stringify(items), req.user.id]);
        }
        res.json({
            message: 'Item added to cart',
            cart: cart.rows[0],
        });
    }
    catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add item to cart' });
    }
});
router.put('/item/:product_id', auth_1.authenticateToken, [(0, express_validator_1.body)('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive integer')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { product_id } = req.params;
        const { quantity } = req.body;
        const cart = await database_1.default.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
        if (cart.rows.length === 0) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        let items = cart.rows[0].items || [];
        if (quantity === 0) {
            items = items.filter((item) => item.product_id !== product_id);
        }
        else {
            const itemIndex = items.findIndex((item) => item.product_id === product_id);
            if (itemIndex >= 0) {
                items[itemIndex].quantity = quantity;
            }
            else {
                return res.status(404).json({ error: 'Item not found in cart' });
            }
        }
        const result = await database_1.default.query('UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *', [JSON.stringify(items), req.user.id]);
        res.json({
            message: quantity === 0 ? 'Item removed from cart' : 'Cart updated',
            cart: result.rows[0],
        });
    }
    catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});
router.delete('/item/:product_id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { product_id } = req.params;
        const cart = await database_1.default.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
        if (cart.rows.length === 0) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        let items = cart.rows[0].items || [];
        items = items.filter((item) => item.product_id !== product_id);
        const result = await database_1.default.query('UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *', [JSON.stringify(items), req.user.id]);
        res.json({
            message: 'Item removed from cart',
            cart: result.rows[0],
        });
    }
    catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
});
router.delete('/', auth_1.authenticateToken, async (req, res) => {
    try {
        await database_1.default.query('UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2', [JSON.stringify([]), req.user.id]);
        res.json({ message: 'Cart cleared' });
    }
    catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});
exports.default = router;
//# sourceMappingURL=cart.js.map