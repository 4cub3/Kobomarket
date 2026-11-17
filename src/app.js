import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.route.js";
import buyerRoutes from "./modules/buyer/buyer.route.js";
import adminRoutes from "./modules/admin/admin.routes.js"
import vendorRoutes from "./modules/vendor/vendor.route.js";
import productRoutes from "./modules/product/product.route.js";
import walletRoutes from "./modules/wallet/wallet.route.js";
import cartRoutes from "./modules/cart/cart.route.js";
import webhookRoutes from "./modules/webhook/webhook.route.js";
import mockPaystackRoutes from "./integrations/payments/mock.routes.js";
import { paymentsConfig } from "./config/payments.js";

const app = express();
// Webhooks verify a signature over the raw request body, so they are mounted
// before express.json() parses (and consumes) it
app.use("/api/v1/webhooks", webhookRoutes);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/buyer", buyerRoutes);
app.use("/api/v1/vendor", vendorRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/cart", cartRoutes);

// Fake Paystack checkout page: only with PAYMENT_PROVIDER=mock, never in production
if (paymentsConfig.provider === "mock" && process.env.NODE_ENV !== "production") {
    app.use("/api/v1/mock-paystack", mockPaystackRoutes);
}

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