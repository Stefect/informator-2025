# Backend Server Dockerfile

FROM node:18-alpine

# Встановити робочу директорію
WORKDIR /app

# Копіювати package файли
COPY package*.json ./
COPY tsconfig.json ./

# Встановити залежності
RUN npm ci --only=production

# Копіювати вихідний код
COPY src ./src

# Збірка TypeScript
RUN npm run build

# Копіювати frontend (якщо потрібно)
COPY ../frontend/public ./frontend/public

# Створити директорії для логів та записів
RUN mkdir -p logs recordings

# Відкрити порт
EXPOSE 3001

# Запуск
CMD ["node", "dist/index.js"]
