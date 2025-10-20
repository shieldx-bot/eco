"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '12', type, category, search, sort = 'created_at', order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
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
        const params = [];
        let paramCount = 0;
        if (type) {
            paramCount++;
            query += ` AND p.type = $${paramCount}`;
            params.push(type);
        }
        if (category) {
            paramCount++;
            query += ` AND p.id IN (
        SELECT pc.product_id FROM product_categories pc
        JOIN categories c ON pc.category_id = c.id
        WHERE c.slug = $${paramCount}
      )`;
            params.push(category);
        }
        if (search) {
            paramCount++;
            query += ` AND (p.title ILIKE $${paramCount} OR p.short_description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        query += ` GROUP BY p.id`;
        const validSortFields = ['created_at', 'price_cents', 'title'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY p.${sortField} ${sortOrder}`;
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limit);
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);
        const result = await database_1.default.query(query, params);
        let countQuery = 'SELECT COUNT(*) FROM products WHERE published = true';
        const countParams = [];
        let countParamIndex = 0;
        if (type) {
            countParamIndex++;
            countQuery += ` AND type = $${countParamIndex}`;
            countParams.push(type);
        }
        if (search) {
            countParamIndex++;
            countQuery += ` AND (title ILIKE $${countParamIndex} OR short_description ILIKE $${countParamIndex})`;
            countParams.push(`%${search}%`);
        }
        const countResult = await database_1.default.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        res.json({
            products: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await database_1.default.query(`SELECT 
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
      GROUP BY p.id`, [slug]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ product: result.rows[0] });
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
router.post('/', auth_1.authenticateToken, auth_1.isAdmin, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('price_cents').isInt({ min: 0 }).withMessage('Price must be a positive integer'),
    (0, express_validator_1.body)('type').isIn(['account', 'api_package']).withMessage('Invalid product type'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { title, short_description, content, price_cents, currency = 'USD', stock, type, seo_title, seo_description, canonical_url, json_ld, published = true, images = [], categories = [], } = req.body;
        const slug = (0, helpers_1.generateSlug)(title);
        const existingProduct = await database_1.default.query('SELECT id FROM products WHERE slug = $1', [slug]);
        if (existingProduct.rows.length > 0) {
            return res.status(409).json({ error: 'Product with this title already exists' });
        }
        const productResult = await database_1.default.query(`INSERT INTO products 
        (slug, title, short_description, content, price_cents, currency, stock, type, 
         seo_title, seo_description, canonical_url, json_ld, published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`, [
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
        ]);
        const product = productResult.rows[0];
        if (images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                await database_1.default.query('INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)', [product.id, images[i].url, images[i].alt || title, i]);
            }
        }
        if (categories.length > 0) {
            for (const categoryId of categories) {
                await database_1.default.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)', [product.id, categoryId]);
            }
        }
        res.status(201).json({
            message: 'Product created successfully',
            product,
        });
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});
router.put('/:id', auth_1.authenticateToken, auth_1.isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, short_description, content, price_cents, currency, stock, type, seo_title, seo_description, canonical_url, json_ld, published, } = req.body;
        let slug;
        if (title) {
            slug = (0, helpers_1.generateSlug)(title);
        }
        const result = await database_1.default.query(`UPDATE products SET
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
      RETURNING *`, [
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
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({
            message: 'Product updated successfully',
            product: result.rows[0],
        });
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
router.get('/categories/all', async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM categories ORDER BY name');
        res.json({ categories: result.rows });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map