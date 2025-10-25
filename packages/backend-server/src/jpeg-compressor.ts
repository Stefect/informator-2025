/**
 * JPEG Frame Compressor для Backend
 * Стискає BGRA RAW -> JPEG для зменшення трафіку
 * Простіша альтернатива H.264 (не потребує FFmpeg)
 */

import sharp from 'sharp';
import { logger } from './logger';

export interface CompressorConfig {
    quality: number; // 1-100
    chroma: '4:4:4' | '4:2:0';
}

export class JPEGCompressor {
    private config: CompressorConfig;
    private frameCount = 0;

    constructor(config: CompressorConfig = { quality: 80, chroma: '4:2:0' }) {
        this.config = config;
        logger.info(`🗜️ JPEG Compressor ініціалізовано (quality: ${config.quality})`);
    }

    async compress(bgraBuffer: Buffer, width: number, height: number): Promise<Buffer> {
        try {
            this.frameCount++;

            // BGRA формат потребує конвертації:
            // 1. Поміняти R ↔ B (BGRA → RGBA)
            // 2. Видалити Alpha (RGBA → RGB)
            this.swapRedBlue(bgraBuffer);

            // Тепер у нас RGBA, Sharp може конвертувати в JPEG
            const jpegBuffer = await sharp(bgraBuffer, {
                raw: {
                    width,
                    height,
                    channels: 4 // RGBA = 4 channels
                }
            })
            .removeAlpha() // RGBA -> RGB
            .jpeg({
                quality: this.config.quality,
                chromaSubsampling: this.config.chroma,
                force: true,
                progressive: false, // Базовий JPEG для швидкості
                optimiseCoding: false // Швидше кодування
            })
            .toBuffer();

            const compressionRatio = ((1 - jpegBuffer.length / bgraBuffer.length) * 100).toFixed(1);
            
            if (this.frameCount % 50 === 0) {
                logger.info(
                    `🗜️ Кадр #${this.frameCount}: ${(bgraBuffer.length / 1024).toFixed(0)} KB → ` +
                    `${(jpegBuffer.length / 1024).toFixed(0)} KB (${compressionRatio}% стиснення)`
                );
            }

            return jpegBuffer;
        } catch (error) {
            logger.error('❌ Помилка JPEG стиснення:', error);
            throw error;
        }
    }

    /**
     * Поміняти червоний та синій канали (BGRA → RGBA)
     * Виконується in-place для швидкості
     */
    private swapRedBlue(buffer: Buffer): void {
        for (let i = 0; i < buffer.length; i += 4) {
            const temp = buffer[i];     // B
            buffer[i] = buffer[i + 2];  // B ← R
            buffer[i + 2] = temp;       // R ← B
            // G та A залишаються без змін
        }
    }

    getFrameCount(): number {
        return this.frameCount;
    }

    // Розрахувати очікуваний трафік
    static calculateBitrate(width: number, height: number, fps: number, quality: number): number {
        // Орієнтовний розмір JPEG кадру (залежить від якості та складності зображення)
        // Quality 80, 1280x720 ≈ 50-100 KB на кадр
        const avgFrameSizeKB = (width * height / 10000) * (quality / 100);
        const bitrateKbps = avgFrameSizeKB * fps * 8; // KB/s * 8 = Kbps
        return bitrateKbps;
    }
}
