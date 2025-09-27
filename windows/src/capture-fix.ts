// Обгортка для модуля захоплення екрану з додатковими функціями
import {
  initializeCapture,
  captureFrame as originalCaptureFrame,
  getConfig as getOriginalConfig,
  setConfig as setOriginalConfig,
  createTestFrame
} from './screen-capture';

// Експортуємо інтерфейс для конфігурації
import { CaptureConfig } from './types';

// Лічильник активних клієнтів
let activeClients = 0;

/**
 * Ініціалізація модуля захоплення
 */
export function initializeCaptureModule(): boolean {
  return initializeCapture();
}

/**
 * Отримання кадру з екрану
 */
export function captureFrame(): Buffer | null {
  // Якщо немає активних клієнтів, не захоплюємо кадри
  if (activeClients === 0) {
    return null;
  }
  
  return originalCaptureFrame();
}

/**
 * Встановлення кількості активних клієнтів
 */
export function setActiveClients(count: number): void {
  activeClients = count;
}

/**
 * Отримання поточної конфігурації
 */
export function getConfig(): CaptureConfig {
  return getOriginalConfig();
}

/**
 * Встановлення нової конфігурації
 */
export function setConfig(config: CaptureConfig): void {
  setOriginalConfig(config);
}
