#!/bin/bash

# Build and Deploy Script for AI Commerce

set -e

echo "🚀 AI Commerce Deployment Script"
echo "================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Menu
echo ""
echo "Select deployment option:"
echo "1) Full Stack (Backend + Frontend + PostgreSQL)"
echo "2) Backend Only"
echo "3) Frontend Only"
echo "4) Stop All Services"
echo "5) View Logs"
echo "6) Rebuild All"
read -p "Enter your choice [1-6]: " choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Deploying Full Stack...${NC}"
        docker-compose up -d --build
        echo -e "${GREEN}✅ Full stack deployed!${NC}"
        echo "Frontend: http://localhost:3000"
        echo "Backend: http://localhost:5000"
        echo "Database: localhost:5432"
        ;;
    2)
        echo -e "${GREEN}🚀 Deploying Backend Only...${NC}"
        cd Backend
        docker-compose -f docker-compose.prod.yml up -d --build
        echo -e "${GREEN}✅ Backend deployed!${NC}"
        echo "Backend: http://localhost:5000"
        ;;
    3)
        echo -e "${GREEN}🚀 Deploying Frontend Only...${NC}"
        cd frontend
        docker-compose -f docker-compose.prod.yml up -d --build
        echo -e "${GREEN}✅ Frontend deployed!${NC}"
        echo "Frontend: http://localhost:3000"
        ;;
    4)
        echo -e "${YELLOW}🛑 Stopping all services...${NC}"
        docker-compose down
        cd Backend && docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
        cd ../frontend && docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
        echo -e "${GREEN}✅ All services stopped!${NC}"
        ;;
    5)
        echo -e "${GREEN}📋 Showing logs...${NC}"
        docker-compose logs -f
        ;;
    6)
        echo -e "${YELLOW}🔄 Rebuilding all services...${NC}"
        docker-compose down
        docker-compose up -d --build --force-recreate
        echo -e "${GREEN}✅ All services rebuilt!${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
