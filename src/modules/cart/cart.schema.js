import z from "zod";
import { objectIdString } from "../../lib/validation.js";
import { MAX_LINE_QUANTITY } from "../../models/cart.js";

const quantity = z
    .number("quantity must be a number")
    .int("quantity must be a whole number")
    .min(1, "quantity must be at least 1")
    .max(MAX_LINE_QUANTITY, `quantity can be at most ${MAX_LINE_QUANTITY}`);

export const addCartItemSchema = z.object({
    productId: objectIdString("productId"),
    // Required when the product has variants (checked in the service)
    variantId: objectIdString("variantId").nullish(),
    quantity: quantity.default(1),
});

export const updateCartItemSchema = z.object({ quantity });

export const cartItemParamsSchema = z.object({ itemId: objectIdString("cart item id") });
