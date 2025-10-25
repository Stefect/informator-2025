/**
 * Application Constants
 */

export const MESSAGE_TYPES = {
  // Client → Server
  IDENTIFICATION: 'identification',
  JOIN_STREAM: 'join_stream',
  HEARTBEAT: 'heartbeat',
  COMMAND: 'command',
  METRICS: 'metrics',
  
  // Server → Client
  WELCOME: 'welcome',
  STREAM_CREATED: 'stream_created',
  JOINED_STREAM: 'joined_stream',
  FRAME_METADATA: 'frame_metadata',
  STREAM_ENDED: 'stream_ended',
  ERROR: 'error',
  PONG: 'pong',
  
  // Bidirectional (both Client ↔ Server)
  START_CAPTURE: 'start_capture',
  STOP_CAPTURE: 'stop_capture',
} as const;

export const CLIENT_TYPES = {
  CAPTURE: 'capture_client',
  VIEWER: 'viewer',
  UNKNOWN: 'unknown',
} as const;

export const FRAME_CODECS = {
  BGRA: 'bgra',
  JPEG: 'jpeg',
  H264: 'h264',
} as const;

export const WEBSOCKET_EVENTS = {
  CONNECTION: 'connection',
  MESSAGE: 'message',
  CLOSE: 'close',
  ERROR: 'error',
} as const;

export const JPEG_CONFIG = {
  QUALITY: 75,
  CHROMA_SUBSAMPLING: '4:2:0',
  COMPRESSION_THRESHOLD: 0.9, // 90% compression expected
} as const;

export const STREAM_CONFIG = {
  MAX_VIEWERS_PER_STREAM: 100,
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  FRAME_TIMEOUT: 5000, // 5 seconds
} as const;

export const ERRORS = {
  STREAM_NOT_FOUND: 'Stream not found',
  STREAM_FULL: 'Stream is full',
  INVALID_MESSAGE_TYPE: 'Invalid message type',
  NOT_IDENTIFIED: 'Client not identified',
  MISSING_STREAM_ID: 'Missing stream ID',
} as const;
