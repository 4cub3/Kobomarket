import AppError from "../shared/errors/appError.js";

// Opaque to the client: base64url-encoded JSON
export const encodeCursor = (payload) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");

export const decodeCursor = (cursor) => {
    let payload = null;
    try {
        payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch { /* falls through to the check below */ }
    if (!payload || typeof payload !== "object") throw new AppError("Invalid cursor", 400);
    return payload;
};
