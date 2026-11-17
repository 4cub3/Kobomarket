import AppError from "../../shared/errors/appError.js";
import bcrypt from "bcrypt";
import AuthRepository from "./auth.repository.js";
import UserRepository from "../user/user.repository.js";
import sendEmailService from "../../integrations/email/email.service.js";
import { verifyUserEmailTemplate } from "../../integrations/email/email-templates/verify-user-email-template.js";
import { resetPasswordEmailTemplate } from "../../integrations/email/email-templates/reset-email-template.js"
import jwt from "jsonwebtoken";
import { sanitizeSession } from "../../lib/session.js";
import { sanitizeUser } from "../../lib/user.js";
import WalletRepository from "../wallet/wallet.repository.js";
import mongoose from "mongoose"

const ACCESS_TOKEN_TTL = "15m";
const JWT_RESET_PASSWORD_TTL = 60
const REFRESH_TOKEN_TTL = "7d";
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: REFRESH_TOKEN_MS,
};

const issueTokenPair = async (userId, sessionId) => {
    const accessToken = jwt.sign(
        { userId, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );
    const refreshToken = jwt.sign(
        { userId, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12);

    await AuthRepository.updateSession(sessionId, {
        refreshToken: hashedRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
        lastUsedAt: new Date(),
    });

    return { accessToken, refreshToken };
};

const setRefreshCookie = (res, refreshToken) => {
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

const clearRefreshCookie = (res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/v1/auth",
    });
};



const registerUserService = async (userData) => {
    const session = await mongoose.startSession()
    let wallet = null
    try {
        session.startTransaction()
        const existingUser = await UserRepository.findUserByEmail(userData.email, { session });
        if (existingUser) {
            throw new AppError("User already exists with this email", 400);
        }
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const userDataToSave = {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            countryCode: userData.countryCode,
            phoneNumber: userData.phoneNumber,
            passwordHash: hashedPassword,
        };
        const newUser = await UserRepository.createUser(userDataToSave, { session });
        const verificationToken = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const hashedToken = await bcrypt.hash(verificationToken, 12);
        const tokenData = {
            userId: newUser._id,
            token: hashedToken,
            expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
            isVerified: false,
        };

        const newToken = await AuthRepository.createToken(tokenData, { session });
        newUser.verificationToken = newToken._id;
        await newUser.save({ session });

        wallet = await WalletRepository.createWallet(newUser._id.toString());
        await session.commitTransaction()

        // Only send the email once everything is committed
        const verificationLink = `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`;
        const emailTemplate = verifyUserEmailTemplate(newUser.firstName + " " + newUser.lastName, verificationLink);
        sendEmailService(newUser.email, "Verify Your Email", "Verify Your Email", emailTemplate);

        return {
            success: true,
            message: "User registered successfully",
            user: sanitizeUser(newUser),
        };

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        if (wallet) {
            await WalletRepository.deleteWallet(wallet.id)
        }
       throw error
    } finally {
        await session.endSession()
    }
};

const verifyEmailService = async (token, email) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserRepository.findUserByEmail(email);
        if (!user || user._id.toString() !== decoded.userId.toString()) {
            throw new AppError("User not found", 404);
        }
        const tokenData = await AuthRepository.findTokenByUserId(decoded.userId);
        if (!tokenData) {
            throw new AppError("Token not found", 404);
        }
        const isMatch = await bcrypt.compare(token, tokenData.token);
        if (!isMatch) {
            throw new AppError("Invalid token", 400);
        }
        if (tokenData.expiresAt < new Date()) {
            throw new AppError("Token expired", 400);
        }
        if (tokenData.isVerified) {
            throw new AppError("Email already verified", 400);
        }
        tokenData.isVerified = true;
        await AuthRepository.updateToken(tokenData._id, tokenData);
        user.isEmailVerified = true;
        await UserRepository.updateUser(user._id, user);
        return {
            success: true,
            message: "Email verified successfully",
            user: sanitizeUser(user),
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Failed to verify email", 500, error.message);
    }
};

const loginUserService = async (req, res) => {
    const { email, password } = req.body;
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }
    if (!user.isEmailVerified) {
        throw new AppError("Please verify your email first", 400);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new AppError("Invalid email or password", 401);
    }

    const device = req.headers["user-agent"] || "unknown";
    const session = await AuthRepository.createSession({
        userId: user._id,
        refreshToken: "pending",
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
        ipAddress: req.ip || "unknown",
        userAgent: device,
        lastUsedAt: new Date(),
    });

    const { accessToken, refreshToken } = await issueTokenPair(user._id, session._id);
    setRefreshCookie(res, refreshToken);

    return {
        success: true,
        message: "Login successful",
        user: sanitizeUser(user),
        token: accessToken,
        sessionId: session._id,
    };
};

