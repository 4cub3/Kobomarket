import crypto from "node:crypto";

// Unique, hard-to-guess transaction reference, e.g. "KMF-mf3k9z2a-3f9c1e7a2b4d6e8f".
// Paystack only accepts letters, digits, "-", "." and "=" in a reference.
export const generateReference = (prefix) =>
    `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}`;
