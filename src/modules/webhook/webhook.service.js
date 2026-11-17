import AppError from "../../shared/errors/appError.js";
import { paymentsConfig } from "../../config/payments.js";
import { isValidPaystackSignature } from "../../integrations/payments/paystack.signature.js";
import { completeFunding } from "../wallet/wallet.service.js";

// Paystack events we act on. Anything else is acknowledged (200) and ignored, so
// Paystack doesn't keep retrying it. Payout events (transfer.*) arrive in Sprint 4.
const handlers = {
    // Only the reference is used: completeFunding re-verifies with Paystack and
    // never trusts the amount in the webhook body
    "charge.success": (data) => completeFunding(data.reference),
};

export const handlePaystackWebhook = async (rawBody, signature) => {
    // Reject anything not signed with our secret before even parsing it
    if (!isValidPaystackSignature(rawBody, signature, paymentsConfig.webhookSecret)) {
        throw new AppError("Invalid webhook signature", 401);
    }

    let event;
    try {
        event = JSON.parse(rawBody.toString("utf8"));
    } catch {
        throw new AppError("Webhook body is not valid JSON", 400);
    }

    const handler = handlers[event?.event];
    const reference = event?.data?.reference;
    if (!handler || typeof reference !== "string") {
        return { event: event?.event ?? null, handled: false };
    }

    const { outcome } = await handler(event.data);
    console.info(`[webhook] ${event.event} ${reference}: ${outcome}`);
    return { event: event.event, handled: true, outcome };
};
