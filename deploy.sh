#!/bin/bash
# 🚀 Quick Deploy Script for capturestream.com
# Автоматичне оновлення проекту на production сервері

echo "🚀 ===== CAPTURESTREAM.COM DEPLOYMENT ====="
echo ""

# Кольори для виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Зупинка PM2
echo -e "${YELLOW}⏹️  Зупинка поточного процесу...${NC}"
pm2 stop informator-capturestream 2>/dev/null || echo "Процес не запущений"

# Отримання останніх змін
echo -e "${YELLOW}📥 Отримання останніх змін з GitHub...${NC}"
git fetch origin
git reset --hard origin/main
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Помилка при отриманні змін з GitHub${NC}"
    exit 1
fi

# Встановлення залежностей
echo -e "${YELLOW}📦 Встановлення залежностей...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Помилка при встановленні залежностей${NC}"
    exit 1
fi

# Компіляція TypeScript
echo -e "${YELLOW}🔨 Компіляція TypeScript...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Помилка компіляції${NC}"
    exit 1
fi

# Перезапуск PM2
echo -e "${YELLOW}🔄 Перезапуск PM2...${NC}"
pm2 restart informator-capturestream || pm2 start ecosystem.config.js

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Помилка запуску PM2${NC}"
    exit 1
fi

# Збереження PM2 конфігурації
pm2 save

# Перезавантаження Nginx
echo -e "${YELLOW}🌐 Перезавантаження Nginx...${NC}"
sudo systemctl reload nginx

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Попередження: Nginx не перезавантажився${NC}"
fi

# Фінальна перевірка
echo ""
echo -e "${GREEN}✅ ===== DEPLOYMENT ЗАВЕРШЕНО УСПІШНО! =====${NC}"
echo ""
echo -e "${GREEN}🌐 Ваш сайт доступний на:${NC}"
echo -e "   ${GREEN}🏠 http://capturestream.com/${NC}"
echo -e "   ${GREEN}📺 http://capturestream.com/host.html${NC}"
echo -e "   ${GREEN}👁️  http://capturestream.com/viewer.html${NC}"
echo ""
echo -e "${YELLOW}📊 Статус PM2:${NC}"
pm2 status informator-capturestream
echo ""
echo -e "${YELLOW}📝 Останні логи (Ctrl+C для виходу):${NC}"
pm2 logs informator-capturestream --lines 20