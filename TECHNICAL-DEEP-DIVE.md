# 📋 ТЕХНІЧНА СПЕЦИФІКАЦІЯ ПРОЕКТУ INFORMATOR

## 🎯 ОГЛЯД ПРОЕКТУ ДЛЯ ВИКЛАДАЧА

### Назва проекту: **Informator - Professional Screen Capture System**
### Студент: [Ваше ім'я]
### Дата захисту: Жовтень 2025
### Репозиторій: https://github.com/Stefect/informator-2025

---

## 🔬 ДЕТАЛЬНИЙ ТЕХНІЧНИЙ АНАЛІЗ

### 1. АРХІТЕКТУРНІ ПАТТЕРНИ

#### **Model-View-Controller (MVC)**
```
Model (Дані):
├── CaptureSession - Стан сесії захоплення
├── ClientConnection - Дані про підключення
├── PerformanceMetrics - Метрики продуктивності
└── CaptureConfig - Конфігурація системи

View (Інтерфейс):
├── Web Interface (HTML/CSS/JS)
├── CLI Interface (Capture Client)
└── API Responses (JSON)

Controller (Логіка):
├── InformatorServer - Головний контролер
├── ConnectionManager - Управління з'єднаннями
├── SessionManager - Управління сесіями
└── CaptureController - Управління захопленням
```

#### **Publisher-Subscriber Pattern**
```typescript
// Event-driven архітектура
class EventEmitter {
    private events = new Map<string, Function[]>();
    
    on(event: string, callback: Function): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }
    
    emit(event: string, data: any): void {
        const callbacks = this.events.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
}

// Використання:
server.on('client_connected', (client) => {
    logger.info('New client connected', client.id);
    metricsCollector.incrementConnections();
});
```

### 2. АЛГОРИТМИ ТА СТРУКТУРИ ДАНИХ

#### **Circular Buffer для Frame Management**
```typescript
class CircularFrameBuffer {
    private buffer: Buffer[];
    private head = 0;
    private tail = 0;
    private size: number;
    
    constructor(capacity: number) {
        this.buffer = new Array(capacity);
        this.size = capacity;
    }
    
    push(frame: Buffer): void {
        this.buffer[this.head] = frame;
        this.head = (this.head + 1) % this.size;
        
        if (this.head === this.tail) {
            this.tail = (this.tail + 1) % this.size; // Перезапис старих даних
        }
    }
    
    getLatest(): Buffer | null {
        if (this.isEmpty()) return null;
        const index = (this.head - 1 + this.size) % this.size;
        return this.buffer[index];
    }
}
```

#### **Priority Queue для Message Processing**
```typescript
interface Message {
    type: string;
    priority: number;
    data: any;
    timestamp: number;
}

class PriorityMessageQueue {
    private heap: Message[] = [];
    
    enqueue(message: Message): void {
        this.heap.push(message);
        this.bubbleUp(this.heap.length - 1);
    }
    
    dequeue(): Message | null {
        if (this.heap.length === 0) return null;
        
        const result = this.heap[0];
        const end = this.heap.pop()!;
        
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.bubbleDown(0);
        }
        
        return result;
    }
    
    private bubbleUp(index: number): void {
        const element = this.heap[index];
        
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.heap[parentIndex];
            
            if (element.priority <= parent.priority) break;
            
            this.heap[index] = parent;
            index = parentIndex;
        }
        
        this.heap[index] = element;
    }
    
    private bubbleDown(index: number): void {
        const length = this.heap.length;
        const element = this.heap[index];
        
        while (true) {
            const leftChildIndex = 2 * index + 1;
            const rightChildIndex = 2 * index + 2;
            let swap = null;
            
            if (leftChildIndex < length) {
                const leftChild = this.heap[leftChildIndex];
                if (leftChild.priority > element.priority) {
                    swap = leftChildIndex;
                }
            }
            
            if (rightChildIndex < length) {
                const rightChild = this.heap[rightChildIndex];
                if (rightChild.priority > (swap === null ? element : this.heap[swap]).priority) {
                    swap = rightChildIndex;
                }
            }
            
            if (swap === null) break;
            
            this.heap[index] = this.heap[swap];
            index = swap;
        }
        
        this.heap[index] = element;
    }
}
```

