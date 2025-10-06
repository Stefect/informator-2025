// Performance Configuration
export const config = {
    // WebSocket optimization
    websocket: {
        perMessageDeflate: {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3 // Compression level (1-9, 3 is good balance)
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024
            },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            serverMaxWindowBits: 10,
            concurrencyLimit: 10,
            threshold: 1024 // Only compress messages > 1KB
        },
        maxPayload: 10 * 1024 * 1024, // 10MB max message size
        backlog: 100, // Connection queue
        clientTracking: true
    },

    // Frame processing
    frames: {
        maxBufferSize: 50, // Max buffered frames per client
        dropOldFrames: true, // Drop old frames if buffer full
        jpegQuality: 85, // Default JPEG quality (1-100)
        targetFPS: 30, // Target FPS
        minFPS: 15, // Minimum acceptable FPS
        maxFPS: 60 // Maximum FPS
    },

    // Memory management
    memory: {
        maxHeapUsage: 80, // Max heap usage percentage
        gcInterval: 60000, // Force GC every 60 seconds if needed
        cleanupInterval: 30000, // Cleanup old data every 30 seconds
        maxClientConnections: 1000 // Max simultaneous connections
    },

    // RTMP optimization
    rtmp: {
        port: 1935, // RTMP ingestion port
        httpPort: 8888, // HTTP delivery port (HLS/FLV)
        chunkSize: 60000, // Larger chunks = better throughput
        gopCache: true, // Cache GOP (Group of Pictures)
        ping: 30,
        pingTimeout: 60,
        
        // FFmpeg optimization
        ffmpeg: {
            threads: 4, // CPU threads for encoding
            preset: 'veryfast', // ultrafast, superfast, veryfast, faster, fast, medium, slow
            tune: 'zerolatency', // zerolatency, film, animation
            bufsize: '2M', // Buffer size
            maxrate: '5M', // Max bitrate
            
            // HLS settings
            hls: {
                time: 2, // Segment duration (seconds)
                listSize: 5, // Number of segments in playlist
                flags: 'delete_segments+append_list',
                startNumberSource: 'epoch'
            }
        }
    },

    // Caching
    cache: {
        staticMaxAge: 86400, // 24 hours for static files
        streamListTTL: 5, // Stream list cache TTL (seconds)
        metadataTTL: 60, // Metadata cache TTL (seconds)
        enableETag: true,
        enableCompression: true
    },

    // Monitoring
    monitoring: {
        metricsInterval: 60000, // Report metrics every 60 seconds
        healthCheckInterval: 10000, // Health check every 10 seconds
        enableDetailedMetrics: false, // Disable in production for performance
        logLevel: 'info' // error, warn, info, debug
    },

    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100, // Max 100 requests per window
        skipSuccessfulRequests: false
    },

    // CORS
    cors: {
        origin: '*', // In production: ['https://capturestream.com']
        credentials: true,
        maxAge: 86400 // 24 hours
    }
};

export default config;
