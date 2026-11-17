import mongoose from "mongoose";
const Schema = mongoose.Schema

const vendorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  applicationId: { type: Schema.Types.ObjectId, ref: "VendorApplication", required: true },
  storeName: { type: String, required: true },
  description: { type: String, default: "" },
  logoUrl: { type: String, default: null },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  cacNumber: { type: String },
  businessType: { type: String, enum: ["individual", "registered_business"] },
  status: { type: String, enum: ["active", "suspended", "closed"], default: "active" },
}, { timestamps: true, versionKey: false });

const Vendor = mongoose.model("Vendor", vendorSchema);
export default Vendor;