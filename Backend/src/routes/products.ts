import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticateToken, AuthRequest, isAdmin } from '../middleware/auth';
import { generateSlug } from '../utils/helpers';
import logger from '../utils/logger';

const router = Router();

// Get all products (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '12', 
      type, 
      category, 
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let query = `
      SELECT 
        p.*,
        COALESCE(json_agg(
          json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt)
        ) FILTER (WHERE pi.id IS NOT NULL), '[]') as images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.published = true
    `;
    
    const params: Array<string | number> = [];
    let paramCount = 0;

    // Filter by type
    if (type) {
      paramCount++;
      query += ` AND p.type = $${paramCount}`;
      params.push(String(type));
    }

    // Filter by category
    if (category) {
      paramCount++;
      query += ` AND p.id IN (
        SELECT pc.product_id FROM product_categories pc
        JOIN categories c ON pc.category_id = c.id
        WHERE c.slug = $${paramCount}
      )`;
      params.push(String(category));
    }

    // Search
    if (search) {
      paramCount++;
      query += ` AND (p.title ILIKE $${paramCount} OR p.short_description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY p.id`;

    // Sorting
    const validSortFields = ['created_at', 'price_cents', 'title'];
    const sortField = validSortFields.includes(sort as string) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY p.${sortField} ${sortOrder}`;

    // Pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(Number(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM products WHERE published = true';
    const countParams: Array<string | number> = [];
    let countParamIndex = 0;

    if (type) {
      countParamIndex++;
      countQuery += ` AND type = $${countParamIndex}`;
      countParams.push(String(type));
    }

    if (search) {
      countParamIndex++;
      countQuery += ` AND (title ILIKE $${countParamIndex} OR short_description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Get products error: ${msg}`);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by slug (public)
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT 
        p.*,
        COALESCE(json_agg(
          DISTINCT jsonb_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'sort_order', pi.sort_order)
          ORDER BY pi.sort_order
        ) FILTER (WHERE pi.id IS NOT NULL), '[]') as images,
        COALESCE(json_agg(
          DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
        ) FILTER (WHERE c.id IS NOT NULL), '[]') as categories
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE p.slug = $1 AND p.published = true
      GROUP BY p.id`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Get product error: ${msg}`);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product (admin only)
router.post(
  '/',
  authenticateToken,
  isAdmin,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('price_cents').isInt({ min: 0 }).withMessage('Price must be a positive integer'),
    body('type').isIn(['account', 'api_package']).withMessage('Invalid product type'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        short_description,
        content,
        price_cents,
        currency = 'USD',
        stock,
        type,
        seo_title,
        seo_description,
        canonical_url,
        json_ld,
        published = true,
        images = [],
        categories = [],
      } = req.body;

      // Generate slug
      const slug = generateSlug(title);

      // Check if slug already exists
      const existingProduct = await pool.query(
        'SELECT id FROM products WHERE slug = $1',
        [slug]
      );

      if (existingProduct.rows.length > 0) {
        return res.status(409).json({ error: 'Product with this title already exists' });
      }

      // Insert product
      const productResult = await pool.query(
        `INSERT INTO products 
        (slug, title, short_description, content, price_cents, currency, stock, type, 
         seo_title, seo_description, canonical_url, json_ld, published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          slug,
          title,
          short_description,
          content,
          price_cents,
          currency,
          stock,
          type,
          seo_title || title,
          seo_description || short_description,
          canonical_url,
          json_ld ? JSON.stringify(json_ld) : null,
          published,
        ]
      );

      const product = productResult.rows[0];

      // Insert images
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await pool.query(
            'INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)',
            [product.id, images[i].url, images[i].alt || title, i]
          );
        }
      }

      // Link categories
      if (categories.length > 0) {
        for (const categoryId of categories) {
          await pool.query(
            'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)',
            [product.id, categoryId]
          );
        }
      }

      res.status(201).json({
        message: 'Product created successfully',
        product,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Create product error: ${msg}`);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// Update product (admin only)
router.put('/:id', authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      short_description,
      content,
      price_cents,
      currency,
      stock,
      type,
      seo_title,
      seo_description,
      canonical_url,
      json_ld,
      published,
    } = req.body;

    // Generate new slug if title changed
    let slug;
    if (title) {
      slug = generateSlug(title);
    }

    const result = await pool.query(
      `UPDATE products SET
        slug = COALESCE($1, slug),
        title = COALESCE($2, title),
        short_description = COALESCE($3, short_description),
        content = COALESCE($4, content),
        price_cents = COALESCE($5, price_cents),
        currency = COALESCE($6, currency),
        stock = COALESCE($7, stock),
        type = COALESCE($8, type),
        seo_title = COALESCE($9, seo_title),
        seo_description = COALESCE($10, seo_description),
        canonical_url = COALESCE($11, canonical_url),
        json_ld = COALESCE($12, json_ld),
        published = COALESCE($13, published),
        updated_at = NOW()
      WHERE id = $14
      RETURNING *`,
      [
        slug,
        title,
        short_description,
        content,
        price_cents,
        currency,
        stock,
        type,
        seo_title,
        seo_description,
        canonical_url,
        json_ld ? JSON.stringify(json_ld) : null,
        published,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Update product error: ${msg}`);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Delete product error: ${msg}`);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get categories (public)
router.get('/categories/all', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Get categories error: ${msg}`);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
