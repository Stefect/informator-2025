# 🎯 Quick Start - capturestream.com

## 🌐 Live URLs

### Для користувачів:
- 🏠 **Головна сторінка**: http://capturestream.com/
- 📺 **Режим стрімера**: http://capturestream.com/host.html
- 👁️ **Режим глядача**: http://capturestream.com/viewer.html

### Для адміністраторів:
- 📊 **Server Status**: http://capturestream.com/api/status
- 📈 **Metrics**: http://capturestream.com/api/metrics

---

## 🚀 Deployment на capturestream.com

### Перший раз (Initial Setup):

```bash
# 1. SSH на сервер
ssh user@your-server-ip

# 2. Перейти в директорію
cd /var/www/capturestream

# 3. Клонувати проект (якщо ще не клоновано)
git clone https://github.com/Stefect/informator-2025.git .

# 4. Встановити залежності
npm install

# 5. Зкомпілювати
npm run build

# 6. Запустити з PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Оновлення (Updates):

```bash
# Просто запустіть deploy скрипт
./deploy.sh
```

Або вручну:
```bash
git pull origin main
npm install
npm run build
pm2 restart informator-capturestream
```

---

## 📋 Швидкі команди

### PM2 Управління:
```bash
# Статус
pm2 status

# Перезапуск
pm2 restart informator-capturestream

# Зупинка
pm2 stop informator-capturestream

# Логи
pm2 logs informator-capturestream

# Моніторинг
pm2 monit
```

### Nginx:
```bash
# Тест конфігурації
sudo nginx -t

# Перезавантаження
sudo systemctl reload nginx

# Статус
sudo systemctl status nginx

# Логи
sudo tail -f /var/log/nginx/capturestream_access.log
```

### Git:
```bash
# Поточний статус
git status

# Останні зміни
git log --oneline -10

# Скинути до останнього коміту
git reset --hard origin/main
```

---

## 🔍 Troubleshooting

### Сайт не відповідає:
```bash
# Перевірити PM2
pm2 status informator-capturestream
pm2 logs informator-capturestream --lines 50

# Перевірити Nginx
sudo nginx -t
sudo systemctl status nginx

# Перевірити порт
sudo lsof -i :3001
```

### WebSocket не підключається:
```bash
# Перевірити firewall
sudo ufw status

# Перевірити Nginx WebSocket конфігурацію
sudo nano /etc/nginx/sites-available/capturestream

# Тест WebSocket
wscat -c ws://capturestream.com
```

### Оновлення не застосовуються:
```bash
# Жорсткий reset
cd /var/www/capturestream
git fetch origin
git reset --hard origin/main
git pull origin main
npm install
npm run build
pm2 restart informator-capturestream
```

---

## 📊 Моніторинг

### Системні ресурси:
```bash
# CPU та Memory
htop

# Дисковий простір
df -h

# Мережа
iftop
```

### Application метрики:
```bash
# PM2 метрики
pm2 monit

# Логи в реальному часі
pm2 logs informator-capturestream --lines 0

# Application stats
curl http://localhost:3001/api/status
```

---

## 🎯 Checklist для go-live

### Before deployment:
- [ ] Код протестовано локально
- [ ] Всі тести пройшли успішно
- [ ] Версія оновлена в package.json
- [ ] Зміни закоміченні в git
- [ ] README оновлений

### During deployment:
- [ ] Backup поточної версії зроблено
- [ ] Git pull успішний
- [ ] npm install без помилок
- [ ] TypeScript компіляція успішна
- [ ] PM2 перезапустився

### After deployment:
- [ ] Сайт відкривається http://capturestream.com/
- [ ] Host interface працює
- [ ] Viewer interface працює
- [ ] WebSocket підключається
- [ ] Логи чисті (немає помилок)
- [ ] Performance нормальний

---

## 📞 Контакти

### Production сервер:
- **Domain**: capturestream.com
- **Server IP**: [YOUR-SERVER-IP]
- **SSH User**: [YOUR-USERNAME]

### Repository:
- **GitHub**: https://github.com/Stefect/informator-2025
- **Branch**: main

---

## 🎉 Готово!

Ваш CaptureStream тепер live на **http://capturestream.com/**!

Для оновлень просто запускайте: `./deploy.sh` 🚀