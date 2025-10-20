# 🔒 SECURITY DOCUMENTATION

## Tổng Quan Bảo Mật

Hệ thống AI Commerce được xây dựng với nhiều lớp bảo mật để chống lại các loại tấn công phổ biến:
- DDoS/DoS attacks
- SQL/NoSQL Injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- HTTP Parameter Pollution (HPP)
- Clickjacking
- Man-in-the-Middle attacks
- Brute Force attacks

---

## 🛡️ Các Lớp Bảo Mật

### 1. **Rate Limiting & DDoS Protection**

Sử dụng `express-rate-limit` và `express-slow-down` để bảo vệ khỏi DDoS attacks.

#### Rate Limiters:

**General API Limiter**
- 100 requests / 15 phút / IP
- Áp dụng cho tất cả `/api/*` endpoints

**Authentication Limiter** (Strict)
- 5 requests / 15 phút / IP
- Áp dụng cho `/api/auth/*`
- Chống brute force login attacks

**Payment Limiter** (Very Strict)
- 3 requests / 10 phút / IP
- Áp dụng cho `/api/payments/*`
- Bảo vệ các transaction nhạy cảm

**Order Limiter**
- 10 requests / 30 phút / IP
- Áp dụng cho `/api/orders/*`

**Password Reset Limiter**
- 3 requests / 1 giờ / IP
- Chống abuse password reset

**Speed Limiter**
- Làm chậm response sau 50 requests trong 15 phút
- Tăng delay 100ms mỗi request
- Max delay: 5 giây

#### Configuration:

```typescript
// Backend/src/middleware/security.ts
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Customize:

```env
# .env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
PAYMENT_RATE_LIMIT_MAX=3
```

---

### 2. **Input Validation & Sanitization**

#### NoSQL Injection Protection

Sử dụng `express-mongo-sanitize`:
- Loại bỏ các ký tự `$` và `.` trong user input
- Chống MongoDB operator injection
- Replace với `_` character

```typescript
app.use(sanitizeData);
```

#### XSS Protection

Custom XSS middleware (thay thế xss-clean deprecated):
- Sanitize tất cả request body, query params, URL params
- Loại bỏ `<script>` tags, `javascript:` protocols, event handlers
- Remove `<iframe>`, `eval()`, dangerous patterns

```typescript
app.use(xssProtection);
```

#### HTTP Parameter Pollution (HPP)

Sử dụng `hpp`:
- Chống duplicate parameters
- Whitelist cho arrays: `['price', 'rating', 'category', 'tags']`

```typescript
app.use(preventHpp);
```

#### Suspicious Activity Detection

Custom middleware phát hiện:
- SQL injection patterns
- XSS attempts
- Path traversal attacks
- Malicious user agents

```typescript
app.use(detectSuspiciousActivity);
```

---

### 3. **Security Headers (Helmet)**

Sử dụng `helmet` với cấu hình custom:

#### Content Security Policy (CSP)
- Chống XSS attacks
- Restrict script sources
- Allow Stripe, PayPal domains

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://js.stripe.com"],
    connectSrc: ["'self'", "https://api.stripe.com"],
    // ... more directives
  },
}
```

#### HTTP Strict Transport Security (HSTS)
- Force HTTPS connections
- 1 year duration
- Include subdomains
- Preload enabled

```typescript
hsts: {
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
}
```

#### X-Frame-Options
- Chống Clickjacking attacks
- Deny iframe embedding

```typescript
frameguard: { action: 'deny' }
```

#### Other Headers:
- `X-Content-Type-Options: nosniff` - Chống MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` - Disable unnecessary browser features
- `X-Download-Options: noopen` - IE download security

---

### 4. **CSRF Protection**

Sử dụng custom CSRF middleware với Double Submit Cookie pattern:

#### Cách hoạt động:
1. Server tạo CSRF token khi client request
2. Token được lưu trong cookie (`XSRF-TOKEN`)
3. Client gửi token trong header (`X-CSRF-Token`) hoặc body
4. Server verify token match và còn hiệu lực

#### Origin Check:
- Kiểm tra `Origin` header
- Chỉ cho phép trusted domains
- Block requests không có origin trong production

#### Usage:

**Get CSRF Token:**
```bash
GET /api/csrf-token
Response: { csrfToken: "...", expiresIn: 3600 }
```

**Send Request with CSRF Token:**
```javascript
fetch('/api/orders', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify(data)
})
```

---

### 5. **Logging & Monitoring**

Sử dụng `winston` với daily log rotation:

#### Log Levels:
- `error` - Application errors
- `warn` - Security warnings, suspicious activities
- `info` - Important events (payments, auth)
- `http` - HTTP requests
- `debug` - Detailed debugging info

#### Log Files:
- `logs/error-YYYY-MM-DD.log` - Error logs (kept 14 days)
- `logs/combined-YYYY-MM-DD.log` - All logs (kept 14 days)
- `logs/http-YYYY-MM-DD.log` - HTTP requests (kept 7 days)

#### Security Events Logged:
- Failed authentication attempts
- Rate limit violations
- Suspicious activity detection
- Payment transactions
- Database errors
- CSRF token failures

#### Custom Loggers:

```typescript
import { logSecurityEvent, logAuth, logPayment } from './utils/logger';

