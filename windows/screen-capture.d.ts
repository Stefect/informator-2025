declare module '../build/Release/screencapture.node' {
  export interface ScreenCaptureNative {
    capture(): Promise<Buffer>;
    release(): void;
  }

  const screenCapture: ScreenCaptureNative;
  export = screenCapture;
}