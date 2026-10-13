/**
 * Reasons our Cloud Functions raise, e.g. "quote-expired". The UI maps these to
 * a message in the client's language; anything else is a generic failure.
 */
export type ApiErrorCode =
    | "requires-human"
    | "rates-unavailable"
    | "amount-too-small"
    | "invalid-amount"
    | "same-currency"
    | "quote-expired"
    | "quote-not-found"
    | "quote-already-used"
    | "invalid-input"
    | "invalid-operation-no"
    | "invalid-proof-path"
    | "proof-not-uploaded"
    | "proof-too-large"
    | "operation-no-duplicate"
    | "order-not-found"
    | "order-not-pending"
    | "receipt-not-ready"
    | "model-unavailable"
    | "sign-in-required"
    | "staff-only"
    | "role-not-allowed"
    | "network"
    | "unknown";

export class ApiError extends Error {
    constructor(
        readonly code: ApiErrorCode,
        readonly details?: unknown,
        /** What the SDK said, kept for logs: `functions/internal: ...`. */
        readonly origin?: string
    ) {
        super(origin ? `${code} (${origin})` : code);
        this.name = "ApiError";
    }
}

const KNOWN: ReadonlySet<string> = new Set<ApiErrorCode>([
    "requires-human",
    "rates-unavailable",
    "amount-too-small",
    "invalid-amount",
    "same-currency",
    "quote-expired",
    "quote-not-found",
    "quote-already-used",
    "invalid-input",
    "invalid-operation-no",
    "invalid-proof-path",
    "proof-not-uploaded",
    "proof-too-large",
    "operation-no-duplicate",
    "order-not-found",
    "order-not-pending",
    "receipt-not-ready",
    "model-unavailable",
    "sign-in-required",
    "staff-only",
    "role-not-allowed",
]);

type FirebaseLikeError = Error & {
    code: string;
    details?: unknown;
    customData?: unknown;
};

/** Duck-typed so this file (and the assistant's tools) never import the SDK. */
const isFirebaseError = (error: unknown): error is FirebaseLikeError =>
    error instanceof Error &&
    typeof (error as Error & {code?: unknown}).code === "string" &&
    (error as Error & {code: string}).code.includes("/");

export const toApiError = (error: unknown): ApiError => {
    if (error instanceof ApiError) {
        return error;
    }
    if (isFirebaseError(error)) {
        if (
            error.code === "functions/unavailable" &&
            !KNOWN.has(error.message)
        ) {
            return new ApiError(
                "network",
                undefined,
                `${error.code}: ${error.message}`
            );
        }
        const code = KNOWN.has(error.message)
            ? (error.message as ApiErrorCode)
            : "unknown";
        return new ApiError(
            code,
            error.details ?? error.customData,
            `${error.code}: ${error.message}`
        );
    }
    return new ApiError("unknown", error);
};
