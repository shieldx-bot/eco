-- Sample Products
-- Run this after schema.sql to populate with sample data

-- Get category IDs
DO $$
DECLARE
  cat_ai_plus UUID;
  cat_api UUID;
  product1_id UUID;
  product2_id UUID;
  product3_id UUID;
BEGIN
  -- Get category IDs
  SELECT id INTO cat_ai_plus FROM categories WHERE slug = 'ai-plus-accounts';
  SELECT id INTO cat_api FROM categories WHERE slug = 'api-packages';

  -- Insert sample products
  INSERT INTO products (
    slug, 
    title, 
    short_description, 
    content, 
    price_cents, 
    type, 
    seo_title, 
    seo_description,
    published
  ) VALUES
  (
    'chatgpt-plus-1-month',
    'ChatGPT Plus - 1 Month',
    'Premium ChatGPT Plus account with GPT-4 access for 1 month',
    '<h2>About ChatGPT Plus</h2><p>Get full access to ChatGPT Plus with GPT-4, faster response times, and priority access during peak hours.</p><h3>Features:</h3><ul><li>GPT-4 access</li><li>Faster response times</li><li>Priority access</li><li>Access during peak times</li></ul>',
    2000,
    'account',
    'ChatGPT Plus 1 Month - Premium AI Access',
    'Get ChatGPT Plus account with full GPT-4 access. Fast delivery, premium support, best price guaranteed.',
    true
  ),
  (
    'openai-api-starter',
    'OpenAI API Starter Package',
    'OpenAI API credits package - Perfect for developers getting started',
    '<h2>OpenAI API Starter Package</h2><p>Perfect for developers who want to integrate OpenAI into their applications.</p><h3>What you get:</h3><ul><li>$50 API credits</li><li>Access to GPT-4 and GPT-3.5</li><li>DALL-E image generation</li><li>Whisper speech-to-text</li></ul>',
    5000,
    'api_package',
    'OpenAI API Credits - Starter Package for Developers',
    'OpenAI API credits package with access to GPT-4, DALL-E, and Whisper. Instant delivery.',
    true
  ),
  (
    'claude-api-pro',
    'Claude API Pro Package',
    'Claude API credits - Advanced AI by Anthropic',
    '<h2>Claude API Pro Package</h2><p>Claude by Anthropic offers advanced reasoning capabilities and large context windows.</p><h3>Includes:</h3><ul><li>$100 API credits</li><li>Claude 3 Opus access</li><li>100K token context</li><li>Priority support</li></ul>',
    10000,
    'api_package',
    'Claude API Pro - Advanced AI by Anthropic',
    'Get Claude API credits with access to Claude 3 Opus. Large context window, advanced reasoning.',
    true
  )
  RETURNING id INTO product1_id;

  -- Link products to categories
  INSERT INTO product_categories (product_id, category_id)
  SELECT p.id, cat_ai_plus FROM products p WHERE p.slug = 'chatgpt-plus-1-month'
  ON CONFLICT DO NOTHING;

  INSERT INTO product_categories (product_id, category_id)
  SELECT p.id, cat_api FROM products p WHERE p.slug IN ('openai-api-starter', 'claude-api-pro')
  ON CONFLICT DO NOTHING;

  -- Insert sample images
  INSERT INTO product_images (product_id, url, alt, sort_order)
  SELECT p.id, 'https://via.placeholder.com/800x600/4F46E5/ffffff?text=ChatGPT+Plus', 'ChatGPT Plus', 0
  FROM products p WHERE p.slug = 'chatgpt-plus-1-month';

  INSERT INTO product_images (product_id, url, alt, sort_order)
  SELECT p.id, 'https://via.placeholder.com/800x600/10B981/ffffff?text=OpenAI+API', 'OpenAI API', 0
  FROM products p WHERE p.slug = 'openai-api-starter';

  INSERT INTO product_images (product_id, url, alt, sort_order)
  SELECT p.id, 'https://via.placeholder.com/800x600/F59E0B/ffffff?text=Claude+API', 'Claude API', 0
  FROM products p WHERE p.slug = 'claude-api-pro';

END $$;
