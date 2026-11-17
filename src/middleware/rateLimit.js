import rateLimit from "express-rate-limit";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 200;
const LOGIN_MAX_REQUESTS = 5;
const AUTH_SENSITIVE_MAX_REQUESTS = 5;
//  limit for most of the API
const apiLimiter = rateLimit({
    windowMs: WINDOW_MS, // 15 minutes
    max: MAX_REQUESTS,                 // 200 requests per window per IP
    standardHeaders: true,    // RateLimit-* headers
    legacyHeaders: false,     // disable X-RateLimit-*
    message: {
        message: "Too many requests. Try again later.",
    },
});

//  limit for login
const loginLimiter = rateLimit({
    windowMs: WINDOW_MS,
    max: LOGIN_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many login attempts. Try again in 15 minutes.",
    },
});

// Strict for register / password reset / resend email
const authSensitiveLimiter = rateLimit({
    windowMs: WINDOW_MS, // 1 hour
    max: AUTH_SENSITIVE_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many attempts. Try again later.",
    },
});

export {
    apiLimiter,
    loginLimiter,
    authSensitiveLimiter,
};