import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user's cart
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM carts WHERE user_id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.json({ cart: { items: [] } });
    }

    const cart = result.rows[0];

    // Fetch product details for cart items
    if (cart.items && cart.items.length > 0) {
      const productIds = cart.items.map((item: any) => item.product_id);
      const products = await pool.query(
        `SELECT id, title, slug, price_cents, stock, 
         (SELECT url FROM product_images WHERE product_id = products.id LIMIT 1) as image_url
         FROM products WHERE id = ANY($1)`,
        [productIds]
      );

      const productMap = new Map(products.rows.map(p => [p.id, p]));

      cart.items = cart.items.map((item: any) => ({
        ...item,
        product: productMap.get(item.product_id) || null,
      }));
    }

    res.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post(
  '/add',
  authenticateToken,
  [
    body('product_id').isUUID().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { product_id, quantity } = req.body;

      // Check product exists and get price
      const product = await pool.query(
        'SELECT id, price_cents, stock FROM products WHERE id = $1 AND published = true',
        [product_id]
      );

      if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const { price_cents, stock } = product.rows[0];

      // Check stock availability
      if (stock !== null && stock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      // Get or create cart
      let cart = await pool.query(
        'SELECT * FROM carts WHERE user_id = $1',
        [req.user!.id]
      );

      let items: any[] = [];

      if (cart.rows.length === 0) {
        // Create new cart
        items = [{ product_id, quantity, price_cents }];
        cart = await pool.query(
          'INSERT INTO carts (user_id, items) VALUES ($1, $2) RETURNING *',
          [req.user!.id, JSON.stringify(items)]
        );
      } else {
        // Update existing cart
        items = cart.rows[0].items || [];
        const existingItemIndex = items.findIndex((item: any) => item.product_id === product_id);

        if (existingItemIndex >= 0) {
          // Update quantity
          items[existingItemIndex].quantity += quantity;
        } else {
          // Add new item
          items.push({ product_id, quantity, price_cents });
        }

        cart = await pool.query(
          'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
          [JSON.stringify(items), req.user!.id]
        );
      }

      res.json({
        message: 'Item added to cart',
        cart: cart.rows[0],
      });
    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({ error: 'Failed to add item to cart' });
    }
  }
);

// Update cart item quantity
router.put(
  '/item/:product_id',
  authenticateToken,
  [body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive integer')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { product_id } = req.params;
      const { quantity } = req.body;

      const cart = await pool.query(
        'SELECT * FROM carts WHERE user_id = $1',
        [req.user!.id]
      );

      if (cart.rows.length === 0) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      let items: any[] = cart.rows[0].items || [];

      if (quantity === 0) {
        // Remove item from cart
        items = items.filter((item: any) => item.product_id !== product_id);
      } else {
        // Update quantity
        const itemIndex = items.findIndex((item: any) => item.product_id === product_id);
        if (itemIndex >= 0) {
          items[itemIndex].quantity = quantity;
        } else {
          return res.status(404).json({ error: 'Item not found in cart' });
        }
      }

      const result = await pool.query(
        'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [JSON.stringify(items), req.user!.id]
      );

      res.json({
        message: quantity === 0 ? 'Item removed from cart' : 'Cart updated',
        cart: result.rows[0],
      });
    } catch (error) {
      console.error('Update cart error:', error);
      res.status(500).json({ error: 'Failed to update cart' });
    }
  }
);

// Remove item from cart
router.delete('/item/:product_id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id } = req.params;

    const cart = await pool.query(
      'SELECT * FROM carts WHERE user_id = $1',
      [req.user!.id]
    );

    if (cart.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    let items: any[] = cart.rows[0].items || [];
    items = items.filter((item: any) => item.product_id !== product_id);

    const result = await pool.query(
      'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [JSON.stringify(items), req.user!.id]
    );

    res.json({
      message: 'Item removed from cart',
      cart: result.rows[0],
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear cart
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify([]), req.user!.id]
    );

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router;
