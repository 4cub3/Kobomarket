import prisma from "../../database/postgres/prisma.js";
import { DEFAULT_CURRENCY } from "./ledger.constants.js";

// Every method takes an optional `db`. Pass the `tx` you get inside
// prisma.$transaction(async (tx) => ...) to run as part of that database
// transaction; leave it out to use the shared client.
class LedgerRepository {
    // ---------------------------------------------------------------- accounts

    static findAccountByOwner(ownerType, ownerId, currency = DEFAULT_CURRENCY, db = prisma) {
        return db.account.findUnique({
            where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
        });
    }

    // INSERT ... ON CONFLICT DO NOTHING, then read it back: safe to call twice,
    // or from two requests at once, without creating a duplicate
    static async ensureAccount(ownerType, ownerId, currency = DEFAULT_CURRENCY, db = prisma) {
        await db.account.createMany({
            data: [{ ownerType, ownerId, currency }],
            skipDuplicates: true,
        });
        return LedgerRepository.findAccountByOwner(ownerType, ownerId, currency, db);
    }

    // Deletes an account only if nothing was ever posted to it
    static deleteAccountIfUnused(id, db = prisma) {
        return db.account.deleteMany({ where: { id, entries: { none: {} } } });
    }

    // Row-locks the accounts until the surrounding database transaction ends.
    // ORDER BY runs before FOR UPDATE, so every caller locks accounts in the same
    // (id) order, and two transactions touching the same accounts can't deadlock.
    static lockAccounts(tx, ids) {
        return tx.$queryRaw`
            SELECT id, owner_type, status, balance_kobo
            FROM accounts
            WHERE id = ANY(${ids}::uuid[])
            ORDER BY id
            FOR UPDATE`;
    }

    static changeBalance(tx, id, deltaKobo) {
        return tx.account.update({
            where: { id },
            data: { balanceKobo: { increment: deltaKobo } },
        });
    }

    // ------------------------------------------------------------ transactions

    static createTransaction(data, db = prisma) {
        return db.ledgerTransaction.create({ data });
    }

    static findTransactionByReference(reference, db = prisma) {
        return db.ledgerTransaction.findUnique({ where: { reference } });
    }

    static findTransactionByIdempotencyKey(idempotencyKey, db = prisma) {
        return db.ledgerTransaction.findUnique({ where: { idempotencyKey } });
    }

    static updateTransaction(id, data, db = prisma) {
        return db.ledgerTransaction.update({ where: { id }, data });
    }

    // Locks one transaction row, so concurrent webhooks for the same payment run
    // one after the other instead of side by side
    static async lockTransactionByReference(tx, reference) {
        const rows = await tx.$queryRaw`
            SELECT id FROM transactions WHERE reference = ${reference} FOR UPDATE`;
        return rows.length ? tx.ledgerTransaction.findUnique({ where: { id: rows[0].id } }) : null;
    }

    static async lockTransactionById(tx, id) {
        const rows = await tx.$queryRaw`
            SELECT id FROM transactions WHERE id = ${id}::uuid FOR UPDATE`;
        return rows.length ? tx.ledgerTransaction.findUnique({ where: { id: rows[0].id } }) : null;
    }

    // ----------------------------------------------------------------- entries

    static insertEntries(tx, rows) {
        return tx.ledgerEntry.createMany({ data: rows });
    }

    static findEntriesByTransaction(transactionId, db = prisma) {
        return db.ledgerEntry.findMany({ where: { transactionId }, orderBy: { id: "asc" } });
    }

    // Newest first, keyset-paginated on the BIGSERIAL id. Fetches one extra row
    // so the caller knows whether there is a next page.
    static findAccountEntries(accountId, { limit, beforeId }, db = prisma) {
        return db.ledgerEntry.findMany({
            where: { accountId, ...(beforeId ? { id: { lt: beforeId } } : {}) },
            orderBy: { id: "desc" },
            take: limit + 1,
            include: {
                transaction: { select: { id: true, reference: true, type: true, status: true } },
            },
        });
    }

    // ------------------------------------------------------------------- audit
    // Raw SQL so the database does the sums, not JavaScript loops.

    // Transactions whose debits and credits differ (the commit-time trigger
    // should make this impossible)
    static findUnbalancedTransactions(db = prisma) {
        return db.$queryRaw`
            SELECT t.reference, t.type::text,
                   SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount_kobo ELSE 0 END)::bigint AS debits_kobo,
                   SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_kobo ELSE 0 END)::bigint AS credits_kobo
            FROM ledger_entries e
            JOIN transactions t ON t.id = e.transaction_id
            GROUP BY t.id
            HAVING SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount_kobo ELSE -e.amount_kobo END) <> 0`;
    }

    // Accounts whose cached balance_kobo differs from SUM(credits) - SUM(debits).
    // This is also the admin reconciliation report: it should always be empty.
    static findBalanceMismatches(db = prisma) {
        return db.$queryRaw`
            SELECT a.id, a.owner_type::text, a.owner_id,
                   a.balance_kobo AS cached_kobo,
                   COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_kobo ELSE -e.amount_kobo END), 0)::bigint AS ledger_kobo
            FROM accounts a
            LEFT JOIN ledger_entries e ON e.account_id = a.id
            GROUP BY a.id
            HAVING a.balance_kobo <> COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_kobo ELSE -e.amount_kobo END), 0)
            ORDER BY a.owner_type, a.owner_id`;
    }

    static findNegativeBalances(db = prisma) {
        return db.$queryRaw`
            SELECT id, owner_type::text, owner_id, balance_kobo
            FROM accounts
            WHERE owner_type <> 'EXTERNAL' AND balance_kobo < 0`;
    }

    // Money only moves when a transaction succeeds: PENDING/FAILED ones must have
    // no entries, and SUCCESS/REVERSED ones must have some
    static findStatusEntryMismatches(db = prisma) {
        return db.$queryRaw`
            SELECT t.reference, t.type::text, t.status::text, COUNT(e.id)::int AS entries
            FROM transactions t
            LEFT JOIN ledger_entries e ON e.transaction_id = t.id
            GROUP BY t.id
            HAVING (t.status IN ('SUCCESS', 'REVERSED') AND COUNT(e.id) = 0)
                OR (t.status IN ('PENDING', 'FAILED') AND COUNT(e.id) > 0)`;
    }

    // held = every user and platform account; external = the Paystack side.
    // funded / paid out come from the business records (transactions), so they
    // are an independent check on the balances.
    static async getMoneySupply(db = prisma) {
        const [row] = await db.$queryRaw`
            SELECT
                (SELECT COALESCE(SUM(balance_kobo), 0) FROM accounts WHERE owner_type <> 'EXTERNAL')::bigint AS held_kobo,
                (SELECT COALESCE(SUM(balance_kobo), 0) FROM accounts WHERE owner_type = 'EXTERNAL')::bigint AS external_kobo,
                (SELECT COALESCE(SUM(amount_kobo), 0) FROM transactions WHERE type = 'FUNDING' AND status = 'SUCCESS')::bigint AS funded_kobo,
                (SELECT COALESCE(SUM(amount_kobo), 0) FROM transactions WHERE type = 'PAYOUT' AND status = 'SUCCESS')::bigint AS paid_out_kobo`;
        return {
            heldKobo: row.held_kobo,
            externalKobo: row.external_kobo,
            fundedKobo: row.funded_kobo,
            paidOutKobo: row.paid_out_kobo,
        };
    }
}

export default LedgerRepository;
