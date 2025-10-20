import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate order number
function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `ORD-${dateStr}-${random}`;
}

// Create order
router.post(
  '/',
  authenticateToken,
  [
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('billing_info').optional().isObject(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { items, billing_info, coupon_code } = req.body;

      // Validate products and calculate total
      let total_cents = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const product = await pool.query(
          'SELECT id, title, price_cents, stock FROM products WHERE id = $1 AND published = true',
          [item.product_id]
        );

        if (product.rows.length === 0) {
          return res.status(404).json({ error: `Product ${item.product_id} not found` });
        }

        const { title, price_cents, stock } = product.rows[0];

        if (stock !== null && stock < item.quantity) {
          return res.status(400).json({ error: `Insufficient stock for ${title}` });
        }

        orderItems.push({
          product_id: item.product_id,
          product_title: title,
          quantity: item.quantity,
          price_cents,
        });

        total_cents += price_cents * item.quantity;
      }

      // Apply coupon if provided
      let discountAmount = 0;
      if (coupon_code) {
        const coupon = await pool.query(
          `SELECT * FROM coupons 
           WHERE code = $1 
           AND active = true 
           AND valid_from <= NOW() 
           AND (valid_until IS NULL OR valid_until >= NOW())
           AND (max_uses IS NULL OR used_count < max_uses)`,
          [coupon_code]
        );

        if (coupon.rows.length > 0) {
          const { type, discount_percent, discount_cents } = coupon.rows[0];
          
          if (type === 'percent' && discount_percent) {
            discountAmount = Math.floor(total_cents * (discount_percent / 100));
          } else if (type === 'fixed' && discount_cents) {
            discountAmount = discount_cents;
          }

          total_cents = Math.max(0, total_cents - discountAmount);

          // Increment coupon usage
          await pool.query(
            'UPDATE coupons SET used_count = used_count + 1 WHERE code = $1',
            [coupon_code]
          );
        }
      }

      // Create order
      const orderNumber = generateOrderNumber();
      const result = await pool.query(
        `INSERT INTO orders 
        (user_id, order_number, total_cents, items, billing_info, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          req.user!.id,
          orderNumber,
          total_cents,
          JSON.stringify(orderItems),
          billing_info ? JSON.stringify(billing_info) : null,
          'pending',
          JSON.stringify({ coupon_code, discount_amount: discountAmount }),
        ]
      );

      // Clear cart after order creation
      await pool.query(
        'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2',
        [JSON.stringify([]), req.user!.id]
      );

      res.status(201).json({
        message: 'Order created successfully',
        order: result.rows[0],
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

// Get user's orders
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [req.user!.id]
    );

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get account credentials if order is paid
    if (result.rows[0].status === 'paid') {
      const credentials = await pool.query(
        'SELECT * FROM account_credentials WHERE order_id = $1',
        [id]
      );
      result.rows[0].credentials = credentials.rows;
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Cancel order (only if pending)
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE orders 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    }

    res.json({
      message: 'Order cancelled successfully',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Get user's account credentials
router.get('/credentials', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ac.*, o.order_number, p.title as product_title
       FROM account_credentials ac
       JOIN orders o ON ac.order_id = o.id
       JOIN products p ON ac.product_id = p.id
       WHERE o.user_id = $1
       ORDER BY ac.created_at DESC`,
      [req.user!.id]
    );

    res.json({
      credentials: result.rows,
    });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

export default router;
