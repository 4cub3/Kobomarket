import express from "express"
import BuyerController from "./buyer.controller.js"
import isAuthenticated from "../../middleware/authenticate.js"
import validateBodySchema from "../../middleware/validateBodySchemas.js"
import { vendorApplicationSchema } from "./buyer.schema.js"
import { apiLimiter } from "../../middleware/rateLimit.js"
import isAuthorized from "../../middleware/authorize.js"

const router = express.Router()

router.post("/application", isAuthenticated, apiLimiter, isAuthorized("buyer"), validateBodySchema(vendorApplicationSchema), BuyerController.registerVendor)
router.get("/application", isAuthenticated, apiLimiter, isAuthorized("buyer"), BuyerController.getSingleVendorApplicationbyUserId)
export default router
