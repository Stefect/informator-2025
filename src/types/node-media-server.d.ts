declare module 'node-media-server' {
    export interface RTMPConfig {
        port?: number;
        chunk_size?: number;
        gop_cache?: boolean;
        ping?: number;
        ping_timeout?: number;
    }

    export interface HTTPConfig {
        port?: number;
        allow_origin?: string;
        mediaroot?: string;
    }

    export interface TransTask {
        app: string;
        hls?: boolean;
        hlsFlags?: string;
        hlsKeep?: boolean;
        dash?: boolean;
    }

    export interface TransConfig {
        ffmpeg?: string;
        tasks?: TransTask[];
    }

    export interface NodeMediaServerConfig {
        rtmp?: RTMPConfig;
        http?: HTTPConfig;
        trans?: TransConfig;
    }

    class NodeMediaServer {
        constructor(config: NodeMediaServerConfig);
        run(): void;
        stop(): void;
        on(event: string, callback: (...args: any[]) => void): void;
        reject(id: string): void;
    }

    export default NodeMediaServer;
}
