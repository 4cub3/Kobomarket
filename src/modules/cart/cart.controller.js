import { getCart, addItem, updateItem, removeItem, clearCart } from "./cart.service.js";

class CartController {
    static async getCart(req, res, next) {
        try {
            const cart = await getCart(req.userId);
            res.status(200).json({ success: true, message: "Cart retrieved successfully", data: cart });
        } catch (error) {
            next(error);
        }
    }

    static async addItem(req, res, next) {
        try {
            const cart = await addItem(req.userId, req.body);
            res.status(200).json({ success: true, message: "Item added to cart", data: cart });
        } catch (error) {
            next(error);
        }
    }

    static async updateItem(req, res, next) {
        try {
            const cart = await updateItem(req.userId, req.params, req.body);
            res.status(200).json({ success: true, message: "Cart item updated", data: cart });
        } catch (error) {
            next(error);
        }
    }

    static async removeItem(req, res, next) {
        try {
            const cart = await removeItem(req.userId, req.params);
            res.status(200).json({ success: true, message: "Item removed from cart", data: cart });
        } catch (error) {
            next(error);
        }
    }

    static async clearCart(req, res, next) {
        try {
            const cart = await clearCart(req.userId);
            res.status(200).json({ success: true, message: "Cart cleared", data: cart });
        } catch (error) {
            next(error);
        }
    }
}

export default CartController;
