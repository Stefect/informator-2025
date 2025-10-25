/**
 * Конфігурація Backend Server
 */

import * as dotenv from 'dotenv';
dotenv.config();

export interface Config {
    environment: 'development' | 'production';
    port: number;
    host: string;
    serveFrontend: boolean;
    recording: {
        enabled: boolean;
        path: string;
        maxFileSizeMB: number;
    };
    database: {
        enabled: boolean;
        uri: string;
    };
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const config: Config = {
    environment: (process.env.NODE_ENV as any) || 'development',
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    serveFrontend: process.env.SERVE_FRONTEND !== 'false',
    recording: {
        enabled: process.env.ENABLE_RECORDING === 'true',
        path: process.env.RECORDING_PATH || './recordings',
        maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '1000')
    },
    database: {
        enabled: process.env.ENABLE_DATABASE === 'true',
        uri: process.env.DATABASE_URI || 'mongodb://localhost:27017/informator'
    },
    logLevel: (process.env.LOG_LEVEL as any) || 'info'
};
