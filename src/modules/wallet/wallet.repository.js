import prisma from "../../database/postgres/prisma.js";

class WalletRepository {

    static async createWallet(userId) {
        const wallet = await prisma.wallets.create({
            // balanceKobo starts at 0 via the schema default
            data: {
                userId,
            }
        });
        return wallet;
    }

    static async deleteWallet(id){
        return  await prisma.wallets.delete({where:{id}})
    }
}

export default WalletRepository;