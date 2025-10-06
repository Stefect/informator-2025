import mongoose from 'mongoose';
import { logger } from '../logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/capturestream';

export async function connectDatabase(): Promise<void> {
    try {
        await mongoose.connect(MONGODB_URI);
        
        logger.info('✅ MongoDB connected successfully', {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port
        });

        mongoose.connection.on('error', (error) => {
            logger.error('❌ MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('🔄 MongoDB reconnected');
        });

    } catch (error) {
        logger.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

export async function disconnectDatabase(): Promise<void> {
    try {
        await mongoose.disconnect();
        logger.info('👋 MongoDB disconnected gracefully');
    } catch (error) {
        logger.error('❌ Error disconnecting from MongoDB:', error);
    }
}
