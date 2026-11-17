export const sanitizeSession = (session) => ({
    id: session._id,
    userId: session.userId,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
});