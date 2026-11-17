import prisma from "../../database/postgres/prisma.js";

class IdempotencyRepository {
    // Tries to reserve the key with INSERT ... ON CONFLICT DO NOTHING. Exactly one
    // request can win, even if several arrive at the same moment.
    static async claim({ userId, scope, key, requestHash }) {
        const { count } = await prisma.idempotencyKey.createMany({
            data: [{ userId, scope, key, requestHash }],
            skipDuplicates: true,
        });
        const record = await prisma.idempotencyKey.findUnique({
            where: { userId_scope_key: { userId, scope, key } },
        });
        return { claimed: count === 1, record };
    }

    // Takes over a key whose request has been IN_PROGRESS since before `staleBefore`
    // (its process most likely died). The conditional update means only one retry wins.
    static async takeOverStale(id, staleBefore) {
        const { count } = await prisma.idempotencyKey.updateMany({
            where: { id, status: "IN_PROGRESS", updatedAt: { lt: staleBefore } },
            data: { updatedAt: new Date() },
        });
        return count === 1;
    }

    static complete(id, responseStatus, responseBody) {
        return prisma.idempotencyKey.update({
            where: { id },
            data: { status: "COMPLETED", responseStatus, responseBody },
        });
    }

    // Forget a key whose request failed, so the client can retry with the same key
    static release(id) {
        return prisma.idempotencyKey.deleteMany({ where: { id, status: "IN_PROGRESS" } });
    }
}

export default IdempotencyRepository;
