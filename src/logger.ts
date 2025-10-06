import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Кольори для різних рівнів
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Формат для консолі з емодзі
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        
        // Додаємо метадані якщо вони є
        if (Object.keys(metadata).length > 0) {
            msg += `\n${JSON.stringify(metadata, null, 2)}`;
        }
        
        return msg;
    })
);

// Формат для файлів JSON
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Створюємо директорію для логів
const logsDir = path.join(process.cwd(), 'logs');

// Транспорт для всіх логів (ротація щодня)
const allLogsTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
    level: 'info'
});

// Транспорт для помилок
const errorLogsTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: fileFormat,
    level: 'error'
});

// Транспорт для debug логів (тільки у development)
const debugLogsTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'debug-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: fileFormat,
    level: 'debug'
});

// Транспорт для RTMP подій
const rtmpLogsTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'rtmp-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: fileFormat
});

// Транспорт для WebSocket подій
const websocketLogsTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'websocket-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: fileFormat
});

// Основний logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        allLogsTransport,
        errorLogsTransport
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log') 
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'rejections.log') 
        })
    ]
});

// Logger для debug режиму
if (process.env.NODE_ENV === 'development') {
    logger.add(debugLogsTransport);
    logger.level = 'debug';
}

// Спеціалізовані logger'и
export const rtmpLogger = winston.createLogger({
    level: 'info',
    format: fileFormat,
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        rtmpLogsTransport
    ]
});

export const websocketLogger = winston.createLogger({
    level: 'info',
    format: fileFormat,
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        websocketLogsTransport
    ]
});

// Хелпер функції для логування з емодзі
export const log = {
    // Старт/Стоп
    start: (message: string, metadata?: any) => 
        logger.info(`🚀 ${message}`, metadata),
    stop: (message: string, metadata?: any) => 
        logger.info(`🛑 ${message}`, metadata),
    
    // Успіх/Помилка
    success: (message: string, metadata?: any) => 
        logger.info(`✅ ${message}`, metadata),
    error: (message: string, metadata?: any) => 
        logger.error(`❌ ${message}`, metadata),
    
    // Попередження
    warn: (message: string, metadata?: any) => 
        logger.warn(`⚠️ ${message}`, metadata),
    
    // Інформація
    info: (message: string, metadata?: any) => 
        logger.info(`ℹ️ ${message}`, metadata),
    
    // Debug
    debug: (message: string, metadata?: any) => 
        logger.debug(`🔍 ${message}`, metadata),
    
    // Мережа
    connect: (message: string, metadata?: any) => 
        logger.info(`🔌 ${message}`, metadata),
    disconnect: (message: string, metadata?: any) => 
        logger.info(`🔌❌ ${message}`, metadata),
    
    // Стріми
    streamStart: (message: string, metadata?: any) => 
        logger.info(`📡 ${message}`, metadata),
    streamEnd: (message: string, metadata?: any) => 
        logger.info(`📡✓ ${message}`, metadata),
    
    // База даних
    dbConnect: (message: string, metadata?: any) => 
        logger.info(`💾 ${message}`, metadata),
    dbQuery: (message: string, metadata?: any) => 
        logger.debug(`🔎 ${message}`, metadata),
    
    // Продуктивність
    performance: (message: string, metadata?: any) => 
        logger.info(`⚡ ${message}`, metadata),
    
    // Файли
    fileWrite: (message: string, metadata?: any) => 
        logger.info(`💾 ${message}`, metadata),
    fileRead: (message: string, metadata?: any) => 
        logger.debug(`📖 ${message}`, metadata)
};

// Middleware для Express (опціонально)
export const requestLogger = (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
        
        logger.http(`${statusEmoji} ${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });
    
    next();
};

export default logger;
