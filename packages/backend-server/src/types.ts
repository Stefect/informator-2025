/**
 * Application Types
 */

import { MESSAGE_TYPES, CLIENT_TYPES, FRAME_CODECS } from './constants';

// Utility types
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type ClientType = typeof CLIENT_TYPES[keyof typeof CLIENT_TYPES];
export type FrameCodec = typeof FRAME_CODECS[keyof typeof FRAME_CODECS];

// Base message interface
export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
}

// Client → Server messages
export interface IdentificationMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.IDENTIFICATION;
  clientType: ClientType;
  version?: string;
  capabilities?: string[];
}

export interface JoinStreamMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.JOIN_STREAM;
  streamId: string;
}

export interface HeartbeatMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.HEARTBEAT;
}

export interface CommandMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.COMMAND;
  command: 'start_capture' | 'stop_capture' | 'pause' | 'resume';
  params?: Record<string, unknown>;
}

// Server → Client messages
export interface WelcomeMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.WELCOME;
  clientId: string;
  serverVersion: string;
}

export interface StreamCreatedMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.STREAM_CREATED;
  streamId: string;
}

export interface JoinedStreamMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.JOINED_STREAM;
  streamId: string;
  viewerCount: number;
}

export interface FrameMetadataMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.FRAME_METADATA;
  codec: FrameCodec;
  width: number;
  height: number;
  timestamp: number;
  frameNumber: number;
}

export interface StreamEndedMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.STREAM_ENDED;
  streamId: string;
  reason?: string;
}

export interface ErrorMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.ERROR;
  message: string;
  code?: string;
}

export interface PongMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.PONG;
}

// Union type for all messages
export type ClientMessage = 
  | IdentificationMessage 
  | JoinStreamMessage 
  | HeartbeatMessage 
  | CommandMessage;

export type ServerMessage = 
  | WelcomeMessage 
  | StreamCreatedMessage 
  | JoinedStreamMessage 
  | FrameMetadataMessage 
  | StreamEndedMessage 
  | ErrorMessage 
  | PongMessage;

// Stream info
export interface StreamInfo {
  streamId: string;
  captureClientId: string;
  viewerIds: string[];
  createdAt: Date;
  lastFrameAt: Date;
  stats: {
    framesReceived: number;
    framesSent: number;
    bytesReceived: number;
    bytesSent: number;
  };
}

// Client info
export interface ClientInfo {
  id: string;
  type: ClientType;
  connectedAt: Date;
  lastHeartbeat: Date;
  streamId?: string;
}

// Frame data
export interface FrameData {
  metadata: FrameMetadataMessage;
  data: Buffer;
}
