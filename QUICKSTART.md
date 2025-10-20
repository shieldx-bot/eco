# 🚀 Quick Deploy Guide

## Prerequisites
- Docker Desktop installed and running
- Git installed
- Text editor

## 1️⃣ Setup (5 phút)

```powershell
# Clone project
git clone <your-repo-url>
cd eco

# Copy và config environment
copy .env.example .env
notepad .env
```

**⚠️ Phải sửa trong .env:**
- `POSTGRES_PASSWORD` → mật khẩu mạnh
- `JWT_SECRET` → chuỗi random 32+ ký tự
- `STRIPE_SECRET_KEY` → từ Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` → từ Stripe Webhook
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → từ Stripe Dashboard

## 2️⃣ Deploy

### Option A: Toàn bộ hệ thống (Recommended cho testing)

```powershell
# Windows
.\deploy.ps1
# Chọn option 1

# Hoặc trực tiếp
docker-compose up -d --build
```

**Kết quả:**
- ✅ Frontend: http://localhost:3000
- ✅ Backend: http://localhost:5000
- ✅ PostgreSQL: localhost:5432

### Option B: Deploy riêng Backend

```powershell
cd Backend

# Tạo .env cho backend
# Phải có DATABASE_URL từ PostgreSQL external
copy .env.example .env
notepad .env

# Deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

**Backend chạy tại:** http://localhost:5000

### Option C: Deploy riêng Frontend

```powershell
cd frontend

# Tạo .env cho frontend
copy .env.local.example .env.local
notepad .env.local

# Phải set NEXT_PUBLIC_API_URL đến backend API
# Ví dụ: NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# Deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

**Frontend chạy tại:** http://localhost:3000

## 3️⃣ Verify Deployment

```powershell
# Check services
docker ps

# View logs
docker-compose logs -f

# Test backend
curl http://localhost:5000/health

# Test frontend
start http://localhost:3000
```

## 4️⃣ Setup Database

```powershell
# Copy schema file
docker cp Backend/src/database/schema.sql eco-postgres:/tmp/

# Run schema
docker exec -i eco-postgres psql -U postgres -d ai_commerce -f /tmp/schema.sql

# Seed data (optional)
docker cp Backend/src/database/seed.sql eco-postgres:/tmp/
docker exec -i eco-postgres psql -U postgres -d ai_commerce -f /tmp/seed.sql
```

## 5️⃣ Create Admin User

```powershell
# Connect to database
docker exec -it eco-postgres psql -U postgres -d ai_commerce

# Create admin (trong psql)
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@example.com',
  '$2b$10$abcdefghijk...',  -- hash của "admin123"
  'Admin User',
  'admin'
);
```

**Hoặc dùng API:**
```powershell
curl -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\",\"full_name\":\"Admin\"}'

# Sau đó update role trong database
```

## 6️⃣ Test Stripe

1. Đăng nhập Stripe Dashboard
2. Vào Developers → Webhooks
3. Add endpoint: `http://localhost:5000/api/payments/stripe/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy Webhook Secret → `.env` → `STRIPE_WEBHOOK_SECRET`
6. Restart backend: `docker-compose restart backend`

## 🔧 Common Commands

```powershell
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart service
docker-compose restart backend
docker-compose restart frontend

# Stop everything
docker-compose down

# Stop và xóa data
docker-compose down -v

# Rebuild
docker-compose up -d --build --force-recreate

# Check health
docker ps
docker stats
```

## 🐛 Troubleshooting

### Port 3000 đã được dùng
```powershell
# Tìm process
netstat -ano | findstr :3000

# Kill process
taskkill /PID <pid> /F
```

### Port 5000 đã được dùng
```powershell
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```

### Backend không kết nối database
```powershell
# Check postgres
docker ps | findstr postgres

# Check logs
docker logs eco-postgres

# Restart
docker-compose restart postgres
docker-compose restart backend
```

### Frontend không kết nối backend
```powershell
# Check backend health
curl http://localhost:5000/health

# Check frontend env
docker exec eco-frontend printenv | findstr API_URL

# Restart frontend
docker-compose restart frontend
```

## 🌐 Deploy to Production

### Deploy Backend to Railway/Render

1. Create new service
2. Connect GitHub repo
3. Set root directory: `Backend`
4. Set Dockerfile path: `Backend/Dockerfile`
5. Add environment variables from `.env`
6. Deploy

### Deploy Frontend to Vercel

```powershell
cd frontend
npm install -g vercel
vercel login
vercel --prod
```

### Deploy to VPS (DigitalOcean, AWS, etc.)

```bash
# SSH to server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone project
git clone <repo>
cd eco

# Configure .env
nano .env

# Deploy
docker-compose up -d --build
```

## 📊 Monitor

```powershell
# Resource usage
docker stats

# Logs
docker-compose logs -f

# Check containers
docker ps -a

# Inspect container
docker inspect eco-backend
```

## 🔄 Update Code

```powershell
# Pull latest code
git pull

# Rebuild và restart
docker-compose up -d --build

# Hoặc dùng script
.\deploy.ps1
# Chọn option 6
```

## 📞 Need Help?

- Check logs: `docker-compose logs -f`
- Read full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Check Docker: `docker ps`, `docker stats`
- Database: `docker exec -it eco-postgres psql -U postgres`

## ✅ Checklist

- [ ] Docker Desktop running
- [ ] `.env` file configured
- [ ] Stripe keys added
- [ ] Database initialized
- [ ] Services running (`docker ps`)
- [ ] Frontend accessible (http://localhost:3000)
- [ ] Backend accessible (http://localhost:5000)
- [ ] Can login/register
- [ ] Can add products (admin)
- [ ] Can checkout with test card

---

🎉 **Chúc mừng! Hệ thống đã ready to use!**
