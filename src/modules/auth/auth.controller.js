import {
    registerUserService,
    verifyEmailService,
    loginUserService,
    refreshTokenService,
    logoutService,
    logoutAllService,
    listSessionsService,
    revokeSessionService,
    changePasswordService,
    resetPasswordWithTokenService,
    forgotPasswordService,
} from "./auth.service.js";

class AuthController {
    static register = async (req, res, next) => {
        const { email, password, firstName, lastName, countryCode, phoneNumber } = req.body;
        try {
            const user = await registerUserService({
                email,
                password,
                firstName,
                lastName,
                countryCode,
                phoneNumber,
            });
            res.status(201).json({
                success: true,
                message: "User registered successfully",
                user,
            });
        } catch (error) {
            next(error);
        }
    };

    static verifyEmail = async (req, res, next) => {
        const { token, email } = req.body;
        try {
            const user = await verifyEmailService(token, email);
            res.status(200).json({
                success: true,
                message: "Email verified successfully",
                user,
            });
        } catch (error) {
            next(error);
        }
    };

    static login = async (req, res, next) => {
        try {
            const result = await loginUserService(req, res);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    static refresh = async (req, res, next) => {
        try {
            const result = await refreshTokenService(req, res);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    static logout = async (req, res, next) => {
        try {
            const result = await logoutService(req, res);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    static logoutAll = async (req, res, next) => {
        try {
            const result = await logoutAllService(req, res);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    static listSessions = async (req, res, next) => {
        try {
            const result = await listSessionsService(req);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    static revokeSession = async (req, res, next) => {
        try {
            const result = await revokeSessionService(req);
            if (result.revokedCurrent) {
                res.clearCookie("refreshToken", {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    path: "/api/v1/auth",
                });
            }
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
    static changePassword = async (req, res, next) => {
        const { email, password, newPassword } = req.body;
        try {
            const result = await changePasswordService(email, password, newPassword);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
    static resetPasswordWithToken = async (req, res, next) => {
        const { email, password, token } = req.body;
        try {
            const result = await resetPasswordWithTokenService(email, password, token);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
    static forgotPassword = async (req, res, next) => {
        const { email } = req.body;
        try {
            const result = await forgotPasswordService(email);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
}

export default AuthController;
