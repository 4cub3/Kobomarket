import express from "express";
import isAuthenticated from "../../middleware/authenticate.js";
import { apiLimiter } from "../../middleware/rateLimit.js";
import CartController from "./cart.controller.js";

const router = express.Router();

// Any logged-in user can shop (a vendor is a buyer too), so no role check here
router.get("/", isAuthenticated, apiLimiter, CartController.getCart);
router.delete("/", isAuthenticated, apiLimiter, CartController.clearCart);
router.post("/items", isAuthenticated, apiLimiter, CartController.addItem);
router.patch("/items/:itemId", isAuthenticated, apiLimiter, CartController.updateItem);
router.delete("/items/:itemId", isAuthenticated, apiLimiter, CartController.removeItem);

export default router;
