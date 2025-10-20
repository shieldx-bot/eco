# 🔒 Security Setup Script for AI Commerce Platform
# PowerShell version

Write-Host "🔒 AI Commerce - Security Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to generate secure random string
function Generate-Secret {
    $bytes = New-Object Byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace("=", "").Replace("+", "").Replace("/", "").Substring(0, 32)
}

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# Copy .env.example
Write-Host "📝 Copying .env.example to .env..." -ForegroundColor Blue
Copy-Item ".env.example" ".env" -Force

# Generate secrets
Write-Host "🔑 Generating secure secrets..." -ForegroundColor Blue
$JWT_SECRET = Generate-Secret
$SESSION_SECRET = Generate-Secret

# Update .env file
Write-Host "✏️  Updating .env with generated secrets..." -ForegroundColor Blue

(Get-Content ".env") -replace "JWT_SECRET=.*", "JWT_SECRET=$JWT_SECRET" | Set-Content ".env"
(Get-Content ".env") -replace "SESSION_SECRET=.*", "SESSION_SECRET=$SESSION_SECRET" | Set-Content ".env"

Write-Host ""
Write-Host "✅ Generated Secrets:" -ForegroundColor Green
Write-Host "JWT_SECRET: " -NoNewline; Write-Host $JWT_SECRET -ForegroundColor Yellow
Write-Host "SESSION_SECRET: " -NoNewline; Write-Host $SESSION_SECRET -ForegroundColor Yellow
Write-Host ""

# Prompt for database password
$DB_PASSWORD = Read-Host "Enter PostgreSQL password (or press Enter to generate)"
if ([string]::IsNullOrWhiteSpace($DB_PASSWORD)) {
    $DB_PASSWORD = Generate-Secret
    Write-Host "Generated database password: " -NoNewline -ForegroundColor Green
    Write-Host $DB_PASSWORD -ForegroundColor Yellow
}

(Get-Content ".env") -replace "POSTGRES_PASSWORD=.*", "POSTGRES_PASSWORD=$DB_PASSWORD" | Set-Content ".env"
(Get-Content ".env") -replace "your_secure_password_here", "$DB_PASSWORD" | Set-Content ".env"

Write-Host ""
Write-Host "🔗 Configure URLs:" -ForegroundColor Blue

# Frontend URL
$FRONTEND_URL = Read-Host "Enter Frontend URL (default: http://localhost:3000)"
if ([string]::IsNullOrWhiteSpace($FRONTEND_URL)) {
    $FRONTEND_URL = "http://localhost:3000"
}

(Get-Content ".env") -replace "FRONTEND_URL=.*", "FRONTEND_URL=$FRONTEND_URL" | Set-Content ".env"
(Get-Content ".env") -replace "NEXT_PUBLIC_SITE_URL=.*", "NEXT_PUBLIC_SITE_URL=$FRONTEND_URL" | Set-Content ".env"

# Backend API URL
$API_URL = Read-Host "Enter Backend API URL (default: http://localhost:5000/api)"
if ([string]::IsNullOrWhiteSpace($API_URL)) {
    $API_URL = "http://localhost:5000/api"
}

(Get-Content ".env") -replace "NEXT_PUBLIC_API_URL=.*", "NEXT_PUBLIC_API_URL=$API_URL" | Set-Content ".env"

Write-Host ""
Write-Host "💳 Payment Configuration:" -ForegroundColor Blue
Write-Host "Note: You'll need to add these manually" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Stripe Keys (get from: https://dashboard.stripe.com/apikeys)"
Write-Host "   - STRIPE_SECRET_KEY=sk_test_..."
Write-Host "   - STRIPE_WEBHOOK_SECRET=whsec_..."
Write-Host "   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..."
Write-Host ""
Write-Host "2. PayPal Credentials (get from: https://developer.paypal.com/)"
Write-Host "   - PAYPAL_CLIENT_ID=..."
Write-Host "   - PAYPAL_CLIENT_SECRET=..."
Write-Host ""

# Security recommendations
Write-Host ""
Write-Host "✅ Security Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Blue
Write-Host ""
Write-Host "1. Add your Stripe & PayPal credentials to .env"
Write-Host "2. Review and update BLACKLISTED_IPS/WHITELISTED_IPS if needed"
Write-Host "3. Configure email settings (SMTP_*) for notifications"
Write-Host "4. Change NODE_ENV to 'production' for production deployment"
Write-Host ""
Write-Host "🔒 Security Checklist:" -ForegroundColor Blue
Write-Host ""
Write-Host "✓ Secrets generated and configured"
Write-Host "✓ Database password set"
Write-Host "✓ URLs configured"
Write-Host "⚠ Add payment provider credentials"
Write-Host "⚠ Configure email settings"
Write-Host "⚠ Review SECURITY.md for best practices"
Write-Host "⚠ Run 'npm audit' to check for vulnerabilities"
Write-Host "⚠ Enable HTTPS in production"
Write-Host ""
Write-Host "⚠️  IMPORTANT:" -ForegroundColor Yellow
Write-Host "- Never commit .env to git"
Write-Host "- Keep your secrets secure"
Write-Host "- Rotate secrets regularly"
Write-Host "- Enable 2FA for admin accounts"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Green
Write-Host "- Backend Security: ./SECURITY.md"
Write-Host "- Frontend Security: ./frontend/SECURITY.md"
Write-Host "- Deployment Guide: ./DEPLOYMENT.md"
Write-Host ""
Write-Host "🚀 Ready to start!" -ForegroundColor Green
Write-Host "Run: docker-compose up -d --build"
Write-Host ""
