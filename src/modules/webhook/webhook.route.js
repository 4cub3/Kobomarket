import express from "express";
import WebhookController from "./webhook.controller.js";

const router = express.Router();

// The signature is an HMAC of the exact bytes Paystack sent, so this route reads
// the raw body (a Buffer). app.js mounts it BEFORE express.json(), which would
// otherwise consume and re-shape the body. No auth middleware: the signature is the auth.
router.post("/paystack", express.raw({ type: "*/*", limit: "1mb" }), WebhookController.paystack);

export default router;
