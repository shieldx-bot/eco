# AI Commerce Backend

Backend API cho hệ thống thương mại điện tử bán tài khoản AI.

## 🚀 Cài đặt

```bash
# Cài đặt dependencies
npm install

# Copy file .env.example thành .env và cập nhật thông tin
cp .env.example .env

# Chạy development server
npm run dev

# Build production
npm run build

# Chạy production
npm start
```

## 📁 Cấu trúc thư mục

```
Backend/
├── src/
│   ├── config/          # Database và các config
│   ├── controllers/     # Business logic
│   ├── routes/          # API routes
│   ├── middleware/      # Auth, error handling
│   ├── models/          # Database models
│   ├── services/        # External services (Stripe, PayPal, Email)
│   ├── types/           # TypeScript types
│   ├── utils/           # Helper functions
│   └── server.ts        # Entry point
├── dist/                # Compiled JavaScript
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Products
- `GET /api/products` - Lấy danh sách sản phẩm
- `GET /api/products/:slug` - Chi tiết sản phẩm
- `POST /api/products` (Admin) - Tạo sản phẩm mới
- `PUT /api/products/:id` (Admin) - Cập nhật sản phẩm
- `DELETE /api/products/:id` (Admin) - Xóa sản phẩm

### Cart & Orders
- `GET /api/cart` - Lấy giỏ hàng
- `POST /api/cart/add` - Thêm vào giỏ
- `DELETE /api/cart/item/:id` - Xóa khỏi giỏ
- `POST /api/orders` - Tạo đơn hàng
- `GET /api/orders` - Lịch sử đơn hàng

### Payments
- `POST /api/payments/stripe/create-intent` - Tạo Stripe payment
- `POST /api/payments/stripe/webhook` - Stripe webhook
- `POST /api/payments/paypal/create-order` - Tạo PayPal order
- `POST /api/payments/paypal/capture` - Xác nhận PayPal payment

## 🔒 Environment Variables

Xem file `.env.example` để biết các biến môi trường cần thiết.

## 📝 License

MIT
