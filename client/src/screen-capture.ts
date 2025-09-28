import path from 'path';
import { ScreenCaptureModule, CaptureConfig } from './types';

// Пошук нативного модуля
const modulePaths = [
  './build/Release/screen-capture.node',
  './screen-capture.node'
];

let screenCaptureModule: ScreenCaptureModule | null = null;

// Конфігурація захоплення екрану за замовчуванням
let captureConfig: CaptureConfig = {
  interval: 50,  // Інтервал між кадрами (відповідає 20 FPS)
  quality: 85,   // Якість JPEG (85% для оптимізації трафіку)
  scale: 0.9,    // Масштаб зображення (90% від оригінального розміру)
  fps: 10        // 10 FPS для оптимізації трафіку
};

/**
 * Ініціалізація модуля захоплення екрану
 */
export function initializeCapture(): boolean {
  if (screenCaptureModule) {
    return true;
  }

  try {
    let loadedModule: ScreenCaptureModule | null = null;
    let loadedPath = "";
    
    // Спробуємо завантажити модуль з різних локацій
    for (const modulePath of modulePaths) {
      try {
        loadedModule = require(modulePath);
        loadedPath = modulePath;
        console.log(`Модуль завантажено з ${modulePath}`);
        break;
      } catch (err) {
        console.error(`Помилка завантаження модуля з ${modulePath}:`, err);
      }
    }

    if (!loadedModule) {
      console.error('Не вдалося завантажити GDI модуль захоплення екрану з жодного шляху');
      console.log('Створення заглушки для тестування...');
      
      loadedModule = {
        initialize: () => true,
        captureScreen: (quality: number, scale: number) => {
          console.log('Використовується заглушка captureScreen()');
          return createTestFrame();
        },
        capture: () => {
          console.log('Використовується заглушка capture()');
          return createTestFrame();
        },
        getScreenSize: () => ({ width: 1920, height: 1080 }),
        setQuality: (quality: number) => {},
        setResolutionScale: (scale: number) => {},
        setTargetFPS: (fps: number) => {},
        setActiveClients: (clients: number) => {},
        cleanup: () => true
      };
      
      loadedPath = "заглушка модуля";
    }

    screenCaptureModule = loadedModule;
    console.log(`Модуль захоплення екрану ініціалізовано з ${loadedPath}`);
    return true;
  } catch (error) {
    console.error('Помилка ініціалізації захоплення екрану:', error);
    console.error('Стек помилки:', (error as Error).stack);
    return false;
  }
}

/**
 * Тестування методів захоплення
 */
function testCaptureMethod(module: ScreenCaptureModule): void {
  try {
    console.log('------ Тестування методів захоплення ------');
    
    // Тест getScreenSize
    if (typeof module.getScreenSize === 'function') {
      try {
        const screenSize = module.getScreenSize();
        console.log('Розмір екрану:', screenSize);
      } catch (err) {
        console.error('Помилка при отриманні розміру екрану:', err);
      }
    }
    
    // Тест captureScreen
    if (typeof module.captureScreen === 'function') {
      console.log('Тестування методу captureScreen...');
      try {
        const frame = module.captureScreen(80, 1.0); // quality=80, scale=1.0
        console.log(`captureScreen повернув результат типу: ${typeof frame}`);
        console.log(`Розмір кадру: ${frame ? frame.length : 0} байт`);
        
        if (frame && frame.length > 0) {
          console.log('Метод captureScreen працює коректно і повертає кадр');
        } else {
          console.log('Метод captureScreen повернув порожній результат');
        }
      } catch (err) {
        console.error('Помилка при виклику captureScreen():', err);
        console.error('Стек помилки:', (err as Error).stack);
      }
    }
    
    // Тест capture
    if (typeof module.capture === 'function') {
      console.log('Тестування методу capture...');
      try {
        const frame = module.capture();
        console.log(`capture повернув результат типу: ${typeof frame}`);
        console.log(`Розмір кадру: ${frame ? frame.length : 0} байт`);
        
        if (frame && frame.length > 0) {
          console.log('Метод capture працює коректно і повертає кадр');
        } else {
          console.log('Метод capture повернув порожній результат');
        }
      } catch (err) {
        console.error('Помилка при виклику capture():', err);
        console.error('Стек помилки:', (err as Error).stack);
      }
    }
    
    // Тест init або initialize, якщо вони існують
    if (typeof module.initialize === 'function') {
      console.log('Тестування методу initialize...');
      try {
        const result = module.initialize();
        console.log(`initialize повернув: ${result}`);
      } catch (err) {
        console.error('Помилка при виклику initialize():', err);
        console.error('Стек помилки:', (err as Error).stack);
      }
    }
    
    if (typeof module.init === 'function') {
      console.log('Тестування методу init...');
      try {
        const result = module.init();
        console.log(`init повернув: ${result}`);
      } catch (err) {
        console.error('Помилка при виклику init():', err);
        console.error('Стек помилки:', (err as Error).stack);
      }
    }
    
    console.log('------ Завершення тестування ------');
  } catch (err) {
    console.error('Помилка при тестуванні методів модуля:', err);
    console.error('Стек помилки:', (err as Error).stack);
  }
}

