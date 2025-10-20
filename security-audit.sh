#!/bin/bash

# 🔍 Security Audit Script
# Kiểm tra các vấn đề bảo mật phổ biến

echo "🔍 Security Audit - AI Commerce"
echo "================================"
echo ""

ISSUES=0
WARNINGS=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check 1: .env file security
echo -e "${BLUE}1. Checking .env file security...${NC}"
if [ -f ".env" ]; then
    if git ls-files --error-unmatch .env 2>/dev/null; then
        echo -e "${RED}❌ CRITICAL: .env file is tracked by git!${NC}"
        echo "   Fix: git rm --cached .env"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓ .env is not tracked by git${NC}"
    fi
    
    # Check for default secrets
    if grep -q "your-super-secret" .env; then
        echo -e "${RED}❌ CRITICAL: Default JWT_SECRET detected!${NC}"
        echo "   Fix: Run ./setup-security.sh to generate secure secrets"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓ JWT_SECRET appears to be customized${NC}"
    fi
    
    # Check file permissions
    PERMS=$(stat -c %a .env 2>/dev/null || stat -f %A .env)
    if [ "$PERMS" != "600" ]; then
        echo -e "${YELLOW}⚠ WARNING: .env file permissions are $PERMS (should be 600)${NC}"
        echo "   Fix: chmod 600 .env"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓ .env file permissions are secure${NC}"
    fi
else
    echo -e "${RED}❌ CRITICAL: .env file not found!${NC}"
    echo "   Fix: Copy .env.example to .env and configure"
    ((ISSUES++))
fi
echo ""

# Check 2: Dependencies vulnerabilities
echo -e "${BLUE}2. Checking for npm vulnerabilities...${NC}"
cd Backend
npm audit --json > /tmp/npm-audit.json 2>/dev/null
VULNERABILITIES=$(cat /tmp/npm-audit.json | grep -o '"total": [0-9]*' | grep -o '[0-9]*' | head -1)
if [ "$VULNERABILITIES" -gt 0 ]; then
    echo -e "${YELLOW}⚠ WARNING: Found $VULNERABILITIES npm vulnerabilities${NC}"
    echo "   Fix: npm audit fix"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓ No npm vulnerabilities found${NC}"
fi
cd ..
echo ""

# Check 3: HTTPS configuration
echo -e "${BLUE}3. Checking HTTPS configuration...${NC}"
if [ -f ".env" ]; then
    if grep -q "NODE_ENV=production" .env; then
        if grep -q "http://localhost" .env; then
            echo -e "${YELLOW}⚠ WARNING: Production mode but using http://localhost${NC}"
            echo "   Fix: Update URLs to use https:// in production"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✓ Production configuration looks good${NC}"
        fi
    else
        echo -e "${BLUE}ℹ Development mode detected${NC}"
    fi
fi
echo ""

# Check 4: Sensitive files exposure
echo -e "${BLUE}4. Checking for exposed sensitive files...${NC}"
SENSITIVE_FILES=(".env" "*.pem" "*.key" "*.p12" "*.pfx" "id_rsa" "id_dsa")
for pattern in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$pattern" 2>/dev/null; then
        echo -e "${RED}❌ CRITICAL: Sensitive file '$pattern' is tracked by git!${NC}"
        ((ISSUES++))
    fi
done
echo -e "${GREEN}✓ No sensitive files exposed in git${NC}"
echo ""

# Check 5: Docker security
echo -e "${BLUE}5. Checking Docker configuration...${NC}"
if [ -f "Backend/Dockerfile" ]; then
    if grep -q "USER root" Backend/Dockerfile; then
        echo -e "${YELLOW}⚠ WARNING: Running as root in Docker${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓ Not running as root in Docker${NC}"
    fi
    
    if grep -q "ADD \.env" Backend/Dockerfile; then
        echo -e "${RED}❌ CRITICAL: .env file copied into Docker image!${NC}"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓ .env not copied into Docker image${NC}"
    fi
fi
echo ""

# Check 6: Security headers
echo -e "${BLUE}6. Checking security middleware...${NC}"
if [ -f "Backend/src/middleware/security.ts" ]; then
    echo -e "${GREEN}✓ Security middleware exists${NC}"
