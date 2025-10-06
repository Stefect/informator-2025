import * as os from 'os';
import * as winston from 'winston';
import { config } from './config';

export interface PerformanceMetrics {
    timestamp: number;
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
        heapUsagePercent: number;
    };
    connections: {
        total: number;
        viewers: number;
        streamers: number;
    };
    frames: {
        totalReceived: number;
        totalSent: number;
        fps: number;
        droppedFrames: number;
    };
    network: {
        bytesReceived: number;
        bytesSent: number;
        bandwidth: string;
    };
}

export class PerformanceMonitor {
    private logger: winston.Logger;
    private startTime: number = Date.now();
    private lastMetrics: PerformanceMetrics | null = null;
    private metricsHistory: PerformanceMetrics[] = [];
    private maxHistorySize = 60; // Keep last 60 metrics (1 hour if interval is 60s)

    constructor(logger: winston.Logger) {
        this.logger = logger;
    }

    /**
     * Collect current metrics
     */
    public collectMetrics(
        connections: { total: number; viewers: number; streamers: number },
        frames: { received: number; sent: number; dropped: number },
        network: { received: number; sent: number }
    ): PerformanceMetrics {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const metrics: PerformanceMetrics = {
            timestamp: Date.now(),
            cpu: {
                usage: this.calculateCPUUsage(cpuUsage),
                loadAverage: os.loadavg()
            },
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                rss: memUsage.rss,
                external: memUsage.external,
                heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            connections,
            frames: {
                totalReceived: frames.received,
                totalSent: frames.sent,
                fps: this.calculateFPS(frames.received),
                droppedFrames: frames.dropped
            },
            network: {
                bytesReceived: network.received,
                bytesSent: network.sent,
                bandwidth: this.formatBandwidth(network.sent)
            }
        };

        // Store in history
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        this.lastMetrics = metrics;

        return metrics;
    }

    /**
     * Calculate CPU usage percentage
     */
    private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
        if (!this.lastMetrics) {
            return 0;
        }

        const totalTime = cpuUsage.user + cpuUsage.system;
        const elapsed = Date.now() - this.lastMetrics.timestamp;
        
        // CPU usage as percentage
        return Math.min(100, (totalTime / (elapsed * 1000)) * 100);
    }

    /**
     * Calculate FPS from frame count
     */
    private calculateFPS(totalFrames: number): number {
        if (!this.lastMetrics) {
            return 0;
        }

        const framesDiff = totalFrames - this.lastMetrics.frames.totalReceived;
        const timeDiff = (Date.now() - this.lastMetrics.timestamp) / 1000;

        return timeDiff > 0 ? Math.round(framesDiff / timeDiff) : 0;
    }

    /**
     * Format bandwidth for display
     */
    private formatBandwidth(bytes: number): string {
        if (!this.lastMetrics) {
            return '0 Kbps';
        }

        const bytesDiff = bytes - this.lastMetrics.network.bytesSent;
        const timeDiff = (Date.now() - this.lastMetrics.timestamp) / 1000;
        
        if (timeDiff === 0) {
            return '0 Kbps';
        }

        const bytesPerSecond = bytesDiff / timeDiff;
        const kbps = (bytesPerSecond * 8) / 1024;

        if (kbps > 1024) {
            return `${(kbps / 1024).toFixed(2)} Mbps`;
        }
        return `${kbps.toFixed(2)} Kbps`;
    }

    /**
     * Get health status
     */
    public getHealthStatus(): HealthStatus {
        if (!this.lastMetrics) {
            return {
                status: 'unknown',
                issues: ['No metrics available yet']
            };
        }

        const issues: string[] = [];
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        // Check memory
        if (this.lastMetrics.memory.heapUsagePercent > config.memory.maxHeapUsage) {
            issues.push(`High memory usage: ${this.lastMetrics.memory.heapUsagePercent.toFixed(1)}%`);
            status = 'degraded';
        }

        if (this.lastMetrics.memory.heapUsagePercent > 95) {
            status = 'unhealthy';
        }

        // Check CPU
        if (this.lastMetrics.cpu.usage > 80) {
            issues.push(`High CPU usage: ${this.lastMetrics.cpu.usage.toFixed(1)}%`);
            status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }

        // Check connections
        if (this.lastMetrics.connections.total > config.memory.maxClientConnections * 0.9) {
            issues.push(`High connection count: ${this.lastMetrics.connections.total}`);
            status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }

        // Check FPS
        if (this.lastMetrics.frames.fps < config.frames.minFPS && this.lastMetrics.connections.streamers > 0) {
            issues.push(`Low FPS: ${this.lastMetrics.frames.fps}`);
        }

        return { status, issues };
    }

    /**
     * Get uptime in seconds
     */
    public getUptime(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Get metrics history
     */
    public getHistory(): PerformanceMetrics[] {
        return [...this.metricsHistory];
    }

    /**
     * Get last metrics
     */
    public getLastMetrics(): PerformanceMetrics | null {
        return this.lastMetrics;
    }

    /**
     * Log metrics
     */
    public logMetrics(metrics: PerformanceMetrics): void {
        const health = this.getHealthStatus();

        this.logger.info('Performance Metrics', {
            uptime: this.getUptime(),
            cpu: `${metrics.cpu.usage.toFixed(1)}%`,
            memory: `${metrics.memory.heapUsagePercent.toFixed(1)}%`,
            connections: metrics.connections.total,
            fps: metrics.frames.fps,
            bandwidth: metrics.network.bandwidth,
            health: health.status
        });

        if (health.issues.length > 0) {
            this.logger.warn('Performance issues detected', { issues: health.issues });
        }
    }

    /**
     * Force garbage collection if needed
     */
    public forceGCIfNeeded(): boolean {
        if (!this.lastMetrics) {
            return false;
        }

        if (this.lastMetrics.memory.heapUsagePercent > config.memory.maxHeapUsage) {
            if (global.gc) {
                this.logger.info('Forcing garbage collection...');
                global.gc();
                return true;
            } else {
                this.logger.warn('Garbage collection not available. Start with --expose-gc flag.');
            }
        }

        return false;
    }
}

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    issues: string[];
}

export default PerformanceMonitor;
