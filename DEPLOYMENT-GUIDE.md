# 🚀 Deployment Guide - capturestream.com

## 📋 Передумови

### Сервер вимоги:
- ✅ Ubuntu 20.04+ або аналог
- ✅ Node.js 16+
- ✅ Nginx (як reverse proxy)
- ✅ PM2 (для process management)
- ✅ SSL сертифікат (Let's Encrypt)

### Домен:
- ✅ `capturestream.com` вказує на IP сервера
- ✅ DNS записи налаштовані

---

## 🔧 Крок 1: Підготовка сервера

### Оновлення системи:
```bash
sudo apt update
sudo apt upgrade -y
```

### Встановлення Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Встановлення PM2:
```bash
sudo npm install -g pm2
```

### Встановлення Nginx:
```bash
sudo apt install nginx -y
```

---

## 📦 Крок 2: Клонування проекту

```bash
cd /var/www
sudo git clone https://github.com/Stefect/informator-2025.git capturestream
cd capturestream
sudo chown -R $USER:$USER /var/www/capturestream
```

---

## 🔨 Крок 3: Встановлення залежностей

```bash
npm install
npm run build
```

---

## ⚙️ Крок 4: Налаштування environment

```bash
cp .env.production .env
nano .env
```

Перевірте налаштування:
```env
DOMAIN=capturestream.com
PROTOCOL=http
PORT=3001
NODE_ENV=production
```

---

## 🌐 Крок 5: Налаштування Nginx

### Створити конфігурацію:
```bash
sudo nano /etc/nginx/sites-available/capturestream
```

### Вставити конфігурацію:
```nginx
upstream informator_backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name capturestream.com www.capturestream.com;

    # Логи
    access_log /var/log/nginx/capturestream_access.log;
    error_log /var/log/nginx/capturestream_error.log;

    # Root directory
    root /var/www/capturestream;

    # Статичні файли
    location / {
        try_files $uri $uri/ @backend;
    }

    # HTML файли
    location ~* \.(html|ico)$ {
        root /var/www/capturestream;
        expires 1h;
        add_header Cache-Control "public";
    }

    # Backend API
    location @backend {
        proxy_pass http://informator_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket підтримка
    location /ws {
        proxy_pass http://informator_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

### Активувати конфігурацію:
```bash
sudo ln -s /etc/nginx/sites-available/capturestream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔐 Крок 6: SSL (HTTPS)

### Встановити Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Отримати сертифікат:
```bash
sudo certbot --nginx -d capturestream.com -d www.capturestream.com
```

### Автоматичне оновлення:
```bash
sudo certbot renew --dry-run
```

---

## 🚀 Крок 7: Запуск з PM2

### Створити PM2 ecosystem:
```bash
nano ecosystem.config.js
```

### Вставити конфігурацію:
```javascript
module.exports = {
  apps: [{
    name: 'informator',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### Запустити:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔍 Крок 8: Моніторинг

### PM2 моніторинг:
```bash
pm2 monit
pm2 logs informator
pm2 status
```

### Nginx логи:
```bash
sudo tail -f /var/log/nginx/capturestream_access.log
sudo tail -f /var/log/nginx/capturestream_error.log
```

---

## 🔄 Крок 9: Оновлення проекту

### Створити update скрипт:
```bash
nano update.sh
```

### Вставити:
```bash
#!/bin/bash
cd /var/www/capturestream
git pull origin main
npm install
npm run build
pm2 restart informator
echo "✅ Update completed!"
```

### Зробити виконуваним:
```bash
chmod +x update.sh
```

### Використання:
```bash
./update.sh
```

---

## 🎯 Крок 10: Тестування

### Перевірити доступність:
```bash
# Основна сторінка
curl http://capturestream.com

# Host інтерфейс
curl http://capturestream.com/host.html

# Viewer інтерфейс
curl http://capturestream.com/viewer.html
```

### Перевірити WebSocket:
```bash
# Встановити wscat
npm install -g wscat

# Тест підключення
wscat -c ws://capturestream.com
```

---

## 🎨 URLs після деплою:

- 🏠 **Головна**: http://capturestream.com/
- 📺 **Стрімер**: http://capturestream.com/host.html
- 👁️ **Глядач**: http://capturestream.com/viewer.html
- 📊 **API**: http://capturestream.com/api

---

## 🛠️ Troubleshooting

### Сервер не запускається:
```bash
pm2 logs informator --lines 50
```

### Nginx помилки:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### WebSocket не працює:
Перевірте firewall:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### Порт зайнятий:
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

---

## 📊 Performance Tips

### PM2 кластер режим:
```bash
pm2 start ecosystem.config.js -i max
```

### Nginx кешування:
Додати в nginx конфігурацію:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
```

### Node.js оптимізація:
```bash
export NODE_ENV=production
export UV_THREADPOOL_SIZE=128
```

---

## ✅ Checklist перед go-live:

- [ ] DNS записи налаштовані
- [ ] Nginx працює і налаштований
- [ ] SSL сертифікат встановлений
- [ ] PM2 запущений і автостарт налаштований
- [ ] Логи працюють
- [ ] WebSocket підключається
- [ ] Всі HTML файли доступні
- [ ] Performance тестування пройдено
- [ ] Backup налаштований

---

## 🎉 Готово!

Ваш Informator тепер доступний на **http://capturestream.com/**! 🚀

Для оновлень просто запускайте: `./update.sh`