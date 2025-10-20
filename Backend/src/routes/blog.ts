import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, isAdmin } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Helper function to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Helper function to calculate read time
const calculateReadTime = (content: string): number => {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};

// ==========================================
// PUBLIC ROUTES
// ==========================================

/**
 * GET /api/blogs
 * Get all published blog posts with pagination and filters
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('category').optional().isString(),
    query('tag').optional().isString(),
    query('search').optional().isString(),
    query('sort').optional().isIn(['created_at', 'published_at', 'views', 'title']),
    query('order').optional().isIn(['ASC', 'DESC']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      const category = req.query.category as string;
      const tag = req.query.tag as string;
      const search = req.query.search as string;
      const sort = (req.query.sort as string) || 'published_at';
      const order = (req.query.order as string) || 'DESC';

      let whereConditions = ['blogs.status = $1'];
      let queryParams: any[] = ['published'];
      let paramIndex = 2;

      // Filter by category
      if (category) {
        whereConditions.push(`bc.slug = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }

      // Filter by tag
      if (tag) {
        whereConditions.push(`$${paramIndex} = ANY(blogs.tags)`);
        queryParams.push(tag);
        paramIndex++;
      }

      // Search in title, excerpt, content
      if (search) {
        whereConditions.push(
          `(blogs.title ILIKE $${paramIndex} OR blogs.excerpt ILIKE $${paramIndex} OR blogs.content ILIKE $${paramIndex})`
        );
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT blogs.id) as total
        FROM blogs
        LEFT JOIN blog_categories bc ON blogs.category_id = bc.id
        WHERE ${whereClause}
      `;
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get blogs
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
      const result = await pool.query(blogsQuery, queryParams);

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
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  }
);

/**
 * GET /api/blogs/:slug
 * Get single blog post by slug
 */
router.get(
  '/:slug',
  param('slug').isString(),
  async (req: Request, res: Response) => {
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

      const result = await pool.query(query, [slug]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      // Increment views
      await pool.query('UPDATE blogs SET views = views + 1 WHERE id = $1', [
        result.rows[0].id,
      ]);

      res.json({
        success: true,
        blog: result.rows[0],
      });
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  }
);

/**
 * GET /api/blogs/related/:slug
 * Get related blog posts (same category, exclude current)
 */
router.get('/related/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = parseInt(req.query.limit as string) || 3;

    // Get current blog's category
    const currentBlog = await pool.query(
      'SELECT category_id FROM blogs WHERE slug = $1',
      [slug]
    );

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

    const result = await pool.query(query, [slug, categoryId, limit]);

    res.json({
      success: true,
      blogs: result.rows,
    });
  } catch (error) {
    console.error('Error fetching related blogs:', error);
    res.status(500).json({ error: 'Failed to fetch related blogs' });
  }
});

// ==========================================
// ADMIN ROUTES (Protected)
// ==========================================

/**
 * GET /api/blogs/admin/all
 * Get all blog posts (including drafts) - Admin only
 */
router.get(
  '/admin/all',
  authenticateToken,
  isAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['draft', 'published', 'archived']),
    query('search').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const status = req.query.status as string;
      const search = req.query.search as string;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (status) {
        whereConditions.push(`blogs.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(
          `(blogs.title ILIKE $${paramIndex} OR blogs.excerpt ILIKE $${paramIndex})`
        );
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM blogs ${whereClause}`;
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get blogs
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
      const result = await pool.query(blogsQuery, queryParams);

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
    } catch (error) {
      console.error('Error fetching all blogs:', error);
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  }
);

/**
 * POST /api/blogs
 * Create new blog post - Admin only
 */
router.post(
  '/',
  authenticateToken,
  isAdmin,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('excerpt').optional().trim(),
    body('featured_image').optional().isURL(),
    body('category_id').optional().isUUID(),
    body('tags').optional().isArray(),
    body('status').optional().isIn(['draft', 'published']),
    body('meta_title').optional().trim(),
    body('meta_description').optional().trim(),
    body('keywords').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        content,
        excerpt,
        featured_image,
        category_id,
        tags,
        status,
        meta_title,
        meta_description,
        keywords,
      } = req.body;

      // Generate slug from title
      let slug = generateSlug(title);
      
      // Check if slug exists and make it unique
      const existingSlug = await pool.query(
        'SELECT id FROM blogs WHERE slug = $1',
        [slug]
      );
      
      if (existingSlug.rows.length > 0) {
        slug = `${slug}-${Date.now()}`;
      }

      // Calculate read time
      const readTime = calculateReadTime(content);

      // Get author ID from authenticated user
      const authorId = (req as any).user.userId;

      const publishedAt =
        status === 'published' ? new Date().toISOString() : null;

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

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Blog post created successfully',
        blog: result.rows[0],
      });
    } catch (error) {
      console.error('Error creating blog:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  }
);

/**
 * PUT /api/blogs/:id
 * Update blog post - Admin only
 */
router.put(
  '/:id',
  authenticateToken,
  isAdmin,
  [
    param('id').isUUID(),
    body('title').optional().trim().notEmpty(),
    body('content').optional().trim().notEmpty(),
    body('excerpt').optional().trim(),
    body('featured_image').optional(),
    body('category_id').optional().isUUID(),
    body('tags').optional().isArray(),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    body('meta_title').optional().trim(),
    body('meta_description').optional().trim(),
    body('keywords').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = req.body;

      // Check if blog exists
      const existing = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      const blog = existing.rows[0];

      // Generate new slug if title changed
      if (updates.title && updates.title !== blog.title) {
        updates.slug = generateSlug(updates.title);
      }

      // Recalculate read time if content changed
      if (updates.content && updates.content !== blog.content) {
        updates.read_time_minutes = calculateReadTime(updates.content);
      }

      // Set published_at if status changed to published
      if (updates.status === 'published' && blog.status !== 'published') {
        updates.published_at = new Date().toISOString();
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
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

      const result = await pool.query(query, values);

      res.json({
        success: true,
        message: 'Blog post updated successfully',
        blog: result.rows[0],
      });
    } catch (error) {
      console.error('Error updating blog:', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  }
);

/**
 * DELETE /api/blogs/:id
 * Delete blog post - Admin only
 */
router.delete(
  '/:id',
  authenticateToken,
  isAdmin,
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query('DELETE FROM blogs WHERE id = $1 RETURNING id', [
        id,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      res.json({
        success: true,
        message: 'Blog post deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  }
);

// ==========================================
// BLOG CATEGORIES ROUTES
// ==========================================

/**
 * GET /api/blogs/categories
 * Get all blog categories
 */
router.get('/categories/all', async (req: Request, res: Response) => {
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

    const result = await pool.query(query);

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/blogs/categories
 * Create new blog category - Admin only
 */
router.post(
  '/categories',
  authenticateToken,
  isAdmin,
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim(),
    body('color').optional().isHexColor(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
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

      const result = await pool.query(query, [
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
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique violation
        return res.status(400).json({ error: 'Category already exists' });
      }
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

export default router;
