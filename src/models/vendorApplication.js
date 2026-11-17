import mongoose from "mongoose";
const Schema = mongoose.Schema;

const vendorApplicationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    businessName: { type: String, required: true },
    businessType: { type: String, enum: ["individual", "registered_business"], required: true },
    cacNumber: { type: String },            // if registered
    businessAddress: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
}, { timestamps: true, versionKey: false });


const VendorApplication = mongoose.model("VendorApplication", vendorApplicationSchema);
export default VendorApplication;