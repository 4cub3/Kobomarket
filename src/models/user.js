import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["admin", "vendor", "buyer"],
        default: "buyer",
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    verificationToken: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Token",
    },
}, {
    timestamps: true, versionKey: false, toJSON: {
        transform: (doc, ret) => {
            delete ret.passwordHash;
            return ret;
        }
    }
});

const User = mongoose.model("User", userSchema);

export default User;