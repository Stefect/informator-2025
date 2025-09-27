/**
 * Модуль для запису відео з екрану у фоновому режимі
 * Дозволяє записувати відеопотік на диск без впливу на основний функціонал
 * @author Informator Team
 * @version 1.0.0
 */

import * as fs from 'fs';        // Для роботи з файловою системою
import * as path from 'path';    // Для роботи зі шляхами
import { logger } from './logger'; // Імпорт системи логування

/**
 * Конфігурація для запису відео
 * Визначає параметри, які контролюють процес запису відео
 */
export interface RecorderConfig {
  /** Чи увімкнено запис відео */
  enabled: boolean;
  /** Шлях до директорії для збереження записів */
  outputPath: string;
  /** Максимальний розмір файлу запису в гігабайтах */
  maxSizeGB: number;
  /** Максимальна тривалість запису в хвилинах */
  maxDurationMinutes: number;
  /** Кількість кадрів за секунду для запису */
  framesPerSecond: number;
  /** Формат файлу запису (raw - необроблені дані, mp4 - сумісний з плеєрами) */
  fileFormat: 'raw' | 'mp4';
}

/**
 * Клас для запису відео у фоновому режимі
 * Забезпечує буферизоване збереження кадрів, контроль розміру файлів
 * та автоматичну ротацію записів при досягненні лімітів
 */
export class VideoRecorder {
  /** Єдиний екземпляр класу (патерн Singleton) */
  private static instance: VideoRecorder;
  /** Поточна конфігурація запису */
  private config: RecorderConfig;
  /** Чи ведеться запис в даний момент */
  private isRecording: boolean = false;
  /** Шлях до поточного файлу запису */
  private currentFile: string = '';
  /** Буфер для збереження кадрів перед записом на диск */
  private frameBuffer: Buffer[] = [];
  /** Час початку запису (мілісекунди) */
  private recordingStartTime: number = 0;
  /** Поточний розмір файлу в байтах */
  private currentFileSize: number = 0;
  /** Кількість записаних кадрів */
  private frameCount: number = 0;
  /** Інтервал між кадрами в мілісекундах */
  private frameInterval: number = 0;
  /** Час останнього збереженого кадру */
  private lastSaveTime: number = 0;
  /** Таймер для періодичного запису буфера на диск */
  private saveInterval: NodeJS.Timeout | null = null;

  /**
   * Приватний конструктор класу VideoRecorder
   * Приватний для реалізації патерну Singleton
   */
  private constructor() {
    // Ініціалізація конфігурації за замовчуванням
    this.config = {
      enabled: false,                                   // За замовчуванням запис вимкнено
      outputPath: path.join(process.cwd(), 'recordings'), // Зберігаємо в папці 'recordings'
      maxSizeGB: 1,                                      // Максимум 1 ГБ на файл
      maxDurationMinutes: 30,                            // Максимум 30 хвилин запису
      framesPerSecond: 5,                               // 5 кадрів на секунду
      fileFormat: 'raw'                                 // Формат 'raw' для зменшення навантаження на CPU
    };
    
    this.frameInterval = 1000 / this.config.framesPerSecond;
    this.ensureOutputDirectory();
  }

  /**
   * Отримання єдиного екземпляру класу (патерн Singleton)
   * @returns Екземпляр класу VideoRecorder
   */
  public static getInstance(): VideoRecorder {
    if (!VideoRecorder.instance) {
      VideoRecorder.instance = new VideoRecorder();
    }
    return VideoRecorder.instance;
  }

  /**
   * Налаштування параметрів рекордера
   * @param config Об'єкт з частковими налаштуваннями, які буде об'єднано з поточними
   */
  public configure(config: Partial<RecorderConfig>): void {
    this.config = { ...this.config, ...config };
    this.frameInterval = 1000 / this.config.framesPerSecond;
    this.ensureOutputDirectory();
    
    logger.info('Оновлено конфігурацію рекордера відео', this.config);
  }

  /**
   * Перевірка, чи ведеться запис в даний момент
   * @returns true якщо запис активний, false якщо не активний
   */
  public isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Запуск запису відео
   * Створює новий файл та налаштовує таймер для збереження буфера
   * @returns true якщо запис успішно розпочато, false у випадку помилки
   */
  public startRecording(): boolean {
    if (!this.config.enabled) {
      logger.warn('Спроба запустити запис, але запис відключений у конфігурації');
      return false;
    }
    
    if (this.isRecording) {
      logger.warn('Запис відео вже ведеться');
      return false;
    }
    
    try {
      this.ensureOutputDirectory();
      
      // Створюємо новий файл для запису
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      this.currentFile = path.join(
        this.config.outputPath, 
        `screen-recording-${timestamp}.${this.config.fileFormat}`
      );
      
      this.recordingStartTime = Date.now();
      this.currentFileSize = 0;
      this.frameCount = 0;
      this.frameBuffer = [];
      this.lastSaveTime = Date.now();
      
      // Налаштовуємо інтервал збереження кадрів
      this.saveInterval = setInterval(() => {
        this.flushFrameBuffer();
      }, 5000); // Зберігаємо буфер кожні 5 секунд
      
      this.isRecording = true;
      logger.info(`Запуск запису відео у файл: ${this.currentFile}`);
      
      return true;
    } catch (error) {
      logger.error('Помилка при запуску запису відео:', error);
      return false;
    }
  }

