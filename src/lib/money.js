// Money helpers. Every amount in the app is a whole number of kobo (₦1 = 100 kobo),
// held as a plain integer Number. Anything that turns a fractional amount into kobo
// goes through divideRounded below, so the whole app rounds to the nearest kobo the
// same way: halves round away from zero (half a kobo becomes 1 kobo).

const NAIRA_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;
const BASIS_POINTS_PER_WHOLE = 10000n;

const nairaFormatter = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });

// Integer division rounded to the nearest whole number, halves away from zero.
// The denominator must be positive.
const divideRounded = (numerator, denominator) => {
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    const twiceRemainder = (remainder < 0n ? -remainder : remainder) * 2n;
    if (twiceRemainder < denominator) return quotient;
    return numerator < 0n ? quotient - 1n : quotient + 1n;
};

// Checks a kobo amount and returns it as a Number. Accepts BigInt so Prisma
// BigInt columns (e.g. wallets.balanceKobo) can be passed straight in, and so
// the result is safe to send through res.json, which cannot serialise BigInt.
export const toKobo = (value) => {
    const kobo = typeof value === "bigint" ? Number(value) : value;
    if (!Number.isSafeInteger(kobo)) {
        throw new TypeError(`Expected a whole number of kobo, got ${value}`);
    }
    return kobo;
};

// Converts a naira amount ("1500.50" or 1500.5) to kobo, rounded to the nearest kobo.
// Works on the decimal digits rather than multiplying a float, so 19.99 gives 1999,
// not 1998.9999999999998.
export const nairaToKobo = (naira) => {
    const text = typeof naira === "number" ? String(naira) : naira;
    const match = typeof text === "string" ? NAIRA_PATTERN.exec(text.trim()) : null;
    if (!match) {
        throw new TypeError(`Invalid naira amount: ${naira}`);
    }
    const [, minus, whole, fraction = ""] = match;
    const scaled = BigInt(whole + fraction);
    const scale = 10n ** BigInt(fraction.length);
    const kobo = divideRounded(scaled * 100n, scale);
    return toKobo(minus ? -kobo : kobo);
};

// Returns a percentage of a kobo amount, rounded to the nearest kobo.
// The rate is in basis points so it is always a whole number:
// 1% = 100, 7.5% VAT = 750, 1.5% gateway fee = 150.
export const percentageOf = (kobo, basisPoints) => {
    if (!Number.isSafeInteger(basisPoints)) {
        throw new TypeError(`Rate must be whole basis points, got ${basisPoints}`);
    }
    const amount = BigInt(toKobo(kobo)) * BigInt(basisPoints);
    return toKobo(divideRounded(amount, BASIS_POINTS_PER_WHOLE));
};

// Splits a kobo amount by weights so the parts always add back up to the total.
// e.g. splitKobo(10000, [1, 1, 1]) -> [3334, 3333, 3333].
// Leftover kobo go to the parts with the largest remainders (earlier parts win ties).
export const splitKobo = (totalKobo, weights) => {
    const total = BigInt(toKobo(totalKobo));
    if (total < 0n) {
        throw new RangeError("Total to split cannot be negative");
    }
    const parts = weights.map((weight) => {
        if (!Number.isSafeInteger(weight) || weight < 0) {
            throw new TypeError(`Weights must be whole numbers of 0 or more, got ${weight}`);
        }
        return BigInt(weight);
    });
    const weightSum = parts.reduce((sum, weight) => sum + weight, 0n);
    if (weightSum === 0n) {
        throw new RangeError("At least one weight must be greater than 0");
    }

    const shares = parts.map((weight) => (total * weight) / weightSum);
    let leftover = total - shares.reduce((sum, share) => sum + share, 0n);

    const byRemainder = parts
        .map((weight, index) => ({ index, remainder: (total * weight) % weightSum }))
        .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));

    for (const { index } of byRemainder) {
        if (leftover === 0n) break;
        shares[index] += 1n;
        leftover -= 1n;
    }
    return shares.map(toKobo);
};

// Formats kobo for display only, e.g. 150050 -> "₦1,500.50". Never do maths on the result.
export const formatKobo = (kobo) => {
    const value = BigInt(toKobo(kobo));
    const absolute = value < 0n ? -value : value;
    const sign = value < 0n ? "-" : "";
    const fraction = String(absolute % 100n).padStart(2, "0");
    return nairaFormatter.format(`${sign}${absolute / 100n}.${fraction}`);
};
