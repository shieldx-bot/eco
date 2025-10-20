"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};
const calculateReadTime = (content) => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
};
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).toInt(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    (0, express_validator_1.query)('category').optional().isString(),
    (0, express_validator_1.query)('tag').optional().isString(),
    (0, express_validator_1.query)('search').optional().isString(),
    (0, express_validator_1.query)('sort').optional().isIn(['created_at', 'published_at', 'views', 'title']),
    (0, express_validator_1.query)('order').optional().isIn(['ASC', 'DESC']),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const tag = req.query.tag;
        const search = req.query.search;
        const sort = req.query.sort || 'published_at';
        const order = req.query.order || 'DESC';
        let whereConditions = ['blogs.status = $1'];
        let queryParams = ['published'];
        let paramIndex = 2;
        if (category) {
            whereConditions.push(`bc.slug = $${paramIndex}`);
            queryParams.push(category);
            paramIndex++;
        }
        if (tag) {
            whereConditions.push(`$${paramIndex} = ANY(blogs.tags)`);
            queryParams.push(tag);
            paramIndex++;
        }
        if (search) {
            whereConditions.push(`(blogs.title ILIKE $${paramIndex} OR blogs.excerpt ILIKE $${paramIndex} OR blogs.content ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = whereConditions.join(' AND ');
        const countQuery = `
        SELECT COUNT(DISTINCT blogs.id) as total
        FROM blogs
        LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
        WHERE ${whereClause}
      `;
        const countResult = await database_1.default.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total);
        const blogsQuery = `
        SELECT 
          blogs.id,
          blogs.title,
          blogs.slug,
          blogs.excerpt,
          blogs.featured_image,
          blogs.published_at,
          blogs.views,
          blogs.read_time_minutes,
          blogs.tags,
          bc.name as category_name,
          bc.slug as category_slug,
          bc.color as category_color,
          u.name as author_name,
          u.email as author_email
        FROM blogs
        LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
        LEFT JOIN users u ON blogs.author_id = u.id
        WHERE ${whereClause}
        ORDER BY blogs.${sort} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(blogsQuery, queryParams);
        res.json({
            success: true,
            blogs: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});
router.get('/:slug', (0, express_validator_1.param)('slug').isString(), async (req, res) => {
    try {
        const { slug } = req.params;
        const query = `
        SELECT 
          blogs.*,
          bc.name as category_name,
          bc.slug as category_slug,
          bc.color as category_color,
          u.name as author_name,
          u.email as author_email
        FROM blogs
        LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
        LEFT JOIN users u ON blogs.author_id = u.id
        WHERE blogs.slug = $1 AND blogs.status = 'published'
      `;
        const result = await database_1.default.query(query, [slug]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        await database_1.default.query('UPDATE blogs SET views = views + 1 WHERE id = $1', [
            result.rows[0].id,
        ]);
        res.json({
            success: true,
            blog: result.rows[0],
        });
    }
    catch (error) {
        console.error('Error fetching blog:', error);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});
router.get('/related/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const limit = parseInt(req.query.limit) || 3;
        const currentBlog = await database_1.default.query('SELECT category_id FROM blogs WHERE slug = $1', [slug]);
        if (currentBlog.rows.length === 0) {
            return res.json({ success: true, blogs: [] });
        }
        const categoryId = currentBlog.rows[0].category_id;
        const query = `
      SELECT 
        blogs.id,
        blogs.title,
        blogs.slug,
        blogs.excerpt,
        blogs.featured_image,
        blogs.published_at,
        blogs.read_time_minutes,
        bc.name as category_name,
        bc.slug as category_slug,
        bc.color as category_color
      FROM blogs
      LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
      WHERE blogs.status = 'published' 
        AND blogs.slug != $1
        AND blogs.category_id = $2
      ORDER BY blogs.published_at DESC
      LIMIT $3
    `;
        const result = await database_1.default.query(query, [slug, categoryId, limit]);
        res.json({
            success: true,
            blogs: result.rows,
        });
    }
    catch (error) {
        console.error('Error fetching related blogs:', error);
        res.status(500).json({ error: 'Failed to fetch related blogs' });
    }
});
router.get('/admin/all', auth_1.authenticateToken, auth_1.isAdmin, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).toInt(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    (0, express_validator_1.query)('status').optional().isIn(['draft', 'published', 'archived']),
    (0, express_validator_1.query)('search').optional().isString(),
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const search = req.query.search;
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        if (status) {
            whereConditions.push(`blogs.status = $${paramIndex}`);
            queryParams.push(status);
            paramIndex++;
        }
        if (search) {
            whereConditions.push(`(blogs.title ILIKE $${paramIndex} OR blogs.excerpt ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) as total FROM blogs ${whereClause}`;
        const countResult = await database_1.default.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total);
        const blogsQuery = `
        SELECT 
          blogs.*,
          bc.name as category_name,
          bc.slug as category_slug,
          u.name as author_name
        FROM blogs
        LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
        LEFT JOIN users u ON blogs.author_id = u.id
        ${whereClause}
        ORDER BY blogs.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(blogsQuery, queryParams);
        res.json({
            success: true,
            blogs: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Error fetching all blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});
router.post('/', auth_1.authenticateToken, auth_1.isAdmin, [
    (0, express_validator_1.body)('title').trim().notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('content').trim().notEmpty().withMessage('Content is required'),
    (0, express_validator_1.body)('excerpt').optional().trim(),
    (0, express_validator_1.body)('featured_image').optional().isURL(),
    (0, express_validator_1.body)('category_id').optional().isUUID(),
    (0, express_validator_1.body)('tags').optional().isArray(),
    (0, express_validator_1.body)('status').optional().isIn(['draft', 'published']),
    (0, express_validator_1.body)('meta_title').optional().trim(),
    (0, express_validator_1.body)('meta_description').optional().trim(),
    (0, express_validator_1.body)('keywords').optional().isArray(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { title, content, excerpt, featured_image, category_id, tags, status, meta_title, meta_description, keywords, } = req.body;
        let slug = generateSlug(title);
        const existingSlug = await database_1.default.query('SELECT id FROM blogs WHERE slug = $1', [slug]);
        if (existingSlug.rows.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }
        const readTime = calculateReadTime(content);
        const authorId = req.user.userId;
        const publishedAt = status === 'published' ? new Date().toISOString() : null;
        const query = `
        INSERT INTO blogs (
          title, slug, excerpt, content, featured_image,
          author_id, category_id, tags, status, published_at,
          meta_title, meta_description, keywords, read_time_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
        const values = [
            title,
            slug,
            excerpt || null,
            content,
            featured_image || null,
            authorId,
            category_id || null,
            tags || [],
            status || 'draft',
            publishedAt,
            meta_title || title,
            meta_description || excerpt || null,
            keywords || [],
            readTime,
        ];
        const result = await database_1.default.query(query, values);
        res.status(201).json({
            success: true,
            message: 'Blog post created successfully',
            blog: result.rows[0],
        });
    }
    catch (error) {
        console.error('Error creating blog:', error);
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});
router.put('/:id', auth_1.authenticateToken, auth_1.isAdmin, [
    (0, express_validator_1.param)('id').isUUID(),
    (0, express_validator_1.body)('title').optional().trim().notEmpty(),
    (0, express_validator_1.body)('content').optional().trim().notEmpty(),
    (0, express_validator_1.body)('excerpt').optional().trim(),
    (0, express_validator_1.body)('featured_image').optional(),
    (0, express_validator_1.body)('category_id').optional().isUUID(),
    (0, express_validator_1.body)('tags').optional().isArray(),
    (0, express_validator_1.body)('status').optional().isIn(['draft', 'published', 'archived']),
    (0, express_validator_1.body)('meta_title').optional().trim(),
    (0, express_validator_1.body)('meta_description').optional().trim(),
    (0, express_validator_1.body)('keywords').optional().isArray(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const updates = req.body;
        const existing = await database_1.default.query('SELECT * FROM blogs WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        const blog = existing.rows[0];
        if (updates.title && updates.title !== blog.title) {
            updates.slug = generateSlug(updates.title);
        }
        if (updates.content && updates.content !== blog.content) {
            updates.read_time_minutes = calculateReadTime(updates.content);
        }
        if (updates.status === 'published' && blog.status !== 'published') {
            updates.published_at = new Date().toISOString();
        }
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        Object.keys(updates).forEach((key) => {
            if (updates[key] !== undefined) {
                updateFields.push(`${key} = $${paramIndex}`);
                values.push(updates[key]);
                paramIndex++;
            }
        });
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const query = `
        UPDATE blogs
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
        const result = await database_1.default.query(query, values);
        res.json({
            success: true,
            message: 'Blog post updated successfully',
            blog: result.rows[0],
        });
    }
    catch (error) {
        console.error('Error updating blog:', error);
        res.status(500).json({ error: 'Failed to update blog post' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.isAdmin, (0, express_validator_1.param)('id').isUUID(), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM blogs WHERE id = $1 RETURNING id', [
            id,
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        res.json({
            success: true,
            message: 'Blog post deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});
router.get('/categories/all', async (req, res) => {
    try {
        const query = `
      SELECT 
        bc.*,
        COUNT(b.id) as post_count
      FROM blog_categories bc
      LEFT JOIN blogs b ON b.category_id = bc.id AND b.status = 'published'
      GROUP BY bc.id
      ORDER BY bc.name ASC
    `;
        const result = await database_1.default.query(query);
        res.json({
            success: true,
            categories: result.rows,
        });
    }
    catch (error) {
        console.error('Error fetching blog categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
router.post('/categories', auth_1.authenticateToken, auth_1.isAdmin, [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Category name is required'),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('color').optional().isHexColor(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { name, description, color } = req.body;
        const slug = generateSlug(name);
        const query = `
        INSERT INTO blog_categories (name, slug, description, color)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
        const result = await database_1.default.query(query, [
            name,
            slug,
            description || null,
            color || '#10B981',
        ]);
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            category: result.rows[0],
        });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Category already exists' });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
exports.default = router;
//# sourceMappingURL=blog.js.map