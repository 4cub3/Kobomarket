import express from "express";
import { mockProvider } from "./mock.provider.js";

// Fake Paystack checkout. app.js only mounts this when PAYMENT_PROVIDER=mock and
// NODE_ENV is not production.
const router = express.Router();

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// A tiny page so the funding flow can be clicked through in a browser
router.get("/checkout/:reference", (req, res) => {
    const reference = escapeHtml(req.params.reference);
    const action = `${req.baseUrl}/checkout/${encodeURIComponent(req.params.reference)}/pay`;
    res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Mock Paystack</title></head>
<body style="font-family: Arial, sans-serif; max-width: 480px; margin: 48px auto">
  <h1>Mock Paystack checkout</h1>
  <p>Reference: <code>${reference}</code></p>
  <form method="post" action="${action}?outcome=success"><button>Pay (sends 2 duplicate webhooks)</button></form>
  <form method="post" action="${action}?outcome=failed" style="margin-top: 12px"><button>Fail payment</button></form>
</body></html>`);
});

// POST .../pay?outcome=success|failed&copies=1-5
router.post("/checkout/:reference/pay", async (req, res, next) => {
    try {
        const outcome = req.query.outcome === "failed" ? "failed" : "success";
        const copies = Math.min(Math.max(Number.parseInt(req.query.copies, 10) || 2, 1), 5);
        const result = await mockProvider.completePayment(req.params.reference, { outcome, copies });
        res.status(200).json({
            success: true,
            message: `Mock payment ${result.status}`,
            data: { reference: req.params.reference, ...result },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
