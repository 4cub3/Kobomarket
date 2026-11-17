import {
    getWallet,
    listWalletTransactions,
    initiateFunding,
    getFunding,
    verifyFunding,
} from "./wallet.service.js";

class WalletController {
    static async getWallet(req, res, next) {
        try {
            const wallet = await getWallet(req.userId);
            res.status(200).json({ success: true, message: "Wallet retrieved successfully", data: wallet });
        } catch (error) {
            next(error);
        }
    }

    static async listTransactions(req, res, next) {
        try {
            const { items, pageInfo } = await listWalletTransactions(req.userId, req.query);
            res.status(200).json({ success: true, message: "Wallet transactions retrieved successfully", data: items, pageInfo });
        } catch (error) {
            next(error);
        }
    }

    static async fund(req, res, next) {
        try {
            const funding = await initiateFunding(req.userId, req.body, req.idempotencyKey);
            res.status(201).json({
                success: true,
                message: "Funding started. Complete the payment at authorizationUrl.",
                data: funding,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getFunding(req, res, next) {
        try {
            const funding = await getFunding(req.userId, req.params);
            res.status(200).json({ success: true, message: "Funding retrieved successfully", data: funding });
        } catch (error) {
            next(error);
        }
    }

    static async verifyFunding(req, res, next) {
        try {
            const funding = await verifyFunding(req.userId, req.params);
            res.status(200).json({ success: true, message: `Funding is ${funding.status}`, data: funding });
        } catch (error) {
            next(error);
        }
    }
}

export default WalletController;
