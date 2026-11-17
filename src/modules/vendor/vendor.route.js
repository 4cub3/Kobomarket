import express from "express";
import VendorController from "./vendor.controller.js";
import isAuthenticated from "../../middleware/authenticate.js";
import isAuthorized from "../../middleware/authorize.js";
import ProductController from "../product/product.controller.js";
const router = express.Router();

router.get("/:vendorId", isAuthenticated, VendorController.vendorById);
router.get("/user/:userId", isAuthenticated,isAuthorized("vendor"), VendorController.vendorByUserId);
router.post("/product", isAuthenticated, isAuthorized("vendor"), ProductController.createProduct);

export default router;