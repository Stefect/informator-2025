import * as fs from 'fs';
import * as os from 'os';

/**
 * Отримання використання CPU
 */
export async function getCPUUsage(): Promise<number> {
    return os.loadavg()[0] * 100;
}

/**
 * Логування подій
 */
export function logEvent(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

/**
 * Збереження конфігурації
 */
export function saveConfig(config: any): void {
    try {
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        logEvent('Конфігурацію збережено');
    } catch (error) {
        logEvent('Помилка збереження конфігурації:', 'error');
    }
}

/**
 * Завантаження конфігурації
 */
export function loadConfig(): any {
    try {
        if (fs.existsSync('config.json')) {
            const data = fs.readFileSync('config.json', 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        logEvent('Помилка завантаження конфігурації:', 'error');
    }
    return null;
}

/**
 * Примусовий збір сміття
 */
export function forceGarbageCollection(): void {
    try {
        if (global.gc) {
            // Запускаємо GC двічі для більш ефективного очищення пам'яті
            global.gc();
            
            // Очищення пам'яті Node.js
            const memBefore = process.memoryUsage().heapUsed;
            global.gc();
            const memAfter = process.memoryUsage().heapUsed;
            
            // Логуємо результат очищення
            const freedMB = (memBefore - memAfter) / (1024 * 1024);
            if (freedMB > 1) {
                logEvent(`Звільнено пам'яті: ${freedMB.toFixed(2)} MB`);
            }
        } else {
            // Node.js потрібно запустити з опцією --expose-gc для роботи garbage collector
            logEvent('Garbage collection недоступний. Запустіть Node.js з опцією --expose-gc', 'warn');
        }
    } catch (error) {
        logEvent('Помилка при спробі очищення пам\'яті:', 'error');
    }
}

/**
 * Отримання деталізованої інформації про використання пам'яті
 */
export function getMemoryUsageDetails(): { 
    heapUsed: number, 
    heapTotal: number, 
    rss: number, 
    external: number, 
    arrayBuffers: number 
} {
    const memoryUsage = process.memoryUsage();
    return {
        heapUsed: memoryUsage.heapUsed / (1024 * 1024), // MB
        heapTotal: memoryUsage.heapTotal / (1024 * 1024), // MB
        rss: memoryUsage.rss / (1024 * 1024), // MB
        external: (memoryUsage as any).external / (1024 * 1024), // MB
        arrayBuffers: (memoryUsage as any).arrayBuffers / (1024 * 1024) // MB
    };
}

/**
 * Розширений моніторинг використання CPU
 */
export async function getDetailedCPUUsage(): Promise<{ 
    systemLoad: number, 
    processLoad: number, 
    cores: number 
}> {
    // Отримуємо загальне навантаження системи
    const systemLoad = os.loadavg()[0] * 100 / os.cpus().length;
    
    // Кількість ядер CPU
    const cores = os.cpus().length;
    
    // Спрощене обчислення навантаження процесу
    // (у реальному проекті можна використати більш точні метрики з process.cpuUsage())
    const processLoad = Math.min(systemLoad, 100);
    
    return {
        systemLoad: parseFloat(systemLoad.toFixed(2)),
        processLoad: parseFloat(processLoad.toFixed(2)),
        cores
    };
}

/**
 * Моніторинг мережевого трафіку
 */
export function monitorNetworkTraffic(bytesSent: number, interval: number = 1000): {
    bytesPerSecond: number,
    mbitsPerSecond: number
} {
    const bytesPerSecond = bytesSent * (1000 / interval);
    const mbitsPerSecond = (bytesPerSecond * 8) / (1024 * 1024);
    
    return {
        bytesPerSecond,
        mbitsPerSecond: parseFloat(mbitsPerSecond.toFixed(2))
    };
}

/**
 * Перевірка обмежень на використання ресурсів
 */
export function checkResourceLimits(memoryMB: number, networkMbps: number, cpuPercent: number): {
    memoryOk: boolean,
    networkOk: boolean,
    cpuOk: boolean,
    status: string
} {
    const memoryLimit = 500; // MB
    const networkLimit = 10; // Mbps
    const cpuLimit = 80; // %
    
    const memoryOk = memoryMB < memoryLimit;
    const networkOk = networkMbps < networkLimit;
    const cpuOk = cpuPercent < cpuLimit;
    
    let status = 'ok';
    if (!memoryOk || !networkOk || !cpuOk) {
        status = 'warning';
    }
    
    return {
        memoryOk,
        networkOk,
        cpuOk,
        status
    };
}