### 3. ПАРАЛЕЛІЗМ ТА АСИНХРОННІСТЬ

#### **Worker Thread Pool для Compression**
```typescript
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

class CompressionWorkerPool {
    private workers: Worker[] = [];
    private taskQueue: any[] = [];
    private busyWorkers = new Set<Worker>();
    
    constructor(private poolSize: number = 4) {
        this.initializeWorkers();
    }
    
    private initializeWorkers(): void {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(__filename, {
                workerData: { isCompressionWorker: true }
            });
            
            worker.on('message', (result) => {
                this.busyWorkers.delete(worker);
                this.processTaskQueue();
                // Handle result
            });
            
            this.workers.push(worker);
        }
    }
    
    compressFrame(frameData: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const task = { frameData, resolve, reject };
            this.taskQueue.push(task);
            this.processTaskQueue();
        });
    }
    
    private processTaskQueue(): void {
        if (this.taskQueue.length === 0) return;
        
        const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
        if (!availableWorker) return;
        
        const task = this.taskQueue.shift();
        this.busyWorkers.add(availableWorker);
        
        availableWorker.postMessage({
            type: 'compress',
            data: task.frameData
        });
    }
}

// Worker thread code
if (!isMainThread && workerData?.isCompressionWorker) {
    parentPort?.on('message', ({ type, data }) => {
        if (type === 'compress') {
            // Compression logic here
            const compressed = compressFrame(data);
            parentPort?.postMessage(compressed);
        }
    });
}
```

#### **Async Iterator для Stream Processing**
```typescript
class FrameStreamProcessor {
    async* processFrameStream(): AsyncIterableIterator<ProcessedFrame> {
        while (this.isCapturing) {
            try {
                const rawFrame = await this.captureFrame();
                
                if (rawFrame) {
                    const processed = await this.processFrame(rawFrame);
                    yield processed;
                }
                
                // Adaptive delay based on target FPS
                const delay = 1000 / this.targetFPS;
                await this.sleep(delay);
                
            } catch (error) {
                this.handleError(error);
                continue;
            }
        }
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage:
const processor = new FrameStreamProcessor();
for await (const frame of processor.processFrameStream()) {
    await this.transmitFrame(frame);
}
```

### 4. БЕЗПЕКА ТА КРИПТОГРАФІЯ

#### **JWT Token Authentication (Підготовлено)**
```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

class SecurityManager {
    private secretKey = crypto.randomBytes(64).toString('hex');
    
    generateToken(clientId: string): string {
        const payload = {
            clientId,
            iat: Date.now(),
            exp: Date.now() + (24 * 60 * 60 * 1000) // 24 години
        };
        
        return jwt.sign(payload, this.secretKey);
    }
    
    verifyToken(token: string): any {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
    
    // Rate limiting implementation
    private clientRequestCounts = new Map<string, number[]>();
    
    checkRateLimit(clientId: string, maxRequests = 100, windowMs = 60000): boolean {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!this.clientRequestCounts.has(clientId)) {
            this.clientRequestCounts.set(clientId, []);
        }
        
        const requests = this.clientRequestCounts.get(clientId)!;
        
        // Remove old requests outside the window
        const validRequests = requests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
            return false; // Rate limit exceeded
        }
        
        validRequests.push(now);
        this.clientRequestCounts.set(clientId, validRequests);
        
        return true;
    }
}
```

#### **Data Encryption для Sensitive Information**
```typescript
import crypto from 'crypto';

class DataEncryption {
    private algorithm = 'aes-256-gcm';
    private secretKey = crypto.scryptSync('password', 'salt', 32);
    
    encrypt(text: string): { encrypted: string; iv: string; tag: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.algorithm, this.secretKey, { iv });
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex')
        };
    }
    
    decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const tag = Buffer.from(encryptedData.tag, 'hex');
        
        const decipher = crypto.createDecipher(this.algorithm, this.secretKey, { iv });
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}
```

### 5. ОПТИМІЗАЦІЯ ПРОДУКТИВНОСТІ

