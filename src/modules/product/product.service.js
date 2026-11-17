import crypto from "node:crypto";
import mongoose from "mongoose";
import AppError from "../../shared/errors/appError.js";
import { sanitizeProduct } from "../../lib/product.js";
import { encodeCursor, decodeCursor } from "../../lib/cursor.js";
import ProductRepository from "./product.repository.js";
import VendorRepository from "../vendor/vendor.repository.js";
import { createProductSchema, listProductsQuerySchema, SORTS } from "./product.schema.js";

// Same 400 error shape as validateBodySchema
const parseOrThrow = (schema, input) => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        }));
        throw new AppError("Validation error", 400, errors);
    }
    return result.data;
};

const slugify = (text) => text
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");

const createProductService = async (userId, body) => {
    // Parsed data drops unknown keys, so clients can't set vendorId, slug or ratings
    const data = parseOrThrow(createProductSchema, body);

    const vendor = await VendorRepository.findVendorByUserId(userId);
    if (!vendor || vendor.status !== "active") {
        throw new AppError("Only active vendors can add products", 403);
    }

    // Try the clean slug; if taken, retry with a random suffix. Relying on the
    // unique index (rather than a findOne check first) means two requests can't race.
    const base = slugify(data.name) || "product";
    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = attempt === 0 ? base : `${base}-${crypto.randomBytes(3).toString("hex")}`;
        try {
            const product = await ProductRepository.createProduct({ ...data, vendorId: vendor._id, slug });
            return sanitizeProduct(product);
        } catch (error) {
            if (error?.code === 11000 && error.keyPattern?.slug) continue;
            throw error;
        }
    }
    throw new AppError("Could not create a unique slug, please try again", 409);
};

// A cursor only works with the sort it was made for, because a createdAt value
// means nothing when sorting by price
const readCursor = (cursor, sort) => {
    const { s, v, id } = decodeCursor(cursor);
    const isDateSort = SORTS[sort].field === "createdAt";
    const valid = s === sort
        && typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
        && (isDateSort ? typeof v === "string" && !Number.isNaN(Date.parse(v)) : typeof v === "number");
    if (!valid) throw new AppError("Invalid cursor", 400);
    return { value: isDateSort ? new Date(v) : v, id: new mongoose.Types.ObjectId(id) };
};

const listProductsService = async (query) => {
    const filters = parseOrThrow(listProductsQuerySchema, query);
    const after = filters.cursor ? readCursor(filters.cursor, filters.sort) : null;

    const { items, hasNextPage } = await ProductRepository.findProducts({ ...filters, after });

    const { field } = SORTS[filters.sort];
    const last = items.at(-1);
    const nextCursor = hasNextPage
        ? encodeCursor({ s: filters.sort, v: last[field], id: String(last._id) })
        : null;

    return { items: items.map(sanitizeProduct), pageInfo: { hasNextPage, nextCursor } };
};

export { createProductService, listProductsService };
