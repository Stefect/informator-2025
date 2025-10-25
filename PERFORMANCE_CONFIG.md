# ⚡ Performance Configuration

## Current Settings (After Optimization)

### 🎥 Capture Client
- **Frame Rate:** 30 FPS (increased from 5 FPS)
- **Capture Interval:** ~33ms (decreased from 200ms)
- **Resolution:** 1280x720
- **Codec:** JPEG with quality 75
- **Chroma Subsampling:** 4:2:0

### 🖥️ Backend Server
- **Max Viewers per Stream:** ∞ (Unlimited)
- **JPEG Quality:** 75
- **Compression Ratio:** ~97% (BGRA → JPEG)
- **Heartbeat Interval:** 30 seconds
- **Frame Timeout:** 5 seconds

## 📊 Performance Metrics

### Bandwidth Usage (estimated)

**Before optimizations:**
- RAW BGRA @ 5 FPS: ~144 Mbps
- 1280×720×4 bytes × 5 FPS = 18.432 MB/s

**After JPEG compression @ 5 FPS:**
- JPEG @ 5 FPS: ~4 Mbps
- Compression ratio: 97.2%

**Current (JPEG @ 30 FPS):**
- JPEG @ 30 FPS: ~24 Mbps per viewer
- Still 6x less than original RAW @ 5 FPS
- Smooth streaming experience

### Frame Rate Comparison

| Configuration | FPS | Interval | Smoothness |
|--------------|-----|----------|------------|
| Old (RAW) | 5 | 200ms | Choppy |
| Previous (JPEG) | 5 | 200ms | Choppy but compressed |
| **Current (JPEG)** | **30** | **33ms** | **Smooth** ✅ |

## 🚀 Benefits

✅ **6x smoother streaming** (5 FPS → 30 FPS)  
✅ **Unlimited viewers** (no MAX_VIEWERS limit)  
✅ **97% compression** maintained with JPEG  
✅ **Real-time experience** with 33ms latency  
✅ **Scalable** - server can handle multiple streams  

## ⚠️ Considerations

- **Higher CPU usage** on capture client (30 FPS encoding)
- **Higher bandwidth** (~24 Mbps per viewer vs ~4 Mbps @ 5 FPS)
- **Network quality** important for smooth playback
- **Multiple viewers** multiply bandwidth (no server-side limit)

## 🎛️ Tuning Options

To adjust performance, modify these values:

### Reduce bandwidth (if network is slow):
```javascript
// packages/capture-client/index.js
fps: 15,  // Half the frame rate
```

```typescript
// packages/backend-server/src/constants.ts
JPEG_CONFIG.QUALITY: 60,  // Lower quality = smaller files
```

### Increase quality (if bandwidth available):
```typescript
// packages/backend-server/src/constants.ts
JPEG_CONFIG.QUALITY: 85,  // Higher quality
```

### Add viewer limit (if needed):
```typescript
// packages/backend-server/src/constants.ts
MAX_VIEWERS_PER_STREAM: 50,  // Set specific limit
```

## 📈 Recommended Settings by Use Case

### Local Network (LAN):
- FPS: 30
- Quality: 85
- Expected bandwidth: ~30-40 Mbps per viewer

### Internet Streaming:
- FPS: 15-24
- Quality: 70-75
- Expected bandwidth: ~12-18 Mbps per viewer

### Low Bandwidth:
- FPS: 10
- Quality: 60
- Expected bandwidth: ~6-8 Mbps per viewer

### Demo/Presentation:
- FPS: 30 (smooth)
- Quality: 75 (balanced)
- Max Viewers: Unlimited
- Current configuration ✅
