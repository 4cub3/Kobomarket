import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.route.js";
import buyerRoutes from "./modules/buyer/buyer.route.js";
import adminRoutes from "./modules/admin/admin.routes.js"
import vendorRoutes from "./modules/vendor/vendor.route.js";
import productRoutes from "./modules/product/product.route.js";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/buyer", buyerRoutes);
app.use("/api/v1/vendor", vendorRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/auth", authRoutes);

app.use("/", (req, res) => {
    res.send("Hello World");
})
app.use((err, req, res, next) => {
    if (!err.statusCode) err.statusCode = 500;
    return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors,
    });
});
export default app;