#### **Memory Pool для Buffer Management**
```typescript
class BufferPool {
    private availableBuffers: Buffer[] = [];
    private usedBuffers = new Set<Buffer>();
    private bufferSize: number;
    private maxPoolSize: number;
    
    constructor(bufferSize: number, initialPoolSize = 10, maxPoolSize = 50) {
        this.bufferSize = bufferSize;
        this.maxPoolSize = maxPoolSize;
        
        // Pre-allocate buffers
        for (let i = 0; i < initialPoolSize; i++) {
            this.availableBuffers.push(Buffer.alloc(bufferSize));
        }
    }
    
    acquire(): Buffer {
        let buffer = this.availableBuffers.pop();
        
        if (!buffer) {
            buffer = Buffer.alloc(this.bufferSize);
        }
        
        this.usedBuffers.add(buffer);
        return buffer;
    }
    
    release(buffer: Buffer): void {
        if (this.usedBuffers.has(buffer)) {
            this.usedBuffers.delete(buffer);
            
            if (this.availableBuffers.length < this.maxPoolSize) {
                buffer.fill(0); // Clear buffer
                this.availableBuffers.push(buffer);
            }
            // If pool is full, let GC handle the buffer
        }
    }
    
    getStats() {
        return {
            available: this.availableBuffers.length,
            used: this.usedBuffers.size,
            total: this.availableBuffers.length + this.usedBuffers.size
        };
    }
}
```

#### **Adaptive Quality Control Algorithm**
```typescript
class AdaptiveQualityController {
    private qualityHistory: number[] = [];
    private latencyHistory: number[] = [];
    private currentQuality = 75;
    private targetLatency = 50; // ms
    private historySize = 10;
    
    adjustQuality(latency: number, bandwidth: number): number {
        this.latencyHistory.push(latency);
        this.qualityHistory.push(this.currentQuality);
        
        // Keep only recent history
        if (this.latencyHistory.length > this.historySize) {
            this.latencyHistory.shift();
            this.qualityHistory.shift();
        }
        
        const avgLatency = this.average(this.latencyHistory);
        const latencyTrend = this.calculateTrend(this.latencyHistory);
        
        let adjustment = 0;
        
        // If latency is increasing and above target
        if (avgLatency > this.targetLatency && latencyTrend > 0) {
            adjustment = -Math.ceil(avgLatency / this.targetLatency * 5);
        }
        // If latency is decreasing and below target
        else if (avgLatency < this.targetLatency && latencyTrend < 0) {
            adjustment = Math.ceil(this.targetLatency / avgLatency * 3);
        }
        
        // Consider bandwidth
        if (bandwidth < 1000000) { // Less than 1 Mbps
            adjustment -= 10;
        }
        
        this.currentQuality = Math.max(30, Math.min(95, this.currentQuality + adjustment));
        
        return this.currentQuality;
    }
    
    private average(arr: number[]): number {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    private calculateTrend(arr: number[]): number {
        if (arr.length < 2) return 0;
        
        let trend = 0;
        for (let i = 1; i < arr.length; i++) {
            trend += arr[i] - arr[i - 1];
        }
        
        return trend / (arr.length - 1);
    }
}
```

### 6. МЕТРИКИ ТА ПРОФІЛЮВАННЯ

