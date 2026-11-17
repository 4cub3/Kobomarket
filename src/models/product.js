import mongoose from "mongoose";
const { Schema } = mongoose;

export const PRODUCT_CATEGORIES = ["Electronics", "Fashion", "Home", "Beauty", "Sports", "Toys", "others"];

// Every amount is a whole number of kobo (see lib/money.js)
const kobo = {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isSafeInteger, message: "Must be a whole number of kobo" },
};
const stock = {
    type: Number,
    min: 0,
    default: 0,
    validate: { validator: Number.isInteger, message: "Stock must be a whole number" },
};

const variantSchema = new Schema({
    sku: { type: String, trim: true },
    size: { type: String, trim: true },
    colour: { type: String, trim: true },
    price: { ...kobo },
    stock: { ...stock },
});

const productSchema = new Schema({
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, enum: PRODUCT_CATEGORIES },
    images: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, lowercase: true }],
    // With variants, these hold the cheapest variant price and total variant stock
    // (set in the hook below), so listing can filter/sort on one field
    price: { ...kobo },
    stock: { ...stock },
    variants: [variantSchema],
    // Kept in sync from reviews so rating filter/sort needs no join
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

productSchema.pre("validate", function () {
    if (this.variants?.length) {
        this.price = Math.min(...this.variants.map((v) => v.price));
        this.stock = this.variants.reduce((sum, v) => sum + v.stock, 0);
    }
});

// Full-text search (MongoDB allows one text index per collection)
productSchema.index({ name: "text", description: "text" });

// Listing: fixed-value filters first, then sort keys + _id tiebreaker.
// Mongo can walk an index backwards, so { price: 1 } also serves price_desc.
productSchema.index({ isActive: 1, isDeleted: 1, createdAt: -1, _id: -1 });
productSchema.index({ isActive: 1, isDeleted: 1, price: 1, _id: 1 });
productSchema.index({ isActive: 1, isDeleted: 1, ratingAverage: -1, _id: -1 });
productSchema.index({ isActive: 1, isDeleted: 1, category: 1, createdAt: -1, _id: -1 });
productSchema.index({ isActive: 1, isDeleted: 1, category: 1, price: 1, _id: 1 });
productSchema.index({ vendorId: 1, createdAt: -1, _id: -1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