  /**
   * Зупинка запису відео
   * Зберігає всі буферизовані кадри та закриває файл
   */
  public stopRecording(): void {
    if (!this.isRecording) {
      return;
    }
    
    try {
      // Скасовуємо інтервал збереження
      if (this.saveInterval) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
      
      // Зберігаємо залишкові кадри
      this.flushFrameBuffer();
      
      const duration = (Date.now() - this.recordingStartTime) / 1000;
      const fileSizeMB = this.currentFileSize / (1024 * 1024);
      
      logger.info(`Запис відео зупинено. Тривалість: ${duration.toFixed(2)} сек, розмір файлу: ${fileSizeMB.toFixed(2)} МБ`);
      
      this.isRecording = false;
      this.frameBuffer = [];
    } catch (error) {
      logger.error('Помилка при зупинці запису відео:', error);
    }
  }

  /**
   * Додавання нового кадру до запису
   * Буферизує кадри та періодично зберігає їх на диск
   * Контролює обмеження розміру та тривалості
   * @param frameBuffer Буфер з даними кадру в форматі JPEG
   */
  public addFrame(frameBuffer: Buffer): void {
    if (!this.isRecording || !this.config.enabled || !frameBuffer) {
      return;
    }
    
    try {
      const currentTime = Date.now();
      const timeSinceLastFrame = currentTime - this.lastSaveTime;
      
      // Перевіряємо, чи потрібно зберегти цей кадр за частотою
      if (timeSinceLastFrame >= this.frameInterval) {
        this.frameBuffer.push(frameBuffer);
        this.frameCount++;
        this.lastSaveTime = currentTime;
        
        // Розмір у гігабайтах
        const estimatedSize = this.currentFileSize + frameBuffer.length;
        const estimatedSizeGB = estimatedSize / (1024 * 1024 * 1024);
        
        // Тривалість запису у хвилинах
        const duration = (currentTime - this.recordingStartTime) / 1000 / 60;
        
        // Перевіряємо, чи не перевищили ми ліміти
        if (estimatedSizeGB >= this.config.maxSizeGB || 
            duration >= this.config.maxDurationMinutes) {
          
          // Зберігаємо поточні кадри
          this.flushFrameBuffer();
          
          // Починаємо новий файл
          this.stopRecording();
          this.startRecording();
        }
        
        // Якщо буфер великий, зберігаємо на диск
        if (this.frameBuffer.length >= 30) { // Зберігаємо кожні 30 кадрів або 5 секунд
          this.flushFrameBuffer();
        }
      }
    } catch (error) {
      logger.error('Помилка при додаванні кадру до запису:', error);
    }
  }

  /**
   * Зберігає накопичений буфер кадрів на диск
   * Викликається періодично та при завершенні запису
   * Оптимізує дискові операції шляхом об'єднання кадрів
   */
  private flushFrameBuffer(): void {
    if (this.frameBuffer.length === 0 || !this.currentFile) {
      return;
    }
    
    try {
      // Для простого RAW формату ми просто пишемо дані послідовно
      const bufferToSave = Buffer.concat(this.frameBuffer);
      fs.appendFileSync(this.currentFile, bufferToSave);
      
      this.currentFileSize += bufferToSave.length;
      const savedFrames = this.frameBuffer.length;
      this.frameBuffer = [];
      
      logger.debug(`Збережено ${savedFrames} кадрів, розмір: ${(bufferToSave.length / (1024 * 1024)).toFixed(2)} МБ`);
    } catch (error) {
      logger.error('Помилка при збереженні кадрів на диск:', error);
    }
  }

  /**
   * Створює директорію для збереження відео, якщо вона не існує
   * Забезпечує наявність місця для збереження записів
   */
  private ensureOutputDirectory(): void {
    try {
      if (!fs.existsSync(this.config.outputPath)) {
        fs.mkdirSync(this.config.outputPath, { recursive: true });
        logger.info(`Створено директорію для запису відео: ${this.config.outputPath}`);
      }
    } catch (error) {
      logger.error('Помилка при створенні директорії для запису відео:', error);
    }
  }

  /**
   * Повертає актуальну статистику процесу запису
   * @returns Об'єкт зі статистичними даними (тривалість, кількість кадрів, розмір, FPS)
   */
  public getRecordingStats(): Record<string, any> {
    const duration = this.isRecording 
      ? (Date.now() - this.recordingStartTime) / 1000 
      : 0;
    
    return {
      isRecording: this.isRecording,
      currentFile: this.currentFile,
      durationSeconds: duration,
      frameCount: this.frameCount,
      fileSizeMB: this.currentFileSize / (1024 * 1024),
      fps: this.frameCount / (duration || 1)
    };
  }
}

// Експортуємо готовий інстанс для використання у додатку
// Це дозволяє імпортувати його в інших модулях без створення нових екземплярів
export const videoRecorder = VideoRecorder.getInstance();
