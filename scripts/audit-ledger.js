// npm run audit:ledger
//
// Checks that the money adds up. Prints PASS or FAIL and exits with code 1 on FAIL
// (2 if the audit couldn't run at all), so it can gate CI.
import "../src/config/env.js";
import prisma from "../src/database/postgres/prisma.js";
import LedgerRepository from "../src/modules/ledger/ledger.repository.js";
import { formatKobo } from "../src/lib/money.js";

const results = [];
const check = (name, passed, details = []) => results.push({ name, passed, details });

// BigInt -> string so rows print cleanly
const printable = (rows) => rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])));

try {
    const unbalanced = await LedgerRepository.findUnbalancedTransactions();
    check("Every transaction's debits equal its credits", unbalanced.length === 0, unbalanced);

    const mismatched = await LedgerRepository.findBalanceMismatches();
    check("Every cached balance equals SUM(credits) - SUM(debits) of its entries", mismatched.length === 0, mismatched);

    const negative = await LedgerRepository.findNegativeBalances();
    check("No user or platform account is below zero", negative.length === 0, negative);

    const statusMismatches = await LedgerRepository.findStatusEntryMismatches();
    check("Only SUCCESS/REVERSED transactions have ledger entries", statusMismatches.length === 0, statusMismatches);

    const { heldKobo, externalKobo, fundedKobo, paidOutKobo } = await LedgerRepository.getMoneySupply();
    const summary = [{
        held: heldKobo.toString(),
        funded: fundedKobo.toString(),
        paid_out: paidOutKobo.toString(),
        external: externalKobo.toString(),
    }];
    check(
        `User wallets + escrow + revenue + payout clearing (${formatKobo(heldKobo)}) = funded - paid out (${formatKobo(fundedKobo - paidOutKobo)})`,
        heldKobo === fundedKobo - paidOutKobo,
        summary
    );
    check("Money held inside KoboMarket mirrors the Paystack (external) account", heldKobo === -externalKobo, summary);
} catch (error) {
    console.error(`Audit could not run: ${error.message}`);
    await prisma.$disconnect();
    process.exit(2);
}
await prisma.$disconnect();

console.log("\nLedger audit\n");
for (const { name, passed, details } of results) {
    console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}`);
    if (!passed && details.length) console.table(printable(details));
}
const allPassed = results.every((result) => result.passed);
console.log(`\n${allPassed ? "PASS" : "FAIL"}\n`);
process.exitCode = allPassed ? 0 : 1;
