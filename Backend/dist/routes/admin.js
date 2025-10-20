"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};
router.get('/stats', auth_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const revenueResult = await database_1.default.query(`SELECT SUM(total_cents) as total_revenue 
       FROM orders 
       WHERE status = 'completed'`);
        const ordersResult = await database_1.default.query('SELECT COUNT(*) as total_orders FROM orders');
        const usersResult = await database_1.default.query('SELECT COUNT(*) as total_users FROM users');
        const productsResult = await database_1.default.query('SELECT COUNT(*) as total_products FROM products');
        const revenueChangeResult = await database_1.default.query(`SELECT 
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN total_cents ELSE 0 END) as current_period,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN total_cents ELSE 0 END) as previous_period
       FROM orders 
       WHERE status = 'completed'`);
        const currentRevenue = parseInt(revenueChangeResult.rows[0].current_period) || 0;
        const previousRevenue = parseInt(revenueChangeResult.rows[0].previous_period) || 0;
        const revenueChange = previousRevenue > 0
            ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
            : 0;
        res.json({
            stats: {
                total_revenue: parseInt(revenueResult.rows[0].total_revenue) || 0,
                total_orders: parseInt(ordersResult.rows[0].total_orders) || 0,
                total_users: parseInt(usersResult.rows[0].total_users) || 0,
                total_products: parseInt(productsResult.rows[0].total_products) || 0,
                revenue_change: revenueChange,
                orders_change: 0,
            },
        });
    }
    catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
router.get('/orders', auth_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, limit = '50' } = req.query;
        let query = `
      SELECT o.*, u.email as user_email,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
    `;
        const params = [];
        if (status && status !== 'all') {
            query += ` WHERE o.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await database_1.default.query(query, params);
        res.json({
            orders: result.rows,
        });
    }
    catch (error) {
        console.error('Get admin orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
router.get('/users', auth_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT u.id, u.email, u.full_name, u.role, u.created_at,
        COUNT(DISTINCT o.id) as orders_count,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_cents ELSE 0 END), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`);
        res.json({
            users: result.rows,
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/orders/:id', auth_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const orderResult = await database_1.default.query(`SELECT o.*, u.email as user_email, u.full_name as user_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`, [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const itemsResult = await database_1.default.query(`SELECT oi.*, p.title as product_title
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`, [id]);
        const order = orderResult.rows[0];
        order.items = itemsResult.rows;
        res.json({ order });
    }
    catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});
router.patch('/orders/:id/status', auth_1.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const result = await database_1.default.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({
            message: 'Order status updated successfully',
            order: result.rows[0],
        });
    }
    catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map