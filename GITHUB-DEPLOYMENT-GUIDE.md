# 🚀 GitHub Deployment Guide для Informator

## Варіанти розгортання з GitHub доменом

### 1. GitHub Pages + Local Server (Гібридний підхід)

#### Що потрібно:
- GitHub репозиторій з активованим GitHub Pages
- Локальний сервер з ngrok тунелем

#### Налаштування:
```bash
# 1. Підготувати frontend для GitHub Pages
mkdir docs
cp frontend/* docs/
cp index.html docs/

# 2. Оновити конфігурацію для production
# У docs/index.html змінити WebSocket URL:
const wsUrl = 'wss://ваш-ngrok-домен.ngrok.io';
```

#### GitHub Pages налаштування:
1. Repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, folder: /docs
4. Ваш сайт буде доступний на: `ваш-репозиторій.github.io`

---

### 2. GitHub Codespaces (Повністю хмарний)

#### Переваги:
- ✅ Повна підтримка Node.js та C++ модулів
- ✅ Автоматичний публічний URL
- ✅ Вбудований VS Code в браузері
- ✅ Безкоштовно для студентів (60 годин/місяць)

#### Налаштування:
```bash
# 1. Створити .devcontainer/devcontainer.json
{
  "name": "Informator Development",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/python:1": {},
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "postCreateCommand": "npm install",
  "forwardPorts": [3000, 8080],
  "portsAttributes": {
    "3000": {
      "visibility": "public",
      "label": "Informator Server"
    }
  }
}
```

#### Запуск:
1. Відкрити репозиторій на GitHub
2. Code → Codespaces → Create codespace
3. Запустити проект: `npm start`
4. Codespaces автоматично надасть публічний URL

---

### 3. Повне хмарне розгортання (VPS/Cloud)

#### Якщо маєте студентський пакет з доменом:

**Платформи з безкоштовним доступом:**
- **DigitalOcean**: $200 кредитів для студентів
- **AWS**: Безкоштовний рівень + студентські кредити
- **Google Cloud**: $300 кредитів
- **Heroku**: Базовий план
- **Vercel**: Безкоштовний для проектів

#### Структура розгортання:
```
Ваш домен (example.com)
├── Frontend (Vercel/Netlify)
├── API Server (Heroku/Railway)
└── Screen Capture (VPS з Windows)
```

---

### 4. Docker розгортання

#### Створити Dockerfile:
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3000 8080

CMD ["npm", "start"]
```

#### Docker Compose:
```yaml
# docker-compose.yml
version: '3.8'
services:
  informator:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DOMAIN=ваш-домен.com
```

---

### 5. Налаштування для Production

#### Environment Variables:
```bash
# .env.production
NODE_ENV=production
PORT=3000
WEBSOCKET_PORT=8080
DOMAIN=ваш-домен.com
CORS_ORIGIN=https://ваш-домен.com
```

#### Оновити server.ts:
```typescript
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

#### SSL сертифікат (Let's Encrypt):
```bash
# Для Ubuntu/Debian
sudo apt install certbot
sudo certbot --nginx -d ваш-домен.com
```

---

### 6. GitHub Actions для автодеплою

#### .github/workflows/deploy.yml:
```yaml
name: Deploy Informator

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build project
        run: npm run build
        
      - name: Deploy to server
        run: |
          # Ваш скрипт деплою
```

---

## Рекомендований план дій:

### Для швидкого тестування:
1. **GitHub Codespaces** - найпростіший варіант
2. Запустити в хмарі за 5 хвилин
3. Отримати публічний URL автоматично

### Для production:
1. **Frontend**: GitHub Pages або Vercel
2. **Backend**: Railway або Heroku
3. **Домен**: Підключити ваш GitHub домен
4. **SSL**: Автоматично через платформу

### Бюджет: $0
- GitHub Pages: Безкоштовно
- GitHub Codespaces: 60 годин/місяць безкоштовно
- Vercel/Netlify: Безкоштовні плани
- Railway: Безкоштовний стартовий план

---

## Готові команди для швидкого деплою:

```bash
# 1. Підготувати до деплою
npm run build

# 2. Створити production конфіг
echo "NODE_ENV=production" > .env

# 3. Запустити локально для тестування
npm start

# 4. Деплой на GitHub Pages
git add .
git commit -m "Deploy to production"
git push origin main
```

🎯 **Висновок**: Так, з GitHub доменом ви можете легко розгорнути Informator в мережі. Найшвидший варіант - GitHub Codespaces, найдешевший - GitHub Pages + ngrok.