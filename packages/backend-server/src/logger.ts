/**
 * Логер для Backend Server
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private logLevel: LogLevel = LogLevel.INFO;
    private logFile?: fs.WriteStream;

    constructor() {
        const logDir = './logs';
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logPath = path.join(logDir, `backend-server-${this.getTimestamp()}.log`);
        this.logFile = fs.createWriteStream(logPath, { flags: 'a' });
    }

    private getTimestamp(): string {
        return new Date().toISOString().replace(/:/g, '-').split('.')[0];
    }

    private getFormattedTimestamp(): string {
        return new Date().toISOString();
    }

    private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
        if (level < this.logLevel) return;

        const timestamp = this.getFormattedTimestamp();
        const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
        
        console.log(formattedMessage, ...args);
        
        if (this.logFile) {
            const logLine = args.length > 0 
                ? `${formattedMessage} ${JSON.stringify(args)}\n`
                : `${formattedMessage}\n`;
            this.logFile.write(logLine);
        }
    }

    public setLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    public debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
    }

    public info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, 'INFO', message, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, 'WARN', message, ...args);
    }

    public error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, 'ERROR', message, ...args);
    }

    public close(): void {
        if (this.logFile) {
            this.logFile.end();
        }
    }
}

export const logger = new Logger();
