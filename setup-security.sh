#!/bin/bash

# 🔒 Security Setup Script for AI Commerce Platform
# This script helps you set up security configurations

set -e

echo "🔒 AI Commerce - Security Setup"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Copy .env.example
echo -e "${BLUE}📝 Copying .env.example to .env...${NC}"
cp .env.example .env

# Generate secrets
echo -e "${BLUE}🔑 Generating secure secrets...${NC}"
JWT_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)

# Update .env file
echo -e "${BLUE}✏️  Updating .env with generated secrets...${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
else
    # Linux
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
fi

echo ""
echo -e "${GREEN}✅ Generated Secrets:${NC}"
echo -e "JWT_SECRET: ${YELLOW}$JWT_SECRET${NC}"
echo -e "SESSION_SECRET: ${YELLOW}$SESSION_SECRET${NC}"
echo ""

# Prompt for database password
read -p "Enter PostgreSQL password (or press Enter to generate): " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(generate_secret)
    echo -e "${GREEN}Generated database password: ${YELLOW}$DB_PASSWORD${NC}"
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env
    sed -i '' "s/your_secure_password_here/$DB_PASSWORD/" .env
else
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env
    sed -i "s/your_secure_password_here/$DB_PASSWORD/" .env
fi

echo ""
echo -e "${BLUE}🔗 Configure URLs:${NC}"

# Frontend URL
read -p "Enter Frontend URL (default: http://localhost:3000): " FRONTEND_URL
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" .env
    sed -i '' "s|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=$FRONTEND_URL|" .env
else
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" .env
    sed -i "s|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=$FRONTEND_URL|" .env
fi

# Backend API URL
read -p "Enter Backend API URL (default: http://localhost:5000/api): " API_URL
API_URL=${API_URL:-http://localhost:5000/api}

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$API_URL|" .env
else
    sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$API_URL|" .env
fi

echo ""
echo -e "${BLUE}💳 Payment Configuration:${NC}"
echo -e "${YELLOW}Note: You'll need to add these manually${NC}"
echo ""
echo "1. Stripe Keys (get from: https://dashboard.stripe.com/apikeys)"
echo "   - STRIPE_SECRET_KEY=sk_test_..."
echo "   - STRIPE_WEBHOOK_SECRET=whsec_..."
echo "   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..."
echo ""
echo "2. PayPal Credentials (get from: https://developer.paypal.com/)"
echo "   - PAYPAL_CLIENT_ID=..."
echo "   - PAYPAL_CLIENT_SECRET=..."
echo ""

# Security recommendations
echo ""
echo -e "${GREEN}✅ Security Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Add your Stripe & PayPal credentials to .env"
echo "2. Review and update BLACKLISTED_IPS/WHITELISTED_IPS if needed"
echo "3. Configure email settings (SMTP_*) for notifications"
echo "4. Change NODE_ENV to 'production' for production deployment"
echo ""
echo -e "${BLUE}🔒 Security Checklist:${NC}"
echo ""
echo "✓ Secrets generated and configured"
echo "✓ Database password set"
echo "✓ URLs configured"
echo "⚠ Add payment provider credentials"
echo "⚠ Configure email settings"
echo "⚠ Review SECURITY.md for best practices"
echo "⚠ Run 'npm audit' to check for vulnerabilities"
echo "⚠ Enable HTTPS in production"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "- Never commit .env to git"
echo "- Keep your secrets secure"
echo "- Rotate secrets regularly"
echo "- Enable 2FA for admin accounts"
echo ""
echo -e "${GREEN}📚 Documentation:${NC}"
echo "- Backend Security: ./SECURITY.md"
echo "- Frontend Security: ./frontend/SECURITY.md"
echo "- Deployment Guide: ./DEPLOYMENT.md"
echo ""
echo -e "${GREEN}🚀 Ready to start!${NC}"
echo "Run: docker-compose up -d --build"
echo ""
