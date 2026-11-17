import { paymentsConfig } from "../../config/payments.js";
import { PaymentProviderError } from "./payment-provider.error.js";

const { baseUrl, secretKey, timeoutMs } = paymentsConfig.paystack;

const request = async (method, path, body) => {
    if (!secretKey) {
        throw new PaymentProviderError("Paystack is not configured: set PAYSTACK_SECRET_KEY", 503);
    }
    let response;
    try {
        response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        throw new PaymentProviderError(`Could not reach Paystack: ${error.message}`);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== true) {
        throw new PaymentProviderError(payload?.message || `Paystack responded with HTTP ${response.status}`);
    }
    return payload.data;
};

// Paystack's transaction object (from verify, or a webhook's "data") -> our shape
export const toPaymentResult = (data) => ({
    status: data.status, // "success", "failed", "abandoned", "reversed", ...
    reference: data.reference,
    amountKobo: data.amount, // Paystack amounts are already in kobo
    currency: data.currency,
    providerTransactionId: data.id ?? null,
    paidAt: data.paid_at ?? data.paidAt ?? null,
    channel: data.channel ?? null,
});

export const paystackProvider = Object.freeze({
    name: "paystack",

    async initializeTransaction({ email, amountKobo, reference, currency, callbackUrl, metadata }) {
        const data = await request("POST", "/transaction/initialize", {
            email,
            amount: amountKobo,
            reference,
            currency,
            metadata,
            ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        });
        return {
            authorizationUrl: data.authorization_url,
            accessCode: data.access_code,
            reference: data.reference,
        };
    },

    async verifyTransaction(reference) {
        const data = await request("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
        return toPaymentResult(data);
    },
});
