import mongoose from "mongoose";
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
}, { timestamps: true, versionKey: false });

const Review = mongoose.model("Review", reviewSchema);
export default Review;