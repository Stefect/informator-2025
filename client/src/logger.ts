import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Інтерфейс для налаштування логування
 */
export interface LoggerConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  console: boolean;
  file: boolean;
  filePath: string;
  maxFileSize: number; // в байтах
  maxFiles: number;
}

/**
 * Типи повідомлень логу
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Клас для управління логуванням програми
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private currentLogFile: string;
  private currentFileSize: number = 0;

  /**
   * Конструктор класу Logger
   */
  private constructor() {
    this.config = {
      enabled: true,
      level: 'info',
      console: true,
      file: true,
      filePath: path.join(process.cwd(), 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10 МБ
      maxFiles: 5
    };
    
    this.currentLogFile = '';
    this.ensureLogDirectory();
    this.rotateLogFileIfNeeded();
  }

  /**
   * Отримання єдиного екземпляру класу (Singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Налаштування логера
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.ensureLogDirectory();
    this.rotateLogFileIfNeeded();
  }

  /**
   * Запис debug повідомлення
   */
  public debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Запис info повідомлення
   */
  public info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Запис warning повідомлення
   */
  public warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Запис error повідомлення
   */
  public error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Логування виключення
   */
  public exception(error: Error, context?: string): void {
    const message = context 
      ? `Помилка в ${context}: ${error.message}`
      : `Помилка: ${error.message}`;
    
    this.error(message);
    
    if (error.stack) {
      this.error(error.stack);
    }
  }

  /**
   * Логування метрик системи
   */
  public metrics(metrics: Record<string, any>): void {
    this.info('Метрики системи', metrics);
  }

  /**
   * Базова функція логування
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.config.enabled) return;
    
    // Перевірка рівня логу
    const levels: { [key: string]: number } = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    
    if (levels[level] < levels[this.config.level]) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(timestamp, level, message, args);
    
    // Вивід у консоль
    if (this.config.console) {
      this.logToConsole(level, formattedMessage);
    }
    
    // Запис у файл
    if (this.config.file) {
      this.logToFile(formattedMessage);
    }
  }

  /**
   * Форматування повідомлення логу
   */
  private formatMessage(timestamp: string, level: string, message: string, args: any[]): string {
    const hostname = os.hostname();
    const pid = process.pid;
    
    let formattedArgs = '';
    if (args.length > 0) {
      formattedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
    }
    
    return `[${timestamp}] [${level.toUpperCase()}] [${hostname}] [${pid}] ${message} ${formattedArgs}`.trim();
  }

  /**
   * Вивід повідомлення в консоль
   */
  private logToConsole(level: string, message: string): void {
    switch (level) {
      case 'debug':
      case 'info':
        console.log(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }

  /**
   * Запис повідомлення у файл
   */
  private logToFile(message: string): void {
    try {
      if (!this.currentLogFile) {
        this.rotateLogFileIfNeeded();
      }
      
      const data = message + '\n';
      fs.appendFileSync(this.currentLogFile, data);
      this.currentFileSize += Buffer.byteLength(data);
      
      if (this.currentFileSize >= this.config.maxFileSize) {
        this.rotateLogFileIfNeeded(true);
      }
    } catch (error) {
      console.error('Помилка запису в лог-файл:', error);
    }
  }

  /**
   * Переконатися, що директорія для логів існує
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.config.filePath)) {
        fs.mkdirSync(this.config.filePath, { recursive: true });
      }
    } catch (error) {
      console.error('Помилка створення директорії для логів:', error);
    }
  }

  /**
   * Ротація лог-файлів
   */
  private rotateLogFileIfNeeded(forceRotate: boolean = false): void {
    try {
      if (!this.config.file) return;
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const newLogFile = path.join(
        this.config.filePath,
        `screen-capture-${dateStr}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.log`
      );
      
      if (forceRotate || !this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
        // Створюємо новий лог-файл
        this.currentLogFile = newLogFile;
        this.currentFileSize = 0;
        
        // Видаляємо застарілі файли
        this.cleanupOldLogFiles();
      }
    } catch (error) {
      console.error('Помилка ротації лог-файлів:', error);
    }
  }

  /**
   * Очищення старих лог-файлів
   */
  private cleanupOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.config.filePath)
        .filter(file => file.startsWith('screen-capture-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.filePath, file),
          time: fs.statSync(path.join(this.config.filePath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Сортування від новіших до старіших
      
      // Залишаємо тільки N найновіших файлів
      if (files.length > this.config.maxFiles) {
        const filesToDelete = files.slice(this.config.maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`Видалено старий лог-файл: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Помилка очищення старих лог-файлів:', error);
    }
  }
}

// Експортуємо екземпляр для використання в додатку
export const logger = Logger.getInstance();
