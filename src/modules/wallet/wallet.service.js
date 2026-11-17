import crypto from "node:crypto";
import prisma from "../../database/postgres/prisma.js";
import AppError from "../../shared/errors/appError.js";
import { formatKobo, toKobo } from "../../lib/money.js";
import { encodeCursor, decodeCursor } from "../../lib/cursor.js";
import { parseOrThrow } from "../../lib/validation.js";
import { generateReference } from "../../lib/reference.js";
import { paymentsConfig } from "../../config/payments.js";
import { paymentProvider } from "../../integrations/payments/index.js";
import UserRepository from "../user/user.repository.js";
import LedgerRepository from "../ledger/ledger.repository.js";
import {
    DB_TRANSACTION_OPTIONS,
    getOrCreateUserAccount,
    getPlatformAccountId,
    postEntries,
} from "../ledger/ledger.service.js";
import {
    ACCOUNT_STATUSES,
    DIRECTIONS,
    EXTERNAL_ACCOUNTS,
    OWNER_TYPES,
    TRANSACTION_STATUSES,
    TRANSACTION_TYPES,
} from "../ledger/ledger.constants.js";
import { fundWalletSchema, listTransactionsQuerySchema, referenceParamsSchema } from "./wallet.schema.js";

const { PENDING, SUCCESS, FAILED } = TRANSACTION_STATUSES;

// Paystack statuses that mean the payment will never succeed. Anything else that
// isn't "success" (e.g. "abandoned", "ongoing") means the customer hasn't paid yet.
const FINAL_FAILURES = new Set(["failed", "reversed"]);

// ------------------------------------------------------------------ responses

const toWalletDto = (account) => ({
    id: account.id,
    currency: account.currency,
    balanceKobo: toKobo(account.balanceKobo),
    balance: formatKobo(account.balanceKobo),
    status: account.status,
    createdAt: account.createdAt,
});

const toFundingDto = (funding) => ({
    reference: funding.reference,
    status: funding.status,
    amountKobo: toKobo(funding.amountKobo),
    amount: formatKobo(funding.amountKobo),
    currency: funding.currency,
    // Only useful while the customer still has to pay
    authorizationUrl: funding.status === PENDING ? funding.metadata?.authorizationUrl ?? null : null,
    createdAt: funding.createdAt,
    updatedAt: funding.updatedAt,
});

const toEntryDto = (entry) => ({
    id: String(entry.id),
    direction: entry.direction,
    amountKobo: toKobo(entry.amountKobo),
    balanceAfterKobo: toKobo(entry.balanceAfterKobo),
    transaction: entry.transaction,
    createdAt: entry.createdAt,
});

// ------------------------------------------------------------------- reading

export const getWallet = async (userId) => toWalletDto(await getOrCreateUserAccount(userId));

export const listWalletTransactions = async (userId, query) => {
    const { limit, cursor } = parseOrThrow(listTransactionsQuerySchema, query);
    let beforeId;
    if (cursor) {
        const { id } = decodeCursor(cursor);
        if (typeof id !== "string" || !/^\d{1,19}$/.test(id)) throw new AppError("Invalid cursor", 400);
        beforeId = BigInt(id);
    }

    const account = await getOrCreateUserAccount(userId);
    const rows = await LedgerRepository.findAccountEntries(account.id, { limit, beforeId });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
        items: items.map(toEntryDto),
        pageInfo: {
            hasNextPage,
            nextCursor: hasNextPage ? encodeCursor({ id: String(items.at(-1).id) }) : null,
        },
    };
};

// A user can only see their own fundings; anyone else gets the same 404
const findOwnFunding = async (userId, params) => {
    const { reference } = parseOrThrow(referenceParamsSchema, params);
    const funding = await LedgerRepository.findTransactionByReference(reference);
    if (!funding || funding.type !== TRANSACTION_TYPES.FUNDING || funding.metadata?.userId !== String(userId)) {
        throw new AppError("Funding not found", 404);
    }
    return funding;
};

export const getFunding = async (userId, params) => toFundingDto(await findOwnFunding(userId, params));

// ------------------------------------------------------------------- funding

