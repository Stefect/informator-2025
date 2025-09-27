import { ScreenCaptureNative, CaptureOptions } from './types';

let screenCapture: ScreenCaptureNative | null = null;
let currentFPS = 30;

try {
  screenCapture = require('../build/Release/screencapture.node');
} catch (error) {
  console.error('Failed to load screen capture module:', error instanceof Error ? error.message : String(error));
}

export interface ScreenCapture {
  setTargetFPS(fps: number): boolean;
  setQuality(quality: number): boolean;
  setResolutionScale(scale: number): boolean;
  setChangeThreshold(threshold: number): boolean;
  setActiveClients(active: boolean): void;
  getScreenSize(): { width: number; height: number } | null;
  capture(options?: CaptureOptions): Buffer | null;
  release(): void;
}

let isActive = false;
let isInitialized = false;
let lastFrameTime = 0;
let frameCount = 0;

export function createScreenCapture(): ScreenCapture {
  console.log('Creating screen capture instance...');
  
  if (!screenCapture) {
    console.error('Screen capture module is not loaded');
    throw new Error('Failed to load screen capture module');
  }

  // Test if the module is working by getting screen size
  try {
    const size = screenCapture.getScreenSize();
    if (!size || size.width === 0 || size.height === 0) {
      throw new Error('Invalid screen dimensions');
    }
    console.log('Screen capture module loaded successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize screen capture:', error);
    throw new Error('Failed to initialize screen capture');
  }

  return {
    setTargetFPS: (fps: number) => {
      console.log(`Setting target FPS to ${fps}`);
      try {
        currentFPS = fps;
        return screenCapture!.setTargetFPS(fps);
      } catch (error) {
        console.error('Failed to set target FPS:', error);
        throw error;
      }
    },
    setQuality: (quality: number) => {
      console.log(`Setting quality to ${quality}`);
      try {
        return screenCapture!.setQuality(quality);
      } catch (error) {
        console.error('Failed to set quality:', error);
        throw error;
      }
    },
    setResolutionScale: (scale: number) => {
      console.log(`Setting resolution scale to ${scale}`);
      try {
        return screenCapture!.setResolutionScale(scale);
      } catch (error) {
        console.error('Failed to set resolution scale:', error);
        throw error;
      }
    },
    setChangeThreshold: (threshold: number) => {
      console.log(`Setting change threshold to ${threshold}`);
      try {
        return screenCapture!.setChangeThreshold(threshold);
      } catch (error) {
        console.error('Failed to set change threshold:', error);
        throw error;
      }
    },
    setActiveClients: (active: boolean) => {
      console.log(`Setting active clients to ${active}`);
      try {
        isActive = active;
        if (screenCapture) {
          screenCapture.setActiveClients(active);
        }
        return;
      } catch (error) {
        console.error('Failed to set active clients:', error);
        isActive = false;
        throw error;
      }
    },
    getScreenSize: () => {
      try {
        const size = screenCapture!.getScreenSize();
        if (!size) {
          throw new Error('Failed to get screen size');
        }
        if (size.width === 0 || size.height === 0) {
          throw new Error('Invalid screen dimensions');
        }
        return size;
      } catch (error) {
        console.error('Error getting screen size:', error);
        throw error;
      }
    },
    capture: (options?: CaptureOptions) => {
      try {
        if (!isActive || !screenCapture || !isInitialized) {
          return null;
        }

        const now = Date.now();
        const timeSinceLastFrame = now - lastFrameTime;
        const targetFrameTime = 1000 / currentFPS;

        if (timeSinceLastFrame < targetFrameTime) {
          return null;
        }
    
        if (options) {
          const targetFPS = options.targetFPS || currentFPS;
          currentFPS = targetFPS;
          
          screenCapture.setTargetFPS(targetFPS);
          if (options.quality) screenCapture.setQuality(options.quality);
          if (options.resolutionScale) screenCapture.setResolutionScale(options.resolutionScale);
          if (options.changeThreshold) screenCapture.setChangeThreshold(options.changeThreshold);
        }
    
        const frame = screenCapture.capture();
        
        if (!frame) {
          return null;
        }

        lastFrameTime = now;
        frameCount++;

        // Log performance metrics less frequently
        if (frameCount % 100 === 0) {
          const fps = 1000 / timeSinceLastFrame;
          console.log(`Performance metrics - FPS: ${fps.toFixed(2)}, Frame size: ${frame.length} bytes, Frame count: ${frameCount}`);
        }

        return frame;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Screen capture failed:', error);
        throw new Error(`Screen capture failed: ${error.message}`);
      }
    },
    release: () => {
      try {
        isActive = false;
        if (screenCapture) {
          screenCapture.setActiveClients(false);
        }
      } catch (error) {
        console.error('Failed to release screen capture resources:', error);
        throw error;
      }
    }
  };
}