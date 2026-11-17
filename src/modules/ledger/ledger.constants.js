// These mirror the PostgreSQL enums in prisma/schema.prisma.

export const OWNER_TYPES = Object.freeze({
    USER: "USER",
    SYSTEM: "SYSTEM",
    EXTERNAL: "EXTERNAL",
});

export const ACCOUNT_STATUSES = Object.freeze({
    ACTIVE: "ACTIVE",
    FROZEN: "FROZEN",
});

export const TRANSACTION_TYPES = Object.freeze({
    FUNDING: "FUNDING",
    ORDER_PAYMENT: "ORDER_PAYMENT",
    ESCROW_RELEASE: "ESCROW_RELEASE",
    REFUND: "REFUND",
    PAYOUT: "PAYOUT",
    REVERSAL: "REVERSAL",
});

export const TRANSACTION_STATUSES = Object.freeze({
    PENDING: "PENDING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    REVERSED: "REVERSED",
});

// CREDIT = money arrives in the account, DEBIT = money leaves it
export const DIRECTIONS = Object.freeze({
    DEBIT: "DEBIT",
    CREDIT: "CREDIT",
});

// Platform accounts created by the ledger_core migration, found by owner_id
export const SYSTEM_ACCOUNTS = Object.freeze({
    ESCROW: "PLATFORM_ESCROW",
    REVENUE: "PLATFORM_REVENUE",
    PAYOUT_CLEARING: "PLATFORM_PAYOUT_CLEARING",
});

// Money outside KoboMarket. Funding debits it and payouts credit it, so its
// balance is always -(money funded - money paid out).
export const EXTERNAL_ACCOUNTS = Object.freeze({
    PAYSTACK: "PAYSTACK",
});

export const DEFAULT_CURRENCY = "NGN";
