import UserRepository from "../modules/user/user.repository.js";
import AppError from "../shared/errors/appError.js";

const isAuthorized = (...role) => {
    return async (req, _res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                throw new AppError("Unauthorized", 401);
            }
            const user = await UserRepository.findUserById(userId)
            if (!user) {
                throw new AppError("Unauthorized", 401);
            }
            if (!role.includes(user.role)) {
                throw new AppError("Forbidden", 403);
            }
            req.user = user;
            next();
        } catch (err) {
            next(err)
        }
    }
}

export default isAuthorized;