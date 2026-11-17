import crypto from "node:crypto";
import AppError from "../shared/errors/appError.js";
import IdempotencyRepository from "../modules/idempotency/idempotency.repository.js";

// Visible ASCII, no spaces (a UUID is the usual choice)
const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;
// An IN_PROGRESS key older than this is assumed abandoned (its process crashed)
const STALE_AFTER_MS = 5 * 60 * 1000;

// JSON with object keys sorted, so {"a":1,"b":2} and {"b":2,"a":1} hash the same
const stableStringify = (value) => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
};

const hashBody = (body) => crypto.createHash("sha256").update(stableStringify(body ?? null)).digest("hex");

// Makes a POST safe to retry. Use after isAuthenticated:
//   router.post("/fund", isAuthenticated, idempotent("POST /wallet/fund"), handler)
//
// - Same Idempotency-Key + same body   -> the first response is replayed, the action is not repeated
// - Same key + a different body        -> 409
// - Same key while the first is running -> 409 (retry shortly)
// Only successful (2xx) responses are remembered. On an error the key is released,
// so the client can fix the problem and retry with the same key.
const idempotent = (scope) => async (req, res, next) => {
    try {
        const key = req.get("Idempotency-Key");
        if (!key) throw new AppError("Idempotency-Key header is required", 400);
        if (!KEY_PATTERN.test(key)) throw new AppError("Idempotency-Key must be 1-255 visible ASCII characters", 400);
        if (!req.userId) throw new AppError("Unauthorized", 401);

        const userId = String(req.userId);
        const requestHash = hashBody(req.body);

        let record = null;
        // Usually one pass. A second pass only happens if the key was released between
        // our insert attempt and our read.
        for (let attempt = 0; attempt < 3 && !record; attempt++) {
            const claim = await IdempotencyRepository.claim({ userId, scope, key, requestHash });
            if (claim.claimed) {
                record = claim.record;
                break;
            }
            const existing = claim.record;
            if (!existing) continue;

            if (existing.requestHash !== requestHash) {
                throw new AppError("This Idempotency-Key was already used with a different request body", 409);
            }
            if (existing.status === "COMPLETED") {
                res.set("Idempotent-Replayed", "true");
                return res.status(existing.responseStatus).json(existing.responseBody);
            }
            const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
            if (existing.updatedAt < staleBefore && await IdempotencyRepository.takeOverStale(existing.id, staleBefore)) {
                record = existing;
                break;
            }
            throw new AppError("A request with this Idempotency-Key is still being processed", 409);
        }
        if (!record) throw new AppError("Could not reserve the Idempotency-Key, please retry", 409);

        req.idempotencyKey = key;

        // Store (or release) the key BEFORE the response goes out, so a retry that
        // arrives right after the client gets its answer sees the final state
        const sendJson = res.json.bind(res);
        res.json = (body) => {
            res.json = sendJson;
            const succeeded = res.statusCode >= 200 && res.statusCode < 300;
            const save = succeeded
                ? IdempotencyRepository.complete(record.id, res.statusCode, body)
                : IdempotencyRepository.release(record.id);
            save
                .catch((error) => console.error(`[idempotency] could not update key for ${scope}: ${error.message}`))
                .finally(() => sendJson(body));
            return res;
        };
        next();
    } catch (error) {
        next(error);
    }
};

export default idempotent;
