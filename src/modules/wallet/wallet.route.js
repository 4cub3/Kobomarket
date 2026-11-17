import express from "express";
import isAuthenticated from "../../middleware/authenticate.js";
import { apiLimiter } from "../../middleware/rateLimit.js";
import idempotent from "../../middleware/idempotency.js";
import WalletController from "./wallet.controller.js";

const router = express.Router();

router.get("/", isAuthenticated, apiLimiter, WalletController.getWallet);
router.get("/transactions", isAuthenticated, apiLimiter, WalletController.listTransactions);
router.post("/fund", isAuthenticated, apiLimiter, idempotent("POST /wallet/fund"), WalletController.fund);
router.get("/fund/:reference", isAuthenticated, apiLimiter, WalletController.getFunding);
router.post("/fund/:reference/verify", isAuthenticated, apiLimiter, WalletController.verifyFunding);

export default router;
