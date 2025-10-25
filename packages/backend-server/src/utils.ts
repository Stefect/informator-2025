/**
 * Validation Utilities
 */

import { MESSAGE_TYPES, CLIENT_TYPES } from './constants';
import type { ClientMessage, BaseMessage } from './types';

/**
 * Type guard для перевірки чи це валідне повідомлення
 */
export function isValidMessage(data: unknown): data is BaseMessage {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  return typeof msg.type === 'string' && Object.values(MESSAGE_TYPES).includes(msg.type as any);
}

/**
 * Type guard для перевірки чи це identification message
 */
export function isIdentificationMessage(msg: BaseMessage): msg is ClientMessage {
  return msg.type === MESSAGE_TYPES.IDENTIFICATION;
}

/**
 * Type guard для перевірки чи це join stream message
 */
export function isJoinStreamMessage(msg: BaseMessage): msg is ClientMessage {
  return msg.type === MESSAGE_TYPES.JOIN_STREAM;
}

/**
 * Валідація client type
 */
export function isValidClientType(type: unknown): type is typeof CLIENT_TYPES[keyof typeof CLIENT_TYPES] {
  return typeof type === 'string' && Object.values(CLIENT_TYPES).includes(type as any);
}

/**
 * Валідація stream ID
 */
export function isValidStreamId(streamId: unknown): streamId is string {
  return typeof streamId === 'string' && streamId.length > 0 && streamId.length < 100;
}

/**
 * Валідація frame metadata
 */
export function isValidFrameMetadata(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const meta = data as Record<string, unknown>;
  
  return (
    typeof meta.codec === 'string' &&
    typeof meta.width === 'number' && meta.width > 0 &&
    typeof meta.height === 'number' && meta.height > 0 &&
    typeof meta.timestamp === 'number'
  );
}

/**
 * Безпечне парсення JSON
 */
export function safeJSONParse<T = unknown>(data: string | Buffer): T | null {
  try {
    const str = Buffer.isBuffer(data) ? data.toString('utf-8') : data;
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/**
 * Генерація унікального ID
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 12);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Форматування розміру байтів
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Форматування compression ratio
 */
export function formatCompressionRatio(original: number, compressed: number): string {
  if (original === 0) return '0%';
  const ratio = ((original - compressed) / original) * 100;
  return `${ratio.toFixed(1)}%`;
}

/**
 * Обчислення compression ratio
 */
export function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return ((original - compressed) / original) * 100;
}

/**
 * Throttle function для rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}
