declare interface Window {
    ImageCapture: any;
}

declare var window: Window;

export interface MediaTrackConstraintSet {
    chromeMediaSource?: string;
    chromeMediaSourceId?: string;
}

export interface MediaTrackConstraints extends MediaTrackConstraintSet {
    mandatory?: MediaTrackConstraintSet;
}