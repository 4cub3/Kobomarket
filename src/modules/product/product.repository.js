import mongoose from "mongoose";
import Product from "../../models/product.js";
import Review from "../../models/review.js";
import { SORTS } from "./product.schema.js";

class ProductRepository {
    static async createProduct(productData, { session } = {}) {
        const [product] = await Product.create([productData], { session });
        return product;
    }

    static async findProducts({ q, category, vendorId, minPrice, maxPrice, minRating, sort, limit, after }) {
        const { field, dir } = SORTS[sort];
        const query = { isActive: true, isDeleted: false };

        if (q) query.$text = { $search: q };
        if (category) query.category = category;
        if (vendorId) query.vendorId = vendorId;
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined) query.price.$gte = minPrice;
            if (maxPrice !== undefined) query.price.$lte = maxPrice;
        }
        if (minRating !== undefined) query.ratingAverage = { $gte: minRating };

        // Only rows after the last row of the previous page.
        // Ties on the sort field are broken by _id.
        if (after) {
            const op = dir === 1 ? "$gt" : "$lt";
            query.$or = [
                { [field]: { [op]: after.value } },
                { [field]: after.value, _id: { [op]: after.id } },
            ];
        }

        // Fetch one extra to know if there's another page
        const rows = await Product.find(query)
            .sort({ [field]: dir, _id: dir })
            .limit(limit + 1)
            .lean();

        const hasNextPage = rows.length > limit;
        return { items: hasNextPage ? rows.slice(0, limit) : rows, hasNextPage };
    }

    // Call this from the review service after a review is created, edited or deleted
    static async refreshRating(productId) {
        const [stats] = await Review.aggregate([
            { $match: { productId: new mongoose.Types.ObjectId(productId) } },
            { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
        ]);
        await Product.updateOne({ _id: productId }, {
            ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
            ratingCount: stats?.count ?? 0,
        });
    }
}

export default ProductRepository;