const refreshTokenService = async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if (!incomingRefreshToken) {
        throw new AppError("Refresh token missing", 401);
    }

    let decoded;
    try {
        decoded = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
    } catch {
        clearRefreshCookie(res);
        throw new AppError("Invalid or expired refresh token", 401);
    }

    if (!decoded?.userId || !decoded?.sessionId) {
        clearRefreshCookie(res);
        throw new AppError("Invalid refresh token", 401);
    }

    const session = await AuthRepository.findActiveSessionById(decoded.sessionId);
    if (!session || session.userId.toString() !== decoded.userId.toString()) {
        clearRefreshCookie(res);
        throw new AppError("Session expired or revoked", 401);
    }

    const isMatch = await bcrypt.compare(incomingRefreshToken, session.refreshToken);
    if (!isMatch) {
        // Possible token reuse — revoke this session
        await AuthRepository.revokeSession(session._id);
        clearRefreshCookie(res);
        throw new AppError("Invalid refresh token", 401);
    }

    const { accessToken, refreshToken } = await issueTokenPair(decoded.userId, session._id);
    setRefreshCookie(res, refreshToken);

    return {
        success: true,
        message: "Token refreshed successfully",
        token: accessToken,
        sessionId: session._id,
    };
};

const resolveSessionFromRefreshCookie = async (req) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if (!incomingRefreshToken) return null;

    try {
        const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
        if (!decoded?.sessionId) return null;

        const session = await AuthRepository.findActiveSessionById(decoded.sessionId);
        if (!session) return null;

        const isMatch = await bcrypt.compare(incomingRefreshToken, session.refreshToken);
        if (!isMatch) return null;

        return session;
    } catch {
        return null;
    }
};

const logoutService = async (req, res) => {
    let sessionId = req.sessionId;

    if (!sessionId) {
        const session = await resolveSessionFromRefreshCookie(req);
        sessionId = session?._id;
    }

    if (sessionId) {
        await AuthRepository.revokeSession(sessionId);
    }

    clearRefreshCookie(res);
    return {
        success: true,
        message: "Logged out successfully",
    };
};

const logoutAllService = async (req, res) => {
    await AuthRepository.revokeAllUserSessions(req.userId);
    clearRefreshCookie(res);
    return {
        success: true,
        message: "Logged out from all devices",
    };
};

const listSessionsService = async (req) => {
    const sessions = await AuthRepository.findActiveSessionsByUserId(req.userId);
    return {
        success: true,
        currentSessionId: req.sessionId,
        sessions: sessions.map(sanitizeSession),
    };
};

const revokeSessionService = async (req) => {
    const { sessionId } = req.params;
    const session = await AuthRepository.findSessionById(sessionId);

    if (!session || session.userId.toString() !== req.userId.toString()) {
        throw new AppError("Session not found", 404);
    }
    if (session.revokedAt) {
        throw new AppError("Session already revoked", 400);
    }

    await AuthRepository.revokeSession(sessionId);

    return {
        success: true,
        message: sessionId === req.sessionId?.toString()
            ? "Current session revoked"
            : "Session revoked successfully",
        revokedCurrent: sessionId === req.sessionId?.toString(),
    };
};

const resetPasswordService = async (email, password) => {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    user.passwordHash = hashedPassword;
    await UserRepository.updateUser(user._id, user);
    return {
        success: true,
        message: "Password reset successfully",
        user: sanitizeUser(user),
    };
};

const changePasswordService = async (email, password, newPassword) => {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new AppError("Invalid password", 400);
    }
    return await resetPasswordService(email, newPassword);
};

const resetPasswordWithTokenService = async (email, password, token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.userId) {
        throw new AppError("Invalid token", 400);
    }
    const user = await UserRepository.findUserById(decoded.userId);
    if (!user || user.email !== email) {
        throw new AppError("User not found", 404);
    }
    return await resetPasswordService(email, password);
};

const forgotPasswordService = async (email) => {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const verificationToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: JWT_RESET_PASSWORD_TTL });
    const hashedToken = await bcrypt.hash(verificationToken, 12);
    const tokenData = {
        userId: user._id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
        isVerified: false,
    };
    const newToken = await AuthRepository.createToken(tokenData);
    user.verificationToken = newToken._id;
    await user.save();
    const verificationLink = `${process.env.APP_URL}/auth/reset-password?token=${verificationToken}`;
    const emailTemplate = resetPasswordEmailTemplate(user.email, verificationLink);
    sendEmailService(user.email, "Reset Your Password", "Reset Your Password", emailTemplate);
    return {
        success: true,
        message: "Password reset email sent successfully",
        user: sanitizeUser(user),
    };
}

export {
    registerUserService,
    verifyEmailService,
    loginUserService,
    refreshTokenService,
    logoutService,
    logoutAllService,
    listSessionsService,
    revokeSessionService,
    resetPasswordService,
    changePasswordService,
    resetPasswordWithTokenService,
    forgotPasswordService,
};
