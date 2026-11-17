import { paymentsConfig } from "../../config/payments.js";
import { paystackProvider } from "./paystack.provider.js";
import { mockProvider } from "./mock.provider.js";

// The rest of the app only talks to `paymentProvider`, so switching between real
// Paystack and the mock is a config change (PAYMENT_PROVIDER), not a code change.
// Both expose: name, initializeTransaction(), verifyTransaction().
export const paymentProvider = paymentsConfig.provider === "mock" ? mockProvider : paystackProvider;
