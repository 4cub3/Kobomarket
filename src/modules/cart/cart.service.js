import mongoose from "mongoose";
import AppError from "../../shared/errors/appError.js";
import { toKobo } from "../../lib/money.js";
import { parseOrThrow } from "../../lib/validation.js";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../../models/cart.js";
import CartRepository from "./cart.repository.js";
import ProductRepository from "../product/product.repository.js";
import { addCartItemSchema, updateCartItemSchema, cartItemParamsSchema } from "./cart.schema.js";

const SAVE_ATTEMPTS = 5;

// A short random pause, so requests that collided don't retry in lockstep
const pause = () => new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 25)));

const isSameLine = (item, productId, variantId) =>
    String(item.productId) === String(productId)
    && String(item.variantId ?? "") === String(variantId ?? "");

// What is actually being bought (the product, or one of its variants), with its
// live price and stock from the catalogue. Returns { error } if it can't be bought.
const resolveUnit = (product, variantId) => {
    if (!product || product.isDeleted || !product.isActive) {
        return { error: "This product is no longer available" };
    }
    if (product.variants?.length) {
        if (!variantId) return { error: "Choose a variant (size/colour) for this product" };
        const variant = product.variants.find((v) => String(v._id) === String(variantId));
        if (!variant) return { error: "This variant is no longer available" };
        return { priceKobo: variant.price, stock: variant.stock, variant };
    }
    if (variantId) return { error: "This product has no variants" };
    return { priceKobo: product.price, stock: product.stock, variant: null };
};

const assertQuantityAvailable = (quantity, unit) => {
    if (quantity > MAX_LINE_QUANTITY) {
        throw new AppError(`You can have at most ${MAX_LINE_QUANTITY} of one item in your cart`, 400);
    }
    if (quantity > unit.stock) {
        throw new AppError(unit.stock === 0 ? "This item is out of stock" : `Only ${unit.stock} left in stock`, 400);
    }
};

// Loads the cart, applies `change`, then saves. If another request saved the cart
// in between (VersionError), start again from fresh data instead of overwriting it.
const changeCart = async (userId, change, { createIfMissing = true } = {}) => {
    for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
        const cart = createIfMissing
            ? await CartRepository.findOrCreateByUserId(userId)
            : await CartRepository.findByUserId(userId);
        if (!cart) throw new AppError("Cart item not found", 404);

        await change(cart);
        try {
            return await CartRepository.save(cart);
        } catch (error) {
            if (!(error instanceof mongoose.Error.VersionError)) throw error;
            await pause();
        }
    }
    throw new AppError("Your cart is being updated by another request, please try again", 409);
};

// The cart as the buyer sees it. Prices and stock always come from the product
// catalogue right now, never from the cart, and items are grouped by vendor
// because checkout turns each vendor's items into one sub-order.
// Totals are for display; checkout recomputes them (and charges) in PostgreSQL.
export const buildCartView = async (cart) => {
    const items = cart?.items ?? [];
    const productIds = [...new Set(items.map((item) => String(item.productId)))];
    const products = productIds.length ? await ProductRepository.findProductsByIds(productIds) : [];
    const productsById = new Map(products.map((product) => [String(product._id), product]));

    const lines = items.map((item) => {
        const product = productsById.get(String(item.productId));
        const unit = resolveUnit(product, item.variantId);
        const unitPriceKobo = unit.error ? null : unit.priceKobo;
        let problem = unit.error ?? null;
        if (!problem && item.quantity > unit.stock) {
            problem = unit.stock === 0 ? "Out of stock" : `Only ${unit.stock} left in stock`;
        }
        return {
            itemId: String(item._id),
            productId: String(item.productId),
            variantId: item.variantId ? String(item.variantId) : null,
            vendorId: String(product?.vendorId ?? item.vendorId),
            name: product?.name ?? null,
            slug: product?.slug ?? null,
            image: product?.images?.[0] ?? null,
            variant: unit.variant
                ? { size: unit.variant.size ?? null, colour: unit.variant.colour ?? null, sku: unit.variant.sku ?? null }
                : null,
            quantity: item.quantity,
            unitPriceKobo,
            priceAtAddKobo: item.priceAtAddKobo,
            priceChanged: unitPriceKobo !== null && unitPriceKobo !== item.priceAtAddKobo,
            lineTotalKobo: unitPriceKobo === null ? null : toKobo(unitPriceKobo * item.quantity),
            availableStock: unit.error ? 0 : unit.stock,
            available: problem === null,
            problem,
        };
    });

    const vendors = new Map();
    for (const line of lines) {
        if (!vendors.has(line.vendorId)) vendors.set(line.vendorId, { vendorId: line.vendorId, subtotalKobo: 0, items: [] });
        const group = vendors.get(line.vendorId);
        group.items.push(line);
        if (line.available) group.subtotalKobo = toKobo(group.subtotalKobo + line.lineTotalKobo);
    }
    const groups = [...vendors.values()];
    const availableLines = lines.filter((line) => line.available);

    return {
        vendors: groups,
        itemCount: availableLines.reduce((count, line) => count + line.quantity, 0),
        totalKobo: toKobo(groups.reduce((sum, group) => sum + group.subtotalKobo, 0)),
        hasProblems: availableLines.length !== lines.length,
        updatedAt: cart?.updatedAt ?? null,
    };
};

