import crypto from "node:crypto";

// Paystack signs the raw request body with HMAC-SHA512 using your secret key and
// sends the hex digest in the x-paystack-signature header.
export const signPaystackPayload = (rawBody, secret) =>
    crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

// Compares in constant time, so the check doesn't reveal how much of a forged
// signature was right. Unsigned or malformed requests are simply invalid.
export const isValidPaystackSignature = (rawBody, signature, secret) => {
    if (!secret || typeof signature !== "string" || !Buffer.isBuffer(rawBody)) return false;
    const expected = Buffer.from(signPaystackPayload(rawBody, secret), "utf8");
    const received = Buffer.from(signature, "utf8");
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