// Log security event
logSecurityEvent('suspicious_activity', { ip, userAgent }, 'warn');

// Log authentication
logAuth('login', userId, ip, success);

// Log payment
logPayment(userId, orderId, amount, status, provider);
```

---

### 6. **CORS Configuration**

Custom CORS với whitelist:

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://checkout.stripe.com',
      'https://js.stripe.com',
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
```

---

### 7. **Request Size Limiting**

- Max request body: 10MB
- Áp dụng cho tất cả endpoints
- Return 413 Payload Too Large nếu vượt quá

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(requestSizeLimiter);
```

---

### 8. **Compression**

Sử dụng `compression` middleware:
- Giảm bandwidth
- Improve performance
- Chỉ nén responses > 1KB
- Compression level: 6

```typescript
app.use(compressionMiddleware);
```

---

### 9. **Secure Cookies**

Cookie configuration:

```typescript
const secureCookieOptions = {
  httpOnly: true,        // Không cho JS access
  secure: true,          // HTTPS only (production)
  sameSite: 'strict',    // CSRF protection
  maxAge: 86400000,      // 24 hours
  domain: process.env.COOKIE_DOMAIN,
};
```

---

## 🔐 Environment Variables Security

### Required Environment Variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRE=7d

# Session
SESSION_SECRET=your-session-secret-min-32-chars

# Frontend
FRONTEND_URL=https://yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Security (Optional)
BLACKLISTED_IPS=192.168.1.100,10.0.0.5
WHITELISTED_IPS=
COOKIE_DOMAIN=.yourdomain.com
```

### Best Practices:

1. **Never commit `.env` file to Git**
   ```gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use strong secrets** (min 32 characters):
   ```bash
   # Generate secure secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Rotate secrets regularly**
   - JWT_SECRET: Every 90 days
   - API keys: Every 6 months

4. **Use environment-specific configs**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

---

## 🚨 Security Checklist

### Pre-Deployment:

- [ ] Change all default secrets in `.env`
- [ ] Enable HTTPS/TLS
- [ ] Configure CSP headers properly
- [ ] Setup rate limiting
- [ ] Enable HSTS
- [ ] Configure CORS whitelist
- [ ] Setup logging and monitoring
- [ ] Enable database backups
- [ ] Configure firewall rules
- [ ] Setup SSL certificates
- [ ] Test security headers (securityheaders.com)
- [ ] Run security audit: `npm audit`
- [ ] Update all dependencies
- [ ] Configure Stripe webhooks with HTTPS
- [ ] Setup PayPal webhooks
- [ ] Enable 2FA for admin accounts

### Post-Deployment Monitoring:

- [ ] Monitor error logs daily
- [ ] Check rate limit violations
- [ ] Review suspicious activities
- [ ] Monitor payment transactions
- [ ] Check SSL certificate expiry
- [ ] Review access logs
- [ ] Update dependencies monthly
- [ ] Perform security audits quarterly

---

## 🔍 Security Testing

### 1. Test Rate Limiting:

```bash
# Test auth rate limit (should block after 5 requests)
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### 2. Test XSS Protection:

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert('XSS')</script>"}'
# Should sanitize the script tag
```

### 3. Test NoSQL Injection:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":{"$ne":null},"password":{"$ne":null}}'
# Should be sanitized and fail
```

### 4. Test CSRF Protection:

```bash
# Without CSRF token (should fail)
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":1}'
```

### 5. Test Security Headers:

```bash
curl -I http://localhost:5000/
# Check for security headers in response
```

---

## 📚 Security Resources

### Tools:
- [OWASP ZAP](https://www.zaproxy.org/) - Security testing
- [Security Headers](https://securityheaders.com/) - Header checker
- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL/TLS checker
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Dependency vulnerabilities

### Documentation:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

## 🐛 Reporting Security Issues

If you discover a security vulnerability, please email: **security@yourdomain.com**

**Please DO NOT create a public GitHub issue.**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and provide a fix within 7 days for critical issues.

---

## 📝 Security Updates Log

### v1.0.0 (Current)
- ✅ Rate limiting implemented
- ✅ XSS protection
- ✅ CSRF protection
- ✅ SQL/NoSQL injection protection
- ✅ Security headers (Helmet)
- ✅ Request logging (Winston)
- ✅ Input validation
- ✅ Compression
- ✅ Secure cookies

---

## ⚖️ License & Compliance

- GDPR compliant (data encryption, user consent, right to deletion)
- PCI DSS compliant (Stripe handles card data)
- SOC 2 Type II (logging and monitoring)

---

**Last Updated:** October 2025  
**Maintained by:** Security Team
