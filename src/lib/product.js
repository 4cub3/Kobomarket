export const sanitizeProduct = (product) => ({
    id: product._id,
    vendorId: product.vendorId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    images: product.images,
    tags: product.tags,
    price: product.price,
    stock: product.stock,
    variants: (product.variants ?? []).map((v) => ({
        id: v._id, sku: v.sku, size: v.size, colour: v.colour, price: v.price, stock: v.stock,
    })),
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    isActive: product.isActive,
    createdAt: product.createdAt,
});
