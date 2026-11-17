import z from "zod";
import { PRODUCT_CATEGORIES } from "../../models/product.js";

// Sort option -> field + direction. _id is always the tiebreaker.
export const SORTS = {
    newest: { field: "createdAt", dir: -1 },
    price_asc: { field: "price", dir: 1 },
    price_desc: { field: "price", dir: -1 },
    rating: { field: "ratingAverage", dir: -1 },
};

const kobo = z.number().int("Must be a whole number of kobo").min(0);
const stock = z.number().int().min(0);

const variantSchema = z.object({
    sku: z.string().trim().optional(),
    size: z.string().trim().optional(),
    colour: z.string().trim().optional(),
    price: kobo,
    stock,
}).refine((v) => Boolean(v.size || v.colour), { message: "A variant needs a size or colour" });

export const createProductSchema = z.object({
    name: z.string().trim().min(1, "Product name is required").max(200),
    description: z.string().max(5000).optional(),
    category: z.enum(PRODUCT_CATEGORIES),
    images: z.array(z.url()).max(10).optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1)).max(20).optional(),
    price: kobo.optional(),
    stock: stock.optional(),
    variants: z.array(variantSchema).max(100).optional(),
    isActive: z.boolean().optional(),
}).refine((p) => Boolean(p.variants?.length) || p.price !== undefined, {
    message: "Price is required when the product has no variants",
    path: ["price"],
});

export const listProductsQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    vendorId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid vendor ID").optional(),
    minPrice: z.coerce.number().int().min(0).optional(), // kobo
    maxPrice: z.coerce.number().int().min(0).optional(), // kobo
    minRating: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(Object.keys(SORTS)).default("newest"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
}).refine((f) => f.minPrice === undefined || f.maxPrice === undefined || f.minPrice <= f.maxPrice, {
    message: "minPrice cannot be more than maxPrice",
    path: ["minPrice"],
});
