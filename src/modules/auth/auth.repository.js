import Token from "../../models/token.js";
import Session from "../../models/session.js";

class AuthRepository {
    static async createToken(tokenData, { session } = {}) {
        const [token] = await Token.create([tokenData], { session });
        return token;
    }

    static async findTokenByUserId(userId) {
        return await Token.findOne({ userId });
    }

    static async updateToken(id, tokenData) {
        return await Token.findByIdAndUpdate(id, tokenData, { returnDocument: "after" });
    }

    static async createSession(sessionData) {
        return await Session.create(sessionData);
    }

    static async findSessionById(id) {
        return await Session.findById(id);
    }

    static async findActiveSessionById(id) {
        return await Session.findOne({
            _id: id,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        });
    }

    static async findActiveSessionsByUserId(userId) {
        return await Session.find({
            userId,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        }).sort({ lastUsedAt: -1, createdAt: -1 });
    }

    static async updateSession(id, sessionData) {
        return await Session.findByIdAndUpdate(id, sessionData, { returnDocument: "after" });
    }

    static async revokeSession(id) {
        return await Session.findByIdAndUpdate(
            id,
            { revokedAt: new Date() },
            { new: true }
        );
    }

    static async revokeAllUserSessions(userId, exceptSessionId = null) {
        const filter = { userId, revokedAt: null };
        if (exceptSessionId) {
            filter._id = { $ne: exceptSessionId };
        }
        return await Session.updateMany(filter, { revokedAt: new Date() });
    }
}

export default AuthRepository;
