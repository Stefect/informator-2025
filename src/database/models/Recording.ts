import mongoose, { Document, Schema } from 'mongoose';

export interface IRecording extends Document {
    recordingId: string;
    streamId: string;
    streamerId: string;
    title: string;
    description?: string;
    filePath: string;
    fileSize: number;
    duration: number;
    thumbnail?: string;
    quality: {
        resolution: string;
        fps: number;
        bitrate: number;
        codec: string;
    };
    views: number;
    likes: number;
    status: 'processing' | 'ready' | 'failed' | 'deleted';
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const RecordingSchema = new Schema<IRecording>(
    {
        recordingId: { 
            type: String, 
            required: true, 
            unique: true,
            index: true 
        },
        streamId: { 
            type: String, 
            required: true,
            index: true 
        },
        streamerId: { 
            type: String, 
            required: true,
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
        filePath: { 
            type: String, 
            required: true 
        },
        fileSize: { 
            type: Number, 
            required: true,
            min: 0 
        },
        duration: { 
            type: Number, 
            required: true,
            min: 0 
        },
        thumbnail: String,
        quality: {
            resolution: { type: String, required: true },
            fps: { type: Number, required: true },
            bitrate: { type: Number, required: true },
            codec: { type: String, default: 'h264' }
        },
        views: { 
            type: Number, 
            default: 0,
            min: 0 
        },
        likes: { 
            type: Number, 
            default: 0,
            min: 0 
        },
        status: { 
            type: String, 
            enum: ['processing', 'ready', 'failed', 'deleted'],
            default: 'processing',
            index: true
        },
        publishedAt: Date
    },
    { 
        timestamps: true,
        collection: 'recordings'
    }
);

// Індекси
RecordingSchema.index({ streamerId: 1, publishedAt: -1 });
RecordingSchema.index({ status: 1, createdAt: -1 });

// Virtual для розміру у MB
RecordingSchema.virtual('fileSizeMB').get(function() {
    return (this.fileSize / (1024 * 1024)).toFixed(2);
});

// Virtual для тривалості у форматі HH:MM:SS
RecordingSchema.virtual('durationFormatted').get(function() {
    const hours = Math.floor(this.duration / 3600);
    const minutes = Math.floor((this.duration % 3600) / 60);
    const seconds = this.duration % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

export const Recording = mongoose.model<IRecording>('Recording', RecordingSchema);