/**
 * Захоплення кадру екрану
 */
export function captureFrame(): Buffer | null {
  try {
    console.log('Спроба захоплення кадру...');
    
    if (!screenCaptureModule) {
      console.error('Модуль захоплення екрану не ініціалізовано');
      return createTestFrame();
    }
    
    // Перевіряємо наявність методу captureScreen
    if (typeof screenCaptureModule.captureScreen === 'function') {
      try {
        console.log('Використовуємо метод captureScreen()');
        
        // Захоплюємо кадр з екрану
        const frameBuffer = screenCaptureModule.captureScreen(
          captureConfig.quality, 
          captureConfig.scale
        );
        
        // Перевіряємо результат
        if (!frameBuffer) {
          console.log('captureScreen() повернув null або undefined, створюємо тестовий кадр');
          return createTestFrame();
        }
        
        console.log(`Кадр захоплено успішно, розмір: ${frameBuffer.length} байт`);
        return frameBuffer;
      } catch (error) {
        console.error('Помилка при виклику captureScreen():', error);
        console.error('Стек помилки:', (error as Error).stack);
        return createTestFrame();
      }
    } else if (typeof screenCaptureModule.capture === 'function') {
      try {
        console.log('Використовуємо метод capture()');
        
        // Оновлюємо параметри захоплення
        if (typeof screenCaptureModule.setQuality === 'function') {
          screenCaptureModule.setQuality(captureConfig.quality);
        }
        
        if (typeof screenCaptureModule.setResolutionScale === 'function') {
          screenCaptureModule.setResolutionScale(captureConfig.scale);
        }
        
        // Отримуємо розмір екрану, якщо доступно
        if (typeof screenCaptureModule.getScreenSize === 'function') {
          try {
            const screenSize = screenCaptureModule.getScreenSize();
            if (screenSize) {
              console.log(`Розмір екрану: ${screenSize.width}x${screenSize.height}`);
            }
          } catch (err) {
            console.error('Помилка при отриманні розміру екрану:', err);
            console.error('Стек помилки:', (err as Error).stack);
          }
        }
        
        // Захоплюємо кадр
        console.log('Викликаємо функцію capture()...');
        const frameBuffer = screenCaptureModule.capture();
        
        // Перевіряємо результат
        if (!frameBuffer) {
          console.log('capture() повернув null або undefined, створюємо тестовий кадр');
          return createTestFrame();
        }
        
        console.log(`Кадр захоплено успішно, розмір: ${frameBuffer.length} байт`);
        return frameBuffer;
      } catch (error) {
        console.error('Помилка при виклику capture():', error);
        console.error('Стек помилки:', (error as Error).stack);
        return createTestFrame();
      }
    } else {
      console.error('Методи захоплення екрану не доступні');
      return createTestFrame();
    }
  } catch (error) {
    console.error('Критична помилка при захопленні кадру:', error);
    console.error('Стек помилки:', (error as Error).stack);
    return createTestFrame();
  }
}

/**
 * Встановлення конфігурації захоплення
 */
export function setConfig(config: Partial<CaptureConfig>): void {
  captureConfig = { ...captureConfig, ...config };
  
  if (screenCaptureModule) {
    if (typeof screenCaptureModule.setQuality === 'function' && config.quality !== undefined) {
      screenCaptureModule.setQuality(config.quality);
    }
    
    if (typeof screenCaptureModule.setResolutionScale === 'function' && config.scale !== undefined) {
      screenCaptureModule.setResolutionScale(config.scale);
    }
    
    if (typeof screenCaptureModule.setTargetFPS === 'function' && config.fps !== undefined) {
      screenCaptureModule.setTargetFPS(config.fps);
    }
  }
}

/**
 * Отримання поточної конфігурації
 */
export function getConfig(): CaptureConfig {
  return { ...captureConfig };
}

/**
 * Створення тестового кадру
 */
export function createTestFrame(): Buffer {
  console.log('Генерація тестового кадру замість реального зображення');
  
  // Створюємо кольоровий квадрат розміром 320x240
  const width = 320;
  const height = 240;
  const buffer = Buffer.alloc(width * height * 3); // RGB по 3 байти на піксель
  
  // Заповнюємо кольором
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      
      // Червоний градієнт
      buffer[i] = Math.floor(255 * x / width);
      
      // Зелений градієнт
      buffer[i + 1] = Math.floor(255 * y / height);
      
      // Синій градієнт
      buffer[i + 2] = 128;
    }
  }
  
  // Повертаємо мінімальний валідний JPEG
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 
    0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 
    0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 
    0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
  ]);
}
