import mongoose from "mongoose";
const Schema = mongoose.Schema;
const sessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    refreshToken: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    ipAddress: {
        type: String,
        required: true,
    },
    userAgent: {
        type: String,
        required: true,
    },
    revokedAt: {
        type: Date,
        default: null,
    },
    lastUsedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true, versionKey: false
});

sessionSchema.index({ userId: 1, revokedAt: 1 });

export default mongoose.model("Session", sessionSchema);