import express from "express";
import validateBodySchema from "../../middleware/validateBodySchemas.js";
import { registerSchema, verifyEmailSchema, loginSchema, changePasswordSchema, resetPasswordWithTokenSchema, forgotPasswordSchema } from "./auth.schema.js";
import AuthController from "./auth.controller.js";
import isAuthenticated from "../../middleware/authenticate.js";
import { apiLimiter, authSensitiveLimiter, loginLimiter } from "../../middleware/rateLimit.js";

const router = express.Router();

router.post("/register",authSensitiveLimiter, validateBodySchema(registerSchema), AuthController.register);
router.post("/verify-email",authSensitiveLimiter, validateBodySchema(verifyEmailSchema), AuthController.verifyEmail);
router.post("/login",loginLimiter, validateBodySchema(loginSchema), AuthController.login);
router.post("/refresh", loginLimiter, AuthController.refresh);
router.post("/logout", AuthController.logout);
router.post("/logout-all", isAuthenticated, AuthController.logoutAll);
router.get("/sessions",apiLimiter, isAuthenticated, AuthController.listSessions);
router.delete("/sessions/:sessionId",apiLimiter, isAuthenticated, AuthController.revokeSession);
router.patch("/change-password",authSensitiveLimiter, isAuthenticated, validateBodySchema(changePasswordSchema), AuthController.changePassword);
router.patch("/reset-password",authSensitiveLimiter, validateBodySchema(resetPasswordWithTokenSchema), AuthController.resetPasswordWithToken);
router.post("/forgot-password",authSensitiveLimiter, validateBodySchema(forgotPasswordSchema), AuthController.forgotPassword);
export default router;
