import z from "zod";
import AppError from "../shared/errors/appError.js";

// Parses input with a Zod schema and returns the parsed data (trimmed, coerced,
// unknown keys dropped). Throws the same 400 shape as the validateBodySchema middleware.
export const parseOrThrow = (schema, input) => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        }));
        throw new AppError("Validation error", 400, errors);
    }
    return result.data;
};

// A MongoDB ObjectId as a 24-character hex string
export const objectIdString = (label = "id") =>
    z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);
