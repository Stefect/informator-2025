import { config } from './config';

/**
 * Optimized Frame Buffer Manager
 * Manages frame buffering with automatic cleanup and memory optimization
 */
export class FrameBufferManager {
    private buffers: Map<string, Buffer[]> = new Map();
    private timestamps: Map<string, number[]> = new Map();
    private stats: Map<string, FrameStats> = new Map();

    constructor(
        private maxBufferSize: number = config.frames.maxBufferSize,
        private dropOldFrames: boolean = config.frames.dropOldFrames
    ) {
        // Periodic cleanup
        setInterval(() => this.cleanup(), config.memory.cleanupInterval);
    }

    /**
     * Add frame to buffer
     */
    public addFrame(clientId: string, frame: Buffer): boolean {
        let buffer = this.buffers.get(clientId);
        let timestamps = this.timestamps.get(clientId);

        if (!buffer) {
            buffer = [];
            timestamps = [];
            this.buffers.set(clientId, buffer);
            this.timestamps.set(clientId, timestamps);
            this.stats.set(clientId, {
                framesAdded: 0,
                framesDropped: 0,
                bytesStored: 0,
                avgFrameSize: 0
            });
        }

        const stats = this.stats.get(clientId)!;

        // Check buffer size
        if (buffer.length >= this.maxBufferSize) {
            if (this.dropOldFrames) {
                // Drop oldest frame
                const droppedFrame = buffer.shift();
                timestamps!.shift();
                stats.framesDropped++;
                
                if (droppedFrame) {
                    stats.bytesStored -= droppedFrame.length;
                }
            } else {
                // Buffer full, reject new frame
                stats.framesDropped++;
                return false;
            }
        }

        // Add new frame
        buffer.push(frame);
        timestamps!.push(Date.now());
        
        stats.framesAdded++;
        stats.bytesStored += frame.length;
        stats.avgFrameSize = Math.floor(stats.bytesStored / buffer.length);

        return true;
    }

    /**
     * Get frame from buffer (FIFO)
     */
    public getFrame(clientId: string): Buffer | null {
        const buffer = this.buffers.get(clientId);
        const timestamps = this.timestamps.get(clientId);

        if (!buffer || buffer.length === 0) {
            return null;
        }

        const frame = buffer.shift();
        timestamps?.shift();

        if (frame) {
            const stats = this.stats.get(clientId);
            if (stats) {
                stats.bytesStored -= frame.length;
            }
        }

        return frame || null;
    }

    /**
     * Get all frames and clear buffer
     */
    public getAllFrames(clientId: string): Buffer[] {
        const buffer = this.buffers.get(clientId);
        
        if (!buffer) {
            return [];
        }

        const frames = [...buffer];
        
        // Clear buffer
        buffer.length = 0;
        this.timestamps.get(clientId)?.splice(0);
        
        const stats = this.stats.get(clientId);
        if (stats) {
            stats.bytesStored = 0;
        }

        return frames;
    }

    /**
     * Get buffer size
     */
    public getBufferSize(clientId: string): number {
        return this.buffers.get(clientId)?.length || 0;
    }

    /**
     * Get buffer stats
     */
    public getStats(clientId: string): FrameStats | null {
        return this.stats.get(clientId) || null;
    }

    /**
     * Calculate FPS for client
     */
    public calculateFPS(clientId: string): number {
        const timestamps = this.timestamps.get(clientId);
        
        if (!timestamps || timestamps.length < 2) {
            return 0;
        }

        const now = Date.now();
        const oneSecondAgo = now - 1000;
        
        const recentFrames = timestamps.filter(t => t > oneSecondAgo);
        
        return recentFrames.length;
    }

    /**
     * Clear buffer for client
     */
    public clearBuffer(clientId: string): void {
        this.buffers.delete(clientId);
        this.timestamps.delete(clientId);
        this.stats.delete(clientId);
    }

    /**
     * Cleanup old data
     */
    private cleanup(): void {
        const now = Date.now();
        const maxAge = 60000; // 1 minute

        for (const [clientId, timestamps] of this.timestamps.entries()) {
            if (timestamps.length === 0) {
                continue;
            }

            const lastTimestamp = timestamps[timestamps.length - 1];
            
            if (now - lastTimestamp > maxAge) {
                // Client inactive, clear buffer
                this.clearBuffer(clientId);
            }
        }
    }

    /**
     * Get total memory usage
     */
    public getTotalMemoryUsage(): number {
        let total = 0;
        
        for (const stats of this.stats.values()) {
            total += stats.bytesStored;
        }

        return total;
    }

    /**
     * Get all stats
     */
    public getAllStats(): Map<string, FrameStats> {
        return new Map(this.stats);
    }
}

interface FrameStats {
    framesAdded: number;
    framesDropped: number;
    bytesStored: number;
    avgFrameSize: number;
}

export default FrameBufferManager;
