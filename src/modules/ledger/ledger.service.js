import prisma from "../../database/postgres/prisma.js";
import AppError from "../../shared/errors/appError.js";
import { toKobo } from "../../lib/money.js";
import { generateReference } from "../../lib/reference.js";
import LedgerRepository from "./ledger.repository.js";
import {
    DEFAULT_CURRENCY,
    DIRECTIONS,
    OWNER_TYPES,
    TRANSACTION_STATUSES,
    TRANSACTION_TYPES,
} from "./ledger.constants.js";

// Wait up to 10s for a free connection; let a money transaction run up to 15s
export const DB_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10_000, timeout: 15_000 });

// Runs fn inside the caller's database transaction if one is given, otherwise in a new one
const inTransaction = (tx, fn) => (tx ? fn(tx) : prisma.$transaction(fn, DB_TRANSACTION_OPTIONS));

// Checks entries describe a valid double-entry movement before anything is written.
// A failure here is a bug in the calling code, so it throws a plain Error (500).
const assertBalancedEntries = (entries, amountKobo) => {
    if (!Array.isArray(entries) || entries.length < 2) {
        throw new Error("A ledger transaction needs at least two entries");
    }
    let debits = 0n;
    let credits = 0n;
    for (const entry of entries) {
        if (typeof entry.accountId !== "string") throw new Error("Ledger entry is missing accountId");
        const amount = BigInt(toKobo(entry.amountKobo));
        if (amount <= 0n) throw new Error("Ledger entry amounts must be greater than 0");
        if (entry.direction === DIRECTIONS.DEBIT) debits += amount;
        else if (entry.direction === DIRECTIONS.CREDIT) credits += amount;
        else throw new Error(`Unknown ledger entry direction: ${entry.direction}`);
    }
    if (debits !== credits) {
        throw new Error(`Unbalanced ledger transaction: debits ${debits} != credits ${credits}`);
    }
    // The transaction's amount is the money it moves
    if (debits !== BigInt(toKobo(amountKobo))) {
        throw new Error(`Transaction amount ${amountKobo} does not match the ${debits} kobo its entries move`);
    }
};

// Writes the entries of an existing transaction row and updates the cached balances.
// Must run inside prisma.$transaction: the accounts stay locked until it commits,
// so two requests can't both spend the same money.
export const postEntries = async (tx, transaction, entries) => {
    assertBalancedEntries(entries, transaction.amountKobo);

    const accountIds = [...new Set(entries.map((entry) => entry.accountId))];
    const locked = await LedgerRepository.lockAccounts(tx, accountIds);
    if (locked.length !== accountIds.length) {
        throw new Error("A ledger account in this transaction does not exist");
    }

    // Balances are read AFTER the lock, so they can't change under us
    const accounts = new Map(locked.map((row) => [row.id, {
        ownerType: row.owner_type,
        start: BigInt(row.balance_kobo),
        balance: BigInt(row.balance_kobo),
    }]));

    const rows = entries.map((entry) => {
        const account = accounts.get(entry.accountId);
        const amount = BigInt(toKobo(entry.amountKobo));
        account.balance += entry.direction === DIRECTIONS.CREDIT ? amount : -amount;
        return {
            transactionId: transaction.id,
            accountId: entry.accountId,
            direction: entry.direction,
            amountKobo: amount,
            balanceAfterKobo: account.balance,
        };
    });

    // Judge each account on its final balance. Only EXTERNAL (Paystack) may go below
    // zero; the accounts_balance_not_negative CHECK backs this up if the code is wrong.
    for (const account of accounts.values()) {
        if (account.ownerType === OWNER_TYPES.EXTERNAL || account.balance >= 0n) continue;
        if (account.ownerType === OWNER_TYPES.USER) throw new AppError("Insufficient wallet balance", 400);
        throw new Error("A platform account would go below zero");
    }

    await LedgerRepository.insertEntries(tx, rows);
    for (const [id, account] of accounts) {
        const delta = account.balance - account.start;
        if (delta !== 0n) await LedgerRepository.changeBalance(tx, id, delta);
    }
    return rows;
};

// Creates a completed (SUCCESS) transaction and posts its entries, all or nothing.
// Pass `tx` to make it part of a bigger database transaction (e.g. checkout).
export const recordTransaction = async (
    { type, reference, amountKobo, currency = DEFAULT_CURRENCY, idempotencyKey = null, metadata = {}, reversesTransactionId = null, entries },
    tx
) => {
    // Fail fast, before opening a database transaction
    assertBalancedEntries(entries, amountKobo);
    return inTransaction(tx, async (db) => {
        const transaction = await LedgerRepository.createTransaction({
            type,
            status: TRANSACTION_STATUSES.SUCCESS,
            reference,
            amountKobo: BigInt(toKobo(amountKobo)),
            currency,
            idempotencyKey,
            metadata,
            reversesTransactionId,
        }, db);
        const postedEntries = await postEntries(db, transaction, entries);
        return { transaction, entries: postedEntries };
    });
};

// Undoes a SUCCESS transaction by posting the mirror image of its entries as a new
// REVERSAL transaction. Nothing is edited or deleted; the original is marked REVERSED,
// and the database allows only one reversal per transaction.
export const reverseTransaction = (transactionId, { reason = null, reference } = {}, tx) =>
    inTransaction(tx, async (db) => {
        const original = await LedgerRepository.lockTransactionById(db, transactionId);
        if (!original) throw new AppError("Transaction not found", 404);
        if (original.status !== TRANSACTION_STATUSES.SUCCESS) {
            throw new AppError(`Only successful transactions can be reversed (this one is ${original.status})`, 409);
        }
        const entries = await LedgerRepository.findEntriesByTransaction(original.id, db);
        const mirrored = entries.map((entry) => ({
            accountId: entry.accountId,
            direction: entry.direction === DIRECTIONS.DEBIT ? DIRECTIONS.CREDIT : DIRECTIONS.DEBIT,
            amountKobo: entry.amountKobo,
        }));
        const reversal = await recordTransaction({
            type: TRANSACTION_TYPES.REVERSAL,
            reference: reference ?? generateReference("KMR"),
            amountKobo: original.amountKobo,
            currency: original.currency,
            metadata: { reason, reversedReference: original.reference },
            reversesTransactionId: original.id,
            entries: mirrored,
        }, db);
        await LedgerRepository.updateTransaction(original.id, { status: TRANSACTION_STATUSES.REVERSED }, db);
        return reversal;
    });

// Platform and external account ids never change once the migration has created
// them, so they are looked up once and cached
const platformAccountIds = new Map();

export const getPlatformAccountId = async (ownerType, code) => {
    const cacheKey = `${ownerType}:${code}`;
    if (!platformAccountIds.has(cacheKey)) {
        const account = await LedgerRepository.findAccountByOwner(ownerType, code);
        if (!account) throw new Error(`Ledger account ${code} is missing. Run the database migrations.`);
        platformAccountIds.set(cacheKey, account.id);
    }
    return platformAccountIds.get(cacheKey);
};

// Users normally get their account at signup. If that step failed after the user
// was saved in MongoDB, the account is created here on first use, so a missing
// wallet repairs itself instead of breaking the user.
export const getOrCreateUserAccount = async (userId, db = prisma) => {
    const ownerId = String(userId);
    const existing = await LedgerRepository.findAccountByOwner(OWNER_TYPES.USER, ownerId, DEFAULT_CURRENCY, db);
    return existing ?? LedgerRepository.ensureAccount(OWNER_TYPES.USER, ownerId, DEFAULT_CURRENCY, db);
};
