# Інструкції для публічного доступу до Informator

## 🚀 Метод 1: ngrok (Рекомендується)

### Встановлення:
1. Перейдіть на https://ngrok.com/download
2. Скачайте ngrok для Windows (zip архів)
3. Розпакуйте ngrok.exe у папку проекту
4. Зареєструйтеся на https://dashboard.ngrok.com/signup
5. Отримайте ваш authtoken

### Налаштування:
```powershell
# Встановити токен (один раз)
.\ngrok.exe authtoken YOUR_AUTH_TOKEN

# Запустити тунель
.\ngrok.exe http 8080
```

### Результат:
Ви отримаєте URL типу: https://abc123.ngrok.io

---

## 🌐 Метод 2: Cloudflare Tunnel (Безкоштовний)

### Встановлення:
1. Скачайте cloudflared: https://github.com/cloudflare/cloudflared/releases
2. Розпакуйте cloudflared.exe

### Запуск:
```powershell
.\cloudflared.exe tunnel --url http://localhost:8080
```

### Результат:
Ви отримаєте URL типу: https://abc-123.trycloudflare.com

---

## 🏠 Метод 3: Port Forwarding на роутері

### Налаштування роутера:
1. Увійдіть в адмін панель роутера (зазвичай 192.168.1.1)
2. Знайдіть "Port Forwarding" або "Virtual Servers"
3. Додайте правило:
   - Зовнішній порт: 8080
   - Внутрішній IP: 192.168.1.101
   - Внутрішній порт: 8080
   - Протокол: TCP

### Результат:
Доступ через ваш зовнішній IP: http://YOUR_EXTERNAL_IP:8080

---

## ⚠️ Безпека

🔒 **Завжди використовуйте пароль** (зараз: informator2025)

🌍 **Публічний доступ означає доступ для ВСІХ в інтернеті**

🛡️ **Рекомендації:**
- Змініть пароль на більш складний
- Використовуйте тільки коли потрібно
- Вимикайте тунель коли не користуєтеся

---

## 🚀 Швидкий запуск з ngrok:

1. Скачайте ngrok.exe з https://ngrok.com/download
2. Покладіть ngrok.exe в папку проекту
3. Зареєструйтеся на ngrok.com і отримайте токен
4. Запустіть команди:

```powershell
# Налаштування (один раз)
.\ngrok.exe authtoken YOUR_TOKEN

# Запуск сервера (в одному терміналі)
cd backend
npm start

# Запуск клієнта (в другому терміналі)  
cd client
node dist/client.js

# Запуск тунелю (в третьому терміналі)
.\ngrok.exe http 8080
```

Тепер ваш сервер доступний з будь-якої точки світу! 🌍