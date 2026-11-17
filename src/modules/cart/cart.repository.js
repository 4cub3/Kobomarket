import Cart from "../../models/cart.js";

class CartRepository {
    static findByUserId(userId) {
        return Cart.findOne({ userId });
    }

    static async findOrCreateByUserId(userId) {
        const existing = await Cart.findOne({ userId });
        if (existing) return existing;
        try {
            return await Cart.create({ userId, items: [] });
        } catch (error) {
            // Another request created it a moment ago (userId is unique): use that one
            if (error?.code === 11000) return Cart.findOne({ userId });
            throw error;
        }
    }

    static save(cart) {
        return cart.save();
    }
}

export default CartRepository;