else
    echo -e "${RED}❌ CRITICAL: Security middleware not found!${NC}"
    ((ISSUES++))
fi

if [ -f "Backend/src/config/helmet.ts" ]; then
    echo -e "${GREEN}✓ Helmet configuration exists${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Helmet configuration not found${NC}"
    ((WARNINGS++))
fi
echo ""

# Check 7: Rate limiting
echo -e "${BLUE}7. Checking rate limiting configuration...${NC}"
if grep -q "express-rate-limit" Backend/package.json; then
    echo -e "${GREEN}✓ Rate limiting library installed${NC}"
else
    echo -e "${RED}❌ CRITICAL: Rate limiting not installed!${NC}"
    echo "   Fix: npm install express-rate-limit"
    ((ISSUES++))
fi
echo ""

# Check 8: CORS configuration
echo -e "${BLUE}8. Checking CORS configuration...${NC}"
if [ -f "Backend/src/config/helmet.ts" ]; then
    if grep -q "corsOptions" Backend/src/config/helmet.ts; then
        echo -e "${GREEN}✓ CORS configuration found${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: CORS configuration might be missing${NC}"
        ((WARNINGS++))
    fi
fi
echo ""

# Check 9: Logging configuration
echo -e "${BLUE}9. Checking logging setup...${NC}"
if [ -f "Backend/src/utils/logger.ts" ]; then
    echo -e "${GREEN}✓ Logger utility exists${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Logger utility not found${NC}"
    ((WARNINGS++))
fi

if [ -d "Backend/logs" ]; then
    echo -e "${GREEN}✓ Logs directory exists${NC}"
    
    # Check if logs are in .gitignore
    if grep -q "logs/" .gitignore; then
        echo -e "${GREEN}✓ Logs directory is in .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: Add 'logs/' to .gitignore${NC}"
        ((WARNINGS++))
    fi
fi
echo ""

# Check 10: Database security
echo -e "${BLUE}10. Checking database configuration...${NC}"
if [ -f ".env" ]; then
    if grep -q "POSTGRES_PASSWORD=postgres" .env || grep -q "POSTGRES_PASSWORD=password" .env; then
        echo -e "${RED}❌ CRITICAL: Weak database password detected!${NC}"
        echo "   Fix: Use a strong password (min 16 characters)"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓ Database password appears strong${NC}"
    fi
fi
echo ""

# Check 11: Payment security
echo -e "${BLUE}11. Checking payment configuration...${NC}"
if [ -f ".env" ]; then
    if grep -q "sk_live_" .env; then
        echo -e "${GREEN}✓ Using Stripe live keys${NC}"
        if grep -q "NODE_ENV=development" .env; then
            echo -e "${RED}❌ CRITICAL: Live payment keys in development mode!${NC}"
            ((ISSUES++))
        fi
    elif grep -q "sk_test_" .env; then
        echo -e "${BLUE}ℹ Using Stripe test keys${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: Stripe keys not configured${NC}"
        ((WARNINGS++))
    fi
fi
echo ""

# Check 12: Frontend security
echo -e "${BLUE}12. Checking frontend security...${NC}"
if [ -f "frontend/SECURITY.md" ]; then
    echo -e "${GREEN}✓ Frontend security documentation exists${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Frontend security documentation missing${NC}"
    ((WARNINGS++))
fi

if [ -f "frontend/next.config.ts" ]; then
    if grep -q "headers()" frontend/next.config.ts; then
        echo -e "${GREEN}✓ Security headers configured in Next.js${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: Security headers not configured in Next.js${NC}"
        ((WARNINGS++))
    fi
fi
echo ""

# Summary
echo "================================"
echo -e "${BLUE}Security Audit Summary${NC}"
echo "================================"
echo ""

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 Perfect! No security issues found!${NC}"
    exit 0
else
    if [ $ISSUES -gt 0 ]; then
        echo -e "${RED}❌ Critical Issues: $ISSUES${NC}"
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Recommendations:${NC}"
    echo "1. Fix all critical issues before deploying to production"
    echo "2. Review warnings and address them when possible"
    echo "3. Run this audit regularly (weekly recommended)"
    echo "4. Keep dependencies updated: npm audit fix"
    echo "5. Review SECURITY.md for best practices"
    echo ""
    
    if [ $ISSUES -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
fi
