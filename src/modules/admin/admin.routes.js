import express from "express";
import isAuthenticated from "../../middleware/authenticate.js";
import { apiLimiter } from "../../middleware/rateLimit.js";
import validateBodySchema from "../../middleware/validateBodySchemas.js";
import { approveRejectVendorApplicationSchema } from "./admin.schema.js";
import AdminController from "./admin.controller.js";
import isAuthorized from "../../middleware/authorize.js";

const router = express.Router();

router.put("/approve-reject-vendor/:applicationId", isAuthenticated, isAuthorized("admin"), apiLimiter, validateBodySchema(approveRejectVendorApplicationSchema), AdminController.approveRejectVendorApplication)
router.get("/applications", isAuthenticated, isAuthorized("admin"), apiLimiter, AdminController.getAllVendorApplications)
router.get("/vendors", isAuthenticated, isAuthorized("admin"), apiLimiter, AdminController.getAllVendor)

export default router;