// Step 1: record a PENDING funding and get a Paystack checkout URL. No money moves
// until Paystack confirms the payment (completeFunding below).
export const initiateFunding = async (userId, body, idempotencyKey) => {
    const { amountKobo } = parseOrThrow(fundWalletSchema, body);

    const account = await getOrCreateUserAccount(userId);
    if (account.status === ACCOUNT_STATUSES.FROZEN) throw new AppError("Your wallet is frozen", 403);
    const user = await UserRepository.findUserById(userId);
    if (!user) throw new AppError("User not found", 404);

    // Second line of defence behind the Idempotency-Key middleware: the database
    // refuses two fundings with the same key for the same user (unique column).
    // Hashed so it always fits the column, whatever the key's length.
    const dedupeKey = idempotencyKey
        ? `fund:${crypto.createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex")}`
        : null;

    let funding;
    try {
        // Saved BEFORE calling Paystack, so a webhook for this reference always finds it
        funding = await LedgerRepository.createTransaction({
            type: TRANSACTION_TYPES.FUNDING,
            status: PENDING,
            reference: generateReference("KMF"),
            amountKobo: BigInt(amountKobo),
            currency: account.currency,
            idempotencyKey: dedupeKey,
            metadata: { userId: String(userId), accountId: account.id, provider: paymentProvider.name },
        });
    } catch (error) {
        if (error?.code === "P2002" && dedupeKey) {
            const existing = await LedgerRepository.findTransactionByIdempotencyKey(dedupeKey);
            if (existing) return toFundingDto(existing);
        }
        throw error;
    }

    let checkout;
    try {
        checkout = await paymentProvider.initializeTransaction({
            email: user.email,
            amountKobo,
            reference: funding.reference,
            currency: funding.currency,
            callbackUrl: paymentsConfig.paystack.callbackUrl,
            metadata: { purpose: "wallet_funding" },
        });
    } catch (error) {
        // Nothing was charged. Mark it failed and free the key so the client can retry.
        await LedgerRepository.updateTransaction(funding.id, {
            status: FAILED,
            idempotencyKey: null,
            metadata: { ...funding.metadata, failureReason: error.message },
        });
        throw error;
    }

    const updated = await LedgerRepository.updateTransaction(funding.id, {
        metadata: { ...funding.metadata, authorizationUrl: checkout.authorizationUrl, accessCode: checkout.accessCode },
    });
    return toFundingDto(updated);
};

// Step 2: credit the wallet for a successful payment, exactly once, no matter how
// often this runs (duplicate webhooks, a webhook racing the verify endpoint, retries).
// Returns { outcome, funding } where outcome is one of: credited, already_credited,
// not_paid, failed, mismatch, ignored.
export const completeFunding = async (reference) => {
    const funding = await LedgerRepository.findTransactionByReference(reference);
    if (!funding || funding.type !== TRANSACTION_TYPES.FUNDING) return { outcome: "ignored", funding: null };
    if (funding.status === SUCCESS) return { outcome: "already_credited", funding };

    // Never trust a webhook body with money: ask the provider directly. Done before
    // opening the database transaction, so no row stays locked during a network call.
    const payment = await paymentProvider.verifyTransaction(reference);

    return prisma.$transaction(async (tx) => {
        // Concurrent calls for the same reference queue up on this row lock. Whoever
        // goes second sees SUCCESS here and does nothing.
        const locked = await LedgerRepository.lockTransactionByReference(tx, reference);
        if (locked.status === SUCCESS) return { outcome: "already_credited", funding: locked };

        if (payment.status !== "success") {
            if (FINAL_FAILURES.has(payment.status) && locked.status === PENDING) {
                const failed = await LedgerRepository.updateTransaction(locked.id, {
                    status: FAILED,
                    metadata: { ...locked.metadata, failureReason: `Payment ${payment.status}` },
                }, tx);
                return { outcome: "failed", funding: failed };
            }
            return { outcome: "not_paid", funding: locked };
        }

        // The verified payment must be exactly what we asked for
        if (payment.reference !== locked.reference
            || payment.amountKobo !== toKobo(locked.amountKobo)
            || payment.currency !== locked.currency) {
            console.error(`[funding] ${reference}: verified payment (${payment.amountKobo} ${payment.currency}) does not match; not crediting`);
            const flagged = await LedgerRepository.updateTransaction(locked.id, {
                status: FAILED,
                metadata: { ...locked.metadata, failureReason: "Verified amount or currency does not match" },
            }, tx);
            return { outcome: "mismatch", funding: flagged };
        }

        // Money enters KoboMarket: debit the outside world (Paystack), credit the wallet
        const paystackAccountId = await getPlatformAccountId(OWNER_TYPES.EXTERNAL, EXTERNAL_ACCOUNTS.PAYSTACK);
        const wallet = await getOrCreateUserAccount(locked.metadata.userId, tx);
        await postEntries(tx, locked, [
            { accountId: paystackAccountId, direction: DIRECTIONS.DEBIT, amountKobo: locked.amountKobo },
            { accountId: wallet.id, direction: DIRECTIONS.CREDIT, amountKobo: locked.amountKobo },
        ]);
        const credited = await LedgerRepository.updateTransaction(locked.id, {
            status: SUCCESS,
            metadata: {
                ...locked.metadata,
                providerTransactionId: payment.providerTransactionId,
                paidAt: payment.paidAt,
                channel: payment.channel,
            },
        }, tx);
        console.info(`[funding] ${reference}: credited ${formatKobo(locked.amountKobo)}`);
        return { outcome: "credited", funding: credited };
    }, DB_TRANSACTION_OPTIONS);
};

// For when the webhook can't reach us (e.g. localhost): the client calls this after
// Paystack redirects back. It goes through the same credit-once path.
export const verifyFunding = async (userId, params) => {
    const funding = await findOwnFunding(userId, params);
    const { funding: latest } = await completeFunding(funding.reference);
    return toFundingDto(latest ?? funding);
};
