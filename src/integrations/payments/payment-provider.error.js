import AppError from "../../shared/errors/appError.js";

// The payment provider failed or couldn't be reached. 502 = "bad gateway":
// the problem is upstream, not in the client's request.
export class PaymentProviderError extends AppError {
    constructor(message, statusCode = 502, errors) {
        super(message, statusCode, errors);
        this.name = "PaymentProviderError";
    }
}