export const getCart = async (userId) => buildCartView(await CartRepository.findByUserId(userId));

export const addItem = async (userId, body) => {
    const { productId, variantId, quantity } = parseOrThrow(addCartItemSchema, body);
    const product = await ProductRepository.findProductById(productId);
    if (!product || product.isDeleted) throw new AppError("Product not found", 404);
    const unit = resolveUnit(product, variantId);
    if (unit.error) throw new AppError(unit.error, 400);

    const cart = await changeCart(userId, (cart) => {
        const line = cart.items.find((item) => isSameLine(item, productId, variantId));
        const newQuantity = (line?.quantity ?? 0) + quantity;
        assertQuantityAvailable(newQuantity, unit);

        if (line) {
            line.quantity = newQuantity;
            line.priceAtAddKobo = unit.priceKobo; // the buyer is looking at today's price
            return;
        }
        if (cart.items.length >= MAX_CART_LINES) {
            throw new AppError(`A cart can hold at most ${MAX_CART_LINES} different items`, 400);
        }
        cart.items.push({
            productId,
            variantId: variantId ?? null,
            vendorId: product.vendorId,
            quantity,
            priceAtAddKobo: unit.priceKobo,
        });
    });
    return buildCartView(cart);
};

export const updateItem = async (userId, params, body) => {
    const { itemId } = parseOrThrow(cartItemParamsSchema, params);
    const { quantity } = parseOrThrow(updateCartItemSchema, body);

    const cart = await changeCart(userId, async (cart) => {
        const line = cart.items.id(itemId);
        if (!line) throw new AppError("Cart item not found", 404);
        const product = await ProductRepository.findProductById(line.productId);
        const unit = resolveUnit(product, line.variantId);
        if (unit.error) throw new AppError(`${unit.error}. Remove it from your cart.`, 400);
        assertQuantityAvailable(quantity, unit);
        line.quantity = quantity;
    }, { createIfMissing: false });
    return buildCartView(cart);
};

export const removeItem = async (userId, params) => {
    const { itemId } = parseOrThrow(cartItemParamsSchema, params);
    const cart = await changeCart(userId, (cart) => {
        if (!cart.items.id(itemId)) throw new AppError("Cart item not found", 404);
        cart.items.pull({ _id: itemId });
    }, { createIfMissing: false });
    return buildCartView(cart);
};

export const clearCart = async (userId) => {
    const existing = await CartRepository.findByUserId(userId);
    if (!existing || existing.items.length === 0) return buildCartView(existing);
    const cart = await changeCart(userId, (cart) => {
        cart.items = [];
    }, { createIfMissing: false });
    return buildCartView(cart);
};
