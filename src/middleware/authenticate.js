import jwt from "jsonwebtoken";
import AppError from "../shared/errors/appError.js";
import AuthRepository from "../modules/auth/auth.repository.js";

const isAuthenticated = async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header) {
            throw new AppError("Unauthorized", 401);
        }
        const [scheme, token] = header.split(" ");
        if (scheme !== "Bearer" || !token) {
            throw new AppError("Unauthorized", 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.userId || !decoded?.sessionId) {
            throw new AppError("Unauthorized", 401);
        }

        const session = await AuthRepository.findActiveSessionById(decoded.sessionId);
        if (!session || session.userId.toString() !== decoded.userId.toString()) {
            throw new AppError("Session expired or revoked", 401);
        }

        req.userId = decoded.userId;
        req.sessionId = decoded.sessionId;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return next(new AppError("Unauthorized", 401));
        }
        next(error);
    }
};

export default isAuthenticated;
