# AI Commerce Deployment Script for Windows
# Run with: .\deploy.ps1

Write-Host "🚀 AI Commerce Deployment Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure it." -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first." -ForegroundColor Yellow
    exit 1
}

# Menu
Write-Host "Select deployment option:" -ForegroundColor Yellow
Write-Host "1) Full Stack (Backend + Frontend + PostgreSQL)"
Write-Host "2) Backend Only"
Write-Host "3) Frontend Only"  
Write-Host "4) Stop All Services"
Write-Host "5) View Logs"
Write-Host "6) Rebuild All"
Write-Host "7) Clean Everything (including volumes)"
Write-Host ""

$choice = Read-Host "Enter your choice [1-7]"

switch ($choice) {
    "1" {
        Write-Host "🚀 Deploying Full Stack..." -ForegroundColor Green
        docker-compose up -d --build
        Write-Host ""
        Write-Host "✅ Full stack deployed!" -ForegroundColor Green
        Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
        Write-Host "Database: localhost:5432" -ForegroundColor Cyan
    }
    "2" {
        Write-Host "🚀 Deploying Backend Only..." -ForegroundColor Green
        Set-Location Backend
        docker-compose -f docker-compose.prod.yml up -d --build
        Set-Location ..
        Write-Host ""
        Write-Host "✅ Backend deployed!" -ForegroundColor Green
        Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
    }
    "3" {
        Write-Host "🚀 Deploying Frontend Only..." -ForegroundColor Green
        Set-Location frontend
        docker-compose -f docker-compose.prod.yml up -d --build
        Set-Location ..
        Write-Host ""
        Write-Host "✅ Frontend deployed!" -ForegroundColor Green
        Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
    }
    "4" {
        Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
        docker-compose down
        Set-Location Backend
        docker-compose -f docker-compose.prod.yml down 2>$null
        Set-Location ../frontend
        docker-compose -f docker-compose.prod.yml down 2>$null
        Set-Location ..
        Write-Host "✅ All services stopped!" -ForegroundColor Green
    }
    "5" {
        Write-Host "📋 Showing logs (Ctrl+C to exit)..." -ForegroundColor Green
        docker-compose logs -f
    }
    "6" {
        Write-Host "🔄 Rebuilding all services..." -ForegroundColor Yellow
        docker-compose down
        docker-compose up -d --build --force-recreate
        Write-Host "✅ All services rebuilt!" -ForegroundColor Green
    }
    "7" {
        Write-Host "⚠️  WARNING: This will delete all data including database!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? (yes/no)"
        if ($confirm -eq "yes") {
            Write-Host "🗑️  Cleaning everything..." -ForegroundColor Yellow
            docker-compose down -v
            docker system prune -f
            Write-Host "✅ Everything cleaned!" -ForegroundColor Green
        } else {
            Write-Host "Cancelled." -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "❌ Invalid choice!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green
