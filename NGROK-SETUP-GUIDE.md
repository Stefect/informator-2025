# 🌍 Налаштування глобального доступу через ngrok

## ✅ Швидке налаштування (3 кроки):

### 1️⃣ Отримайте токен ngrok
- Перейдіть на: **https://dashboard.ngrok.com/get-started/your-authtoken**
- Скопіюйте ваш токен (виглядає як: `2p9Y7abc123...`)

### 2️⃣ Додайте токен до ngrok
Відкрийте PowerShell в папці Informator та виконайте:
```powershell
ngrok config add-authtoken ВАШ_ТОКЕН_СЮДИ
```

### 3️⃣ Запустіть глобальний доступ
Двічі клікніть на файл: **`start-global-access.bat`**

Або виконайте в PowerShell:
```powershell
ngrok http 8080
```

---

## 🎯 Що отримаєте:

После запуску ngrok ви побачите щось таке:
```
ngrok                                                                                                                                                                                                                                                          

Session Status                online                                                                                                                                                                                                                           
Account                       your-email@example.com (Plan: Free)                                                                                                                                                                                             
Version                       3.22.1                                                                                                                                                                                                                           
Region                        United States (us)                                                                                                                                                                                                               
Latency                       45ms                                                                                                                                                                                                                             
Web Interface                 http://127.0.0.1:4040                                                                                                                                                                                                           
Forwarding                    https://abc123-def-456.ngrok-free.app -> http://localhost:8080                                                                                                                                                                 

Connections                   ttl     opn     rt1     rt5     p50     p90                                                                                                                                                                                      
                              0       0       0.00    0.00    0.00    0.00      
```

**Ваш глобальний URL:** `https://abc123-def-456.ngrok-free.app`

---

## 🔐 Доступ до системи:

1. **Перейдіть на ваш ngrok URL**
2. **Введіть пароль:** `informator2025`
3. **Виберіть клієнт для перегляду екрану**

---

## 📱 Тепер доступно з будь-якої точки світу:

- ✅ **Комп'ютер в офісі:** https://ваш-ngrok-url.ngrok-free.app
- ✅ **Мобільний телефон:** https://ваш-ngrok-url.ngrok-free.app  
- ✅ **Планшет:** https://ваш-ngrok-url.ngrok-free.app
- ✅ **Інший комп'ютер:** https://ваш-ngrok-url.ngrok-free.app

---

## ⚠️ Безпека:

- 🔒 **Автентифікація активна** - потрібен пароль `informator2025`
- 🌐 **HTTPS з'єднання** - весь трафік зашифрований
- ⏰ **Безплатний план ngrok** - тунель автоматично закривається через 2 години
- 🔄 **Перезапуск тунелю** - просто запустіть `start-global-access.bat` знову

---

## 🆘 Якщо щось не працює:

### Помилка: "ngrok config add-authtoken failed"
```powershell
# Перевірте чи правильно скопіювали токен
ngrok config check
```

### Помилка: "backend server not running"
```powershell
cd backend
npm start
```

### Помилка: "tunnel session failed"
- Перевірте інтернет з'єднання
- Перезапустіть ngrok

---

## 📊 Моніторинг:

- **ngrok веб-інтерфейс:** http://127.0.0.1:4040
- **Локальний доступ:** http://192.168.1.101:8080
- **Статистика підключень та помилок доступна в ngrok інтерфейсі**

---

**🎉 Тепер ваш Informator доступний з будь-якої точки світу без налаштування роутера!**