#### **Performance Profiler**
```typescript
class PerformanceProfiler {
    private timers = new Map<string, number>();
    private counters = new Map<string, number>();
    private gauges = new Map<string, number>();
    private histograms = new Map<string, number[]>();
    
    startTimer(name: string): void {
        this.timers.set(name, performance.now());
    }
    
    endTimer(name: string): number {
        const startTime = this.timers.get(name);
        if (!startTime) throw new Error(`Timer ${name} not found`);
        
        const duration = performance.now() - startTime;
        this.timers.delete(name);
        
        // Store in histogram
        if (!this.histograms.has(name)) {
            this.histograms.set(name, []);
        }
        this.histograms.get(name)!.push(duration);
        
        return duration;
    }
    
    incrementCounter(name: string, value = 1): void {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }
    
    setGauge(name: string, value: number): void {
        this.gauges.set(name, value);
    }
    
    getMetrics(): any {
        const metrics: any = {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: {}
        };
        
        // Calculate histogram statistics
        for (const [name, values] of this.histograms) {
            if (values.length > 0) {
                const sorted = [...values].sort((a, b) => a - b);
                metrics.histograms[name] = {
                    count: values.length,
                    min: sorted[0],
                    max: sorted[sorted.length - 1],
                    mean: values.reduce((a, b) => a + b, 0) / values.length,
                    p50: sorted[Math.floor(sorted.length * 0.5)],
                    p95: sorted[Math.floor(sorted.length * 0.95)],
                    p99: sorted[Math.floor(sorted.length * 0.99)]
                };
            }
        }
        
        return metrics;
    }
    
    // Decorator для автоматичного profiling
    static profile(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = function(...args: any[]) {
            const profiler = this.profiler || new PerformanceProfiler();
            const timerName = `${target.constructor.name}.${propertyKey}`;
            
            profiler.startTimer(timerName);
            
            try {
                const result = originalMethod.apply(this, args);
                
                if (result instanceof Promise) {
                    return result.finally(() => {
                        profiler.endTimer(timerName);
                    });
                } else {
                    profiler.endTimer(timerName);
                    return result;
                }
            } catch (error) {
                profiler.endTimer(timerName);
                throw error;
            }
        };
        
        return descriptor;
    }
}

// Usage with decorator:
class CaptureService {
    private profiler = new PerformanceProfiler();
    
    @PerformanceProfiler.profile
    async captureFrame(): Promise<Buffer> {
        // Method implementation
        return Buffer.alloc(1024);
    }
}
```

### 7. ERROR HANDLING ТА RECOVERY

#### **Circuit Breaker Pattern**
```typescript
enum CircuitState {
    CLOSED,    // Normal operation
    OPEN,      // Circuit breaker triggered
    HALF_OPEN  // Testing if service recovered
}

class CircuitBreaker {
    private state = CircuitState.CLOSED;
    private failureCount = 0;
    private lastFailureTime = 0;
    private timeout = 60000; // 1 minute
    private threshold = 5;   // failures before opening
    
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = CircuitState.HALF_OPEN;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await operation();
            
            if (this.state === CircuitState.HALF_OPEN) {
                this.reset();
            }
            
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    
    private recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = CircuitState.OPEN;
        }
    }
    
    private reset(): void {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
    }
}
```

#### **Retry Mechanism with Exponential Backoff**
```typescript
class RetryManager {
    static async withRetry<T>(
        operation: () => Promise<T>,
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Exponential backoff with jitter
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                    maxDelay
                );
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError!;
    }
}

// Usage:
const captureFrame = () => RetryManager.withRetry(
    () => this.nativeCapture.captureScreen(),
    3,  // max retries
    500, // base delay
    5000 // max delay
);
```

---

## 📊 СКЛАДНІСТЬ ТА АНАЛІЗ АЛГОРИТМІВ

### Часова складність операцій:

| Операція | Складність | Опис |
|----------|------------|------|
| Frame Capture (DXGI) | O(1) | Hardware-accelerated |
| JPEG Compression | O(n) | n = pixel count |
| WebSocket Send | O(1) | Async, non-blocking |
| Client Management | O(log n) | n = client count |
| Memory Allocation | O(1) | Buffer pooling |

### Просторова складність:

| Компонент | Складність | Опис |
|-----------|------------|------|
| Frame Buffer | O(k) | k = buffer pool size |
| Client Storage | O(n) | n = concurrent clients |
| Message Queue | O(m) | m = pending messages |
| Metrics History | O(h) | h = history window |

---

## 🔬 ТЕСТУВАННЯ ТА ЯКІСТЬ КОДУ

### Code Coverage та Quality Metrics:

```typescript
// Jest configuration
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    }
};
```

### Static Analysis та Linting:

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

## 📈 МАЙБУТНІ РОЗШИРЕННЯ

### Planned Features:

1. **Machine Learning Integration**
   - Adaptive quality based on content analysis
   - Predictive bandwidth management

2. **Blockchain Recording**
   - Immutable capture logs
   - Distributed verification

3. **AI-Powered Optimization**
   - Content-aware compression
   - Intelligent frame skipping

---

*Документ підготовлено для технічного захисту проекту*