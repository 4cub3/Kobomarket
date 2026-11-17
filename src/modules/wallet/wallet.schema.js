import z from "zod";
import { paymentsConfig } from "../../config/payments.js";
import { formatKobo } from "../../lib/money.js";

const { minKobo, maxKobo } = paymentsConfig.funding;

export const fundWalletSchema = z.object({
    amountKobo: z
        .number("amountKobo must be a number of kobo")
        .int("amountKobo must be a whole number of kobo")
        .min(minKobo, `The minimum funding amount is ${formatKobo(minKobo)}`)
        .max(maxKobo, `The maximum funding amount is ${formatKobo(maxKobo)}`),
});

export const listTransactionsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
});

// Paystack references only use letters, digits, "-", "." and "="
export const referenceParamsSchema = z.object({
    reference: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9.=-]+$/, "Invalid reference"),
});
