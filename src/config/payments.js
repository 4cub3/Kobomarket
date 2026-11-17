// Payment settings, read once at startup (config/env.js loads .env.local first).

const PROVIDERS = ["paystack", "mock"];

const positiveInt = (value, fallback) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

const provider = (process.env.PAYMENT_PROVIDER || "paystack").toLowerCase();
if (!PROVIDERS.includes(provider)) {
    throw new Error(`PAYMENT_PROVIDER must be one of ${PROVIDERS.join(", ")} (got "${provider}")`);
}

const secretKey = process.env.PAYSTACK_SECRET_KEY || null;

export const paymentsConfig = Object.freeze({
    // "paystack" talks to the real API (use sk_test_ keys in development);
    // "mock" is an in-memory stand-in for local work and tests.
    provider,
    paystack: Object.freeze({
        secretKey,
        baseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
        callbackUrl: process.env.PAYSTACK_CALLBACK_URL || null,
        timeoutMs: positiveInt(process.env.PAYSTACK_TIMEOUT_MS, 10_000),
    }),
    // Paystack signs webhooks with your secret key. The mock falls back to a fixed
    // development secret so it works without one.
    webhookSecret: secretKey ?? (provider === "mock" ? "mock-paystack-secret" : null),
    mock: Object.freeze({
        // Where this API is reachable; the mock checkout page and its webhooks use it
        baseUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
    }),
    funding: Object.freeze({
        minKobo: positiveInt(process.env.WALLET_FUND_MIN_KOBO, 10_000), // ₦100
        maxKobo: positiveInt(process.env.WALLET_FUND_MAX_KOBO, 100_000_000), // ₦1,000,000
    }),
});
