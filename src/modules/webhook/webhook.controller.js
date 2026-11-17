import { handlePaystackWebhook } from "./webhook.service.js";

class WebhookController {
    static async paystack(req, res, next) {
        try {
            const result = await handlePaystackWebhook(req.body, req.get("x-paystack-signature"));
            // Paystack only needs a 200. Any error status (e.g. our database is down)
            // makes it retry later, which is what we want.
            res.status(200).json({ success: true, message: "Webhook received", data: { event: result.event, handled: result.handled } });
        } catch (error) {
            next(error);
        }
    }
}

export default WebhookController;
