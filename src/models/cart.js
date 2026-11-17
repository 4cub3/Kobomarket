import mongoose from "mongoose";
const { Schema } = mongoose;

export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 100;

const cartItemSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // null when the product has no variants
    variantId: { type: Schema.Types.ObjectId, default: null },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        max: MAX_LINE_QUANTITY,
        validate: { validator: Number.isInteger, message: "Quantity must be a whole number" },
    },
    // Catalogue price (kobo) when the item was last added. Display only and allowed
    // to go stale: checkout always re-reads the product's current price.
    priceAtAddKobo: {
        type: Number,
        required: true,
        min: 0,
        validate: { validator: Number.isSafeInteger, message: "Must be a whole number of kobo" },
    },
    addedAt: { type: Date, default: Date.now },
});

const cartSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: {
        type: [cartItemSchema],
        default: [],
        validate: {
            validator: (items) => items.length <= MAX_CART_LINES,
            message: `A cart can hold at most ${MAX_CART_LINES} different items`,
        },
    },
}, {
    timestamps: true,
    // Each save checks the version it loaded. If another request saved the cart in
    // between, save() fails with a VersionError instead of silently overwriting it.
    optimisticConcurrency: true,
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
