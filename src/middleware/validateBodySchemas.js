import { ZodError } from "zod";
import AppError from "../shared/errors/appError.js";
const validateBodySchema = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                }));

                throw new AppError("Validation error", 400, errors);
            }
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}

export default validateBodySchema;