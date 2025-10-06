import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    userId: string;
    username: string;
    email: string;
    avatar?: string;
    bio?: string;
    role: 'viewer' | 'streamer' | 'admin';
    isVerified: boolean;
    stats: {
        totalStreams: number;
        totalViews: number;
        followers: number;
        following: number;
    };
    streamingKey?: string;
    preferences: {
        defaultQuality: string;
        defaultFps: number;
        notifications: boolean;
        privacy: 'public' | 'unlisted' | 'private';
    };
    socialLinks?: {
        twitter?: string;
        youtube?: string;
        discord?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

const UserSchema = new Schema<IUser>(
    {
        userId: { 
            type: String, 
            required: true, 
            unique: true,
            index: true 
        },
        username: { 
            type: String, 
            required: true,
            unique: true,
            minlength: 3,
            maxlength: 30,
            lowercase: true,
            trim: true
        },
        email: { 
            type: String, 
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
        },
        avatar: String,
        bio: { 
            type: String,
            maxlength: 500 
        },
        role: { 
            type: String, 
            enum: ['viewer', 'streamer', 'admin'],
            default: 'viewer' 
        },
        isVerified: { 
            type: Boolean, 
            default: false 
        },
        stats: {
            totalStreams: { type: Number, default: 0 },
            totalViews: { type: Number, default: 0 },
            followers: { type: Number, default: 0 },
            following: { type: Number, default: 0 }
        },
        streamingKey: { 
            type: String,
            select: false // Не показувати за замовчуванням
        },
        preferences: {
            defaultQuality: { type: String, default: '720p' },
            defaultFps: { type: Number, default: 30 },
            notifications: { type: Boolean, default: true },
            privacy: { 
                type: String, 
                enum: ['public', 'unlisted', 'private'],
                default: 'public' 
            }
        },
        socialLinks: {
            twitter: String,
            youtube: String,
            discord: String
        },
        lastLoginAt: Date
    },
    { 
        timestamps: true,
        collection: 'users'
    }
);

// Індекси (unique вже створює індекс, додаємо тільки role)
UserSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
