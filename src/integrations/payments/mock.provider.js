import crypto from "node:crypto";
import { paymentsConfig } from "../../config/payments.js";
import { PaymentProviderError } from "./payment-provider.error.js";
import { signPaystackPayload } from "./paystack.signature.js";

// In-memory stand-in for Paystack (PAYMENT_PROVIDER=mock). Same interface as the
// real provider, and it confirms payments the same way, with signed charge.success
// webhooks. Like Paystack, it can deliver the same webhook more than once.
// State lives in memory, so pending mock payments are lost when the server restarts.
const payments = new Map(); // reference -> payment

const toPaymentResult = (payment) => ({
    status: payment.status,
    reference: payment.reference,
    amountKobo: payment.amountKobo,
    currency: payment.currency,
    providerTransactionId: payment.id,
    paidAt: payment.paidAt,
    channel: "card",
});

export const mockProvider = Object.freeze({
    name: "mock",

    async initializeTransaction({ email, amountKobo, reference, currency }) {
        if (payments.has(reference)) throw new PaymentProviderError("Duplicate transaction reference", 400);
        payments.set(reference, {
            id: crypto.randomInt(1_000_000_000, 2_000_000_000),
            reference,
            email,
            amountKobo,
            currency,
            status: "abandoned", // what Paystack reports until the customer pays
            paidAt: null,
        });
        return {
            authorizationUrl: `${paymentsConfig.mock.baseUrl}/api/v1/mock-paystack/checkout/${encodeURIComponent(reference)}`,
            accessCode: `mock_${crypto.randomBytes(6).toString("hex")}`,
            reference,
        };
    },

    async verifyTransaction(reference) {
        const payment = payments.get(reference);
        if (!payment) throw new PaymentProviderError("Transaction reference not found");
        return toPaymentResult(payment);
    },

    // The "customer" paying on the mock checkout page. On success it POSTs `copies`
    // identical signed webhooks at the same time, to prove the wallet is credited once.
    async completePayment(reference, { outcome, copies }) {
        const payment = payments.get(reference);
        if (!payment) throw new PaymentProviderError("Transaction reference not found", 404);
        if (payment.status !== "abandoned") throw new PaymentProviderError(`This payment is already ${payment.status}`, 409);

        payment.status = outcome === "failed" ? "failed" : "success";
        if (payment.status === "failed") return { status: payment.status, webhookResponses: [] };

        payment.paidAt = new Date().toISOString();
        const body = JSON.stringify({
            event: "charge.success",
            data: {
                id: payment.id,
                status: "success",
                reference,
                amount: payment.amountKobo,
                currency: payment.currency,
                paid_at: payment.paidAt,
                channel: "card",
                customer: { email: payment.email },
            },
        });
        const signature = signPaystackPayload(body, paymentsConfig.webhookSecret);
        const deliveries = await Promise.allSettled(Array.from({ length: copies }, () =>
            fetch(`${paymentsConfig.mock.baseUrl}/api/v1/webhooks/paystack`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
                body,
            })
        ));
        return {
            status: payment.status,
            webhookResponses: deliveries.map((d) => (d.status === "fulfilled" ? d.value.status : `error: ${d.reason?.message}`)),
        };
    },
});
