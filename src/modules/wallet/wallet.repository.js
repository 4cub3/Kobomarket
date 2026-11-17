import LedgerRepository from "../ledger/ledger.repository.js";
import { OWNER_TYPES } from "../ledger/ledger.constants.js";

// A wallet is a USER account in the ledger (see prisma/schema.prisma).
class WalletRepository {
    // Called at signup. Safe to retry: an existing wallet is returned, not duplicated.
    static async createWallet(userId) {
        return LedgerRepository.ensureAccount(OWNER_TYPES.USER, String(userId));
    }

    // Compensation when signup fails after the wallet was created. It never removes
    // a wallet that already has ledger entries (money rows are never deleted).
    static async deleteWallet(id) {
        return LedgerRepository.deleteAccountIfUnused(id);
    }
}

export default WalletRepository;
