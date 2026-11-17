import { createProductService, listProductsService } from "./product.service.js";

class ProductController {
    static async createProduct(req, res, next) {
        try {
            const product = await createProductService(req.userId, req.body);
            res.status(201).json({ success: true, message: "Product created successfully", data: product });
        } catch (error) {
            next(error);
        }
    }

    static async listProducts(req, res, next) {
        try {
            const { items, pageInfo } = await listProductsService(req.query);
            res.status(200).json({ success: true, message: "Products retrieved successfully", data: items, pageInfo });
        } catch (error) {
            next(error);
        }
    }
}

export default ProductController;
