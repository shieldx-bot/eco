# Database Setup

## Setup Instructions

### 1. Cài đặt PostgreSQL

**Windows:**
```bash
# Download từ https://www.postgresql.org/download/windows/
# Hoặc dùng Docker:
docker run --name postgres-ai-commerce -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres:14
```

**Mac:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux:**
```bash
sudo apt-get install postgresql-14
sudo systemctl start postgresql
```

### 2. Tạo Database

```bash
# Truy cập PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE ai_commerce;

# Tạo user (optional)
CREATE USER ai_commerce_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE ai_commerce TO ai_commerce_user;

# Thoát
\q
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục `Backend/`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_commerce
DB_USER=postgres
DB_PASSWORD=yourpassword
```

### 4. Chạy schema

```bash
# Từ thư mục Backend/
npm run db:setup

# Reset và seed data
npm run db:setup -- --reset --seed
```

## Scripts

Thêm vào `package.json`:
```json
{
  "scripts": {
    "db:setup": "ts-node src/database/setup.ts",
    "db:reset": "ts-node src/database/setup.ts --reset",
    "db:seed": "ts-node src/database/setup.ts --reset --seed"
  }
}
```

## Schema Overview

### Tables

1. **users** - User accounts (customers & admins)
2. **products** - AI products (accounts & API packages)
3. **product_images** - Product images
4. **categories** - Product categories
5. **product_categories** - Many-to-many relationship
6. **carts** - Shopping carts
7. **orders** - Customer orders
8. **payments** - Payment records
9. **coupons** - Discount coupons
10. **account_credentials** - AI account credentials
11. **reviews** - Product reviews

### Default Admin Account

- Email: `admin@aicommerce.com`
- Password: `Admin@123`
- Role: `admin`

**⚠️ IMPORTANT:** Change this password in production!

## Migrations (Future)

For production, consider using a migration tool:
- Prisma Migrate
- Knex.js
- node-pg-migrate
