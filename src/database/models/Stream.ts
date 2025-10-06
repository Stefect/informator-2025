import mongoose, { Document, Schema } from 'mongoose';

export interface IStream extends Document {
    streamId: string;
    title: string;
    description?: string;
    streamer: {
        id: string;
        username: string;
        avatar?: string;
    };
    status: 'live' | 'ended' | 'scheduled';
    viewers: number;
    peakViewers: number;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    thumbnail?: string;
    category?: string;
    tags: string[];
    quality: {
        resolution: string;
        fps: number;
        bitrate: number;
    };
    rtmpUrl?: string;
    hlsUrl?: string;
    recordingPath?: string;
    stats: {
        totalViews: number;
        likes: number;
        comments: number;
        shares: number;
    };
    metadata: {
        serverVersion: string;
        captureSource: 'browser' | 'obs' | 'native';
        encoding: string;
    };
    createdAt: Date;
    updatedAt: Date;
    
    // Methods
    updateViewers(count: number): void;
    endStream(): void;
}

const StreamSchema = new Schema<IStream>(
    {
        streamId: { 
            type: String, 
            required: true, 
            unique: true,
            index: true 
        },
        title: { 
            type: String, 
            required: true,
            maxlength: 200 
        },
        description: { 
            type: String,
            maxlength: 5000 
        },
        streamer: {
            id: { type: String, required: true },
            username: { type: String, required: true },
            avatar: String
        },
        status: { 
            type: String, 
            enum: ['live', 'ended', 'scheduled'],
            default: 'live',
            index: true
        },
        viewers: { 
            type: Number, 
            default: 0,
            min: 0 
        },
        peakViewers: { 
            type: Number, 
            default: 0,
            min: 0 
        },
        startTime: { 
            type: Date, 
            required: true,
            index: true 
        },
        endTime: Date,
        duration: { 
            type: Number,
            min: 0 
        },
        thumbnail: String,
        category: { 
            type: String,
            index: true 
        },
        tags: [{ 
            type: String,
            lowercase: true,
            trim: true 
        }],
        quality: {
            resolution: { type: String, default: '1920x1080' },
            fps: { type: Number, default: 30 },
            bitrate: { type: Number, default: 2500 }
        },
        rtmpUrl: String,
        hlsUrl: String,
        recordingPath: String,
        stats: {
            totalViews: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            shares: { type: Number, default: 0 }
        },
        metadata: {
            serverVersion: { type: String, default: '1.0.0' },
            captureSource: { 
                type: String, 
                enum: ['browser', 'obs', 'native'],
                default: 'browser' 
            },
            encoding: { type: String, default: 'h264' }
        }
    },
    { 
        timestamps: true,
        collection: 'streams'
    }
);

// Індекси для швидкого пошуку
StreamSchema.index({ status: 1, startTime: -1 });
StreamSchema.index({ 'streamer.id': 1, startTime: -1 });
StreamSchema.index({ category: 1, status: 1 });
StreamSchema.index({ tags: 1 });

// Virtual для тривалості у хвилинах
StreamSchema.virtual('durationMinutes').get(function() {
    return this.duration ? Math.floor(this.duration / 60) : 0;
});

// Метод для оновлення кількості глядачів
StreamSchema.methods.updateViewers = function(count: number) {
    this.viewers = count;
    if (count > this.peakViewers) {
        this.peakViewers = count;
    }
};

// Метод для завершення стріму
StreamSchema.methods.endStream = function() {
    this.status = 'ended';
    this.endTime = new Date();
    if (this.startTime) {
        this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
    }
};

export const Stream = mongoose.model<IStream>('Stream', StreamSchema);
