# 🚀 Docker Deployment Guide

Hướng dẫn deploy hệ thống AI Commerce E-commerce với Docker.

## 📋 Yêu Cầu

- Docker Engine 20.10+
- Docker Compose 2.0+
- PostgreSQL Database (nếu deploy riêng backend)
- Stripe Account & API Keys
- Domain và SSL certificates (cho production)

## 🏗️ Cấu Trúc Project

```
eco/
├── Backend/                 # Backend API (Node.js + Express)
│   ├── Dockerfile
│   ├── docker-compose.prod.yml
│   └── ...
├── frontend/               # Frontend (Next.js)
│   ├── Dockerfile
│   ├── docker-compose.prod.yml
│   └── ...
├── docker-compose.yml      # Full stack (dev/testing)
└── .env.example           # Environment variables template
```

## 🔧 Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd eco
```

### 2. Tạo Environment Variables

```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin thực của bạn
```

**Quan trọng**: Thay đổi các giá trị sau trong `.env`:
- `POSTGRES_PASSWORD` - Mật khẩu database mạnh
- `JWT_SECRET` - Secret key ít nhất 32 ký tự
- `STRIPE_SECRET_KEY` - Stripe secret key từ dashboard
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

## 🚀 Deployment Options

### Option 1: Deploy Toàn Bộ Hệ Thống (Development/Testing)

Chạy cả Backend + Frontend + PostgreSQL trong một docker-compose:

```bash
# Build và start tất cả services
docker-compose up -d --build

# Xem logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop và xóa volumes
docker-compose down -v
```

Services sẽ chạy tại:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432

### Option 2: Deploy Backend Riêng (Production)

Deploy chỉ Backend API (sử dụng external PostgreSQL):

```bash
cd Backend

# Tạo .env cho backend
cat > .env << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@your-db-host:5432/dbname
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
PAYPAL_CLIENT_ID=your_paypal_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
FRONTEND_URL=https://your-frontend-domain.com
EOF

# Build và run
docker-compose -f docker-compose.prod.yml up -d --build

# Logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

Backend sẽ chạy tại: http://localhost:5000

### Option 3: Deploy Frontend Riêng (Production)

Deploy chỉ Frontend (kết nối với external Backend API):

```bash
cd frontend

# Tạo .env cho frontend
cat > .env << EOF
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
EOF

# Build và run
docker-compose -f docker-compose.prod.yml up -d --build

# Logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

Frontend sẽ chạy tại: http://localhost:3000

## 🐳 Build Docker Images Riêng

### Build Backend Image

```bash
cd Backend
docker build -t eco-backend:latest .

# Run với custom port
docker run -d \
  -p 5000:5000 \
  --env-file .env \
  --name eco-backend \
  eco-backend:latest
```

### Build Frontend Image

```bash
cd frontend
docker build -t eco-frontend:latest .

# Run với custom port
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name eco-frontend \
  eco-frontend:latest
```

## 🗄️ Database Setup

### Chạy PostgreSQL Schema

```bash
# Copy schema vào container
docker cp Backend/src/database/schema.sql eco-postgres:/tmp/

# Execute schema
docker exec -i eco-postgres psql -U postgres -d ai_commerce < Backend/src/database/schema.sql

# Hoặc seed data
docker cp Backend/src/database/seed.sql eco-postgres:/tmp/
docker exec -i eco-postgres psql -U postgres -d ai_commerce < Backend/src/database/seed.sql
```

### Connect vào Database

```bash
docker exec -it eco-postgres psql -U postgres -d ai_commerce
```

## 🔍 Health Checks

### Backend Health Check
```bash
curl http://localhost:5000/health
```

### Frontend Health Check
```bash
curl http://localhost:3000
```

## 📊 Monitoring

### Xem logs của tất cả services
```bash
docker-compose logs -f
```

### Xem logs của service cụ thể
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Xem resource usage
```bash
docker stats
```

## 🔐 Security Best Practices

1. **Environment Variables**: Không commit `.env` files
2. **JWT Secret**: Dùng strong random string (min 32 chars)
3. **Database Password**: Dùng mật khẩu mạnh
4. **HTTPS**: Luôn dùng SSL/TLS cho production
5. **CORS**: Configure CORS properly trong backend
6. **Rate Limiting**: Enable rate limiting cho API endpoints

## 🌐 Deploy to Cloud Platforms

### Deploy to Railway

**Backend:**
```bash
cd Backend
railway up
railway add postgresql
railway variables set DATABASE_URL=...
```

**Frontend:**
```bash
cd frontend
railway up
railway variables set NEXT_PUBLIC_API_URL=...
```

### Deploy to Render

1. Create new Web Service
2. Connect GitHub repository
3. Set Docker as environment
4. Add environment variables
5. Deploy

### Deploy to DigitalOcean

```bash
# Install doctl
# Create droplet
doctl compute droplet create \
  --image docker-20-04 \
  --size s-2vcpu-4gb \
  --region sgp1 \
  eco-server

# SSH and deploy
ssh root@your-droplet-ip
git clone <repo>
cd eco
docker-compose up -d
```

## 🔄 Update & Maintenance

### Update Backend
```bash
cd Backend
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

### Update Frontend
```bash
cd frontend
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

### Backup Database
```bash
docker exec eco-postgres pg_dump -U postgres ai_commerce > backup.sql
```

### Restore Database
```bash
docker exec -i eco-postgres psql -U postgres ai_commerce < backup.sql
```

## ❗ Troubleshooting

### Port đã được sử dụng
```bash
# Xem port đang dùng
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill process
taskkill /PID <pid> /F
```

### Container không start
```bash
# Xem logs
docker logs eco-backend
docker logs eco-frontend

# Restart container
docker restart eco-backend
```

### Database connection failed
```bash
# Check postgres is running
docker ps | grep postgres

# Check connection
docker exec eco-postgres pg_isready -U postgres
```

## 📞 Support

Nếu gặp vấn đề, check logs và documentation hoặc create issue trên GitHub.

## 📝 License

MIT License - xem file LICENSE để biết thêm chi tiết.
