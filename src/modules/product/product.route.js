import express from "express";
import ProductController from "./product.controller.js";

const router = express.Router();

// Public, so buyers can browse without logging in
router.get("/", ProductController.listProducts);

export